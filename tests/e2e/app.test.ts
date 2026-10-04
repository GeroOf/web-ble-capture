import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";
import type { Server } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buildServer, openFixture } from "./helpers";
import { DEMO_CHARACTERISTIC_UUID } from "../../src/lib/demo-ble";

const contexts: BrowserContext[] = [];
const servers: Server[] = [];
let browser: Browser;
let origin: string;
let demoOrigin: string;
beforeAll(async () => {
  const standard = await buildServer(false);
  servers.push(standard.server);
  origin = standard.origin;
  const demo = await buildServer(true);
  servers.push(demo.server);
  demoOrigin = demo.origin;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  await browser?.close();
  await Promise.all(
    servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

const sampleSelector = `[data-gatt-uuid="${DEMO_CHARACTERISTIC_UUID}"]`;
describe("BLE capture", () => {
  it.each([
    ["/", "en", "Browser Not Supported", "JavaScript is required to use the Web Bluetooth API."],
    ["/ja/", "ja", "ブラウザ非対応", "Web Bluetooth API を利用するには JavaScript が必要です。"],
  ])(
    "keeps %s useful without Bluetooth or JavaScript",
    async (path, locale, fallback, noscript) => {
      const active = await openFixture(browser, origin, contexts);
      await active.page.goto(origin + path);
      await active.page.getByText(fallback, { exact: true }).waitFor({ state: "visible" });
      expect(await active.page.locator("html").getAttribute("lang")).toBe(locale);
      expect(
        JSON.parse(
          (await active.page.locator('script[type="application/ld+json"]').textContent()) ?? "",
        )["@type"],
      ).toBe("WebApplication");
      expect(active.errors).toEqual([]);
      expect(active.external).toEqual([]);
      const disabled = await openFixture(browser, origin, contexts, { javaScriptEnabled: false });
      await disabled.page.goto(origin + path);
      await disabled.page.getByText(noscript, { exact: true }).waitFor({ state: "visible" });
      expect(disabled.external).toEqual([]);
    },
  );

  it("validates search filters and treats chooser cancellation as a normal action", async () => {
    const { page, external, errors } = await openFixture(browser, origin, contexts, {
      mode: "cancel",
    });
    await page.goto(origin);
    const scan = page.getByRole("button", { name: "Scan & Connect", exact: true });
    await scan.waitFor();
    expect(await page.evaluate(() => window.__webBleTest.requests)).toBe(0);
    await page.getByLabel("Device name (optional)").fill("Sensor");
    await page.getByLabel("Name matching").selectOption("exact");
    await page.getByLabel("Service filter").selectOption("battery");
    await page.getByLabel("Additional Service UUIDs (Optional)").fill("not-a-uuid");
    expect(await scan.isDisabled()).toBe(true);
    await page.getByLabel("Additional Service UUIDs (Optional)").fill("180d");
    await scan.click();
    await page
      .getByText("Device selection cancelled. Adjust the filters and try again.", { exact: true })
      .waitFor();
    const state = await page.evaluate(() => window.__webBleTest);
    expect(state.requests).toBe(1);
    expect(state.userGesture).toBe(true);
    expect(state.options).toMatchObject({
      filters: [{ name: "Sensor", services: ["0000180f-0000-1000-8000-00805f9b34fb"] }],
    });
    expect(state.options?.optionalServices).toContain("0000180d-0000-1000-8000-00805f9b34fb");
    expect(await scan.isEnabled()).toBe(true);
    expect(await page.getByRole("alert").count()).toBe(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  it("reads, writes and browses descriptors through the real adapter", async () => {
    const { page, external, errors } = await openFixture(browser, origin, contexts, {
      mode: "connected",
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    await page
      .getByRole("heading", { name: '<img src=x onerror="window.__webBleXss=true">', exact: true })
      .waitFor();
    expect(await page.locator("img[src=x]").count()).toBe(0);
    expect(await page.evaluate(() => "__webBleXss" in window)).toBe(false);
    const char = page.locator("[data-gatt-uuid]").first();
    await char.getByRole("button", { name: "Read", exact: true }).click();
    await page.getByLabel("Packet format", { exact: true }).selectOption("hex");
    await page
      .locator('[data-log-entry="read"] [data-packet-value]')
      .getByText("4A 2F", { exact: true })
      .waitFor();
    await char.getByLabel("Write payload", { exact: true }).fill("AA BB");
    await char.getByRole("button", { name: "Write (2 B)", exact: true }).click();
    await page
      .locator('[data-log-entry="write"] [data-packet-value]')
      .getByText("AA BB", { exact: true })
      .waitFor();
    await char.getByLabel("Write method").selectOption("no-response");
    await char.getByLabel("Write payload", { exact: true }).fill("01 02");
    await char.getByRole("button", { name: "Write (2 B)", exact: true }).click();
    await char.getByRole("button", { name: "Load descriptors", exact: true }).click();
    const descriptor = char.locator("[data-descriptor-uuid]");
    await descriptor.getByRole("button", { name: "Read", exact: true }).click();
    await page.locator('[data-log-entry="descriptor-read"]').waitFor();
    await descriptor.getByLabel("Input encoding").selectOption("utf8");
    await descriptor.getByLabel("Write payload").fill("Label");
    await descriptor.getByRole("button", { name: "Write (5 B)", exact: true }).click();
    await page.locator('[data-log-entry="descriptor-write"]').waitFor();
    expect(await page.evaluate(() => window.__webBleTest.writes)).toBe(3);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  it("recovers from operation failures without abandoning the connection", async () => {
    const { page } = await openFixture(browser, origin, contexts, { mode: "connected" });
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    const char = page.locator("[data-gatt-uuid]").first();
    await page.evaluate(() => {
      window.__webBleTest.denyRead = true;
    });
    await char.getByRole("button", { name: "Read", exact: true }).click();
    await char.getByRole("alert").waitFor();
    expect(await page.getByRole("button", { name: "Disconnect", exact: true }).isVisible()).toBe(
      true,
    );
    await page.evaluate(() => {
      window.__webBleTest.denyRead = false;
    });
    await char.getByRole("button", { name: "Read", exact: true }).click();
    await page.locator('[data-log-entry="read"]').waitFor();
    expect(await char.getByRole("alert").count()).toBe(0);
  });

  it("removes notification callbacks and keeps bounded logs while supporting pause", async () => {
    const { page, external, errors } = await openFixture(browser, origin, contexts, {
      mode: "connected",
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    const char = page.locator("[data-gatt-uuid]").first();
    await char.getByRole("button", { name: "Subscribe", exact: true }).click();
    await char.getByRole("button", { name: "Stop", exact: true }).waitFor();
    await page.getByLabel("Packet format", { exact: true }).selectOption("hex");
    await page.evaluate(() => {
      for (let i = 0; i < 1005; i++) window.__webBleTest.notify?.();
    });
    await expect.poll(() => page.locator("[data-log-entry]").count()).toBe(1000);
    await expect
      .poll(() =>
        page
          .locator("[data-log-scroll]")
          .evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop),
      )
      .toBeLessThan(3);
    await page.getByLabel("Auto-scroll").uncheck();
    await page.locator("[data-log-scroll]").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.evaluate(() => window.__webBleTest.notify?.());
    expect(await page.locator("[data-log-scroll]").evaluate((element) => element.scrollTop)).toBe(
      0,
    );
    await char.getByRole("button", { name: "Stop", exact: true }).click();
    await char.getByRole("button", { name: "Subscribe", exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear Console", exact: true }).click();
    await page.evaluate(async () => {
      window.__webBleTest.notify?.();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    expect(await page.locator("[data-log-entry]").count()).toBe(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  it("does not confuse subscriptions with duplicated UUIDs", async () => {
    const { page } = await openFixture(browser, origin, contexts, { mode: "duplicate" });
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    const first = page.locator("[data-gatt-uuid]").nth(0);
    const second = page.locator("[data-gatt-uuid]").nth(1);
    await first.getByRole("button", { name: "Subscribe", exact: true }).click();
    expect(await second.getByRole("button", { name: "Subscribe", exact: true }).isVisible()).toBe(
      true,
    );
    await page.evaluate(() => window.__webBleTest.notifySecond?.());
    expect(await page.locator('[data-log-entry="notification"]').count()).toBe(0);
    await second.getByRole("button", { name: "Subscribe", exact: true }).click();
    await page.evaluate(() => window.__webBleTest.notifySecond?.());
    await expect.poll(() => page.locator('[data-log-entry="notification"]').count()).toBe(1);
  });

  it("cancels a pending connection and ignores its late success", async () => {
    const { page } = await openFixture(browser, origin, contexts, { mode: "deferred" });
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    await page.getByRole("button", { name: "Cancel connection", exact: true }).click();
    await page.evaluate(() => window.__webBleTest.resolveConnection?.());
    expect(await page.getByRole("button", { name: "Disconnect", exact: true }).count()).toBe(0);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    await page.getByRole("button", { name: "Disconnect", exact: true }).waitFor();
  });

  it("renders all packet formats and copies the selected representation", async () => {
    const { page } = await openFixture(browser, origin, contexts, { mode: "connected" });
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    await page
      .locator("[data-gatt-uuid]")
      .first()
      .getByRole("button", { name: "Read", exact: true })
      .click();
    const values = {
      "hex-ascii": "4A 2F | J/",
      hex: "4A 2F",
      ascii: "J/",
      utf8: "J/",
      decimal: "74 47",
      binary: "01001010 00101111",
      base64: "Si8=",
      "uint16-le": "12106",
      "uint16-be": "18991",
      json: "4A 2F",
    };
    for (const [format, expected] of Object.entries(values)) {
      await page.getByLabel("Packet format", { exact: true }).selectOption(format);
      await expect
        .poll(() => page.locator('[data-log-entry="read"] [data-packet-value]').textContent())
        .toBe(expected);
    }
    await page
      .getByText("Cannot decode this format. Showing the original Hex.", { exact: true })
      .waitFor();
    await page.getByLabel("Packet format", { exact: true }).selectOption("base64");
    await page.getByLabel("Timestamp format", { exact: true }).selectOption("elapsed");
    await page.getByRole("button", { name: "Copy All", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.__webBleTest.copiedText))
      .toContain("2B Si8=");
    expect(await page.locator('[data-log-entry="read"] time').textContent()).toMatch(
      /^\+\d+\.\d{3}s$/,
    );
  });

  it.each([
    [
      "/",
      "Connection mode",
      "Connect demo device",
      "Read",
      "Write payload",
      "Input encoding",
      "Disconnect",
    ],
    ["/ja/", "接続モード", "確認用機器に接続", "読み取り", "送信データ", "入力形式", "切断"],
  ])(
    "uses the complete demo GATT UI on %s without a Bluetooth implementation",
    async (
      path,
      modeLabel,
      connectLabel,
      readLabel,
      payloadLabel,
      encodingLabel,
      disconnectLabel,
    ) => {
      const { page, external, errors } = await openFixture(browser, origin, contexts);
      await page.goto(origin + path);
      await page.getByLabel(modeLabel, { exact: true }).selectOption("demo");
      await page.getByRole("button", { name: connectLabel, exact: true }).click();
      const sample = page.locator(sampleSelector);
      await sample.getByRole("button", { name: readLabel, exact: true }).click();
      const formatLabel = path === "/" ? "Packet format" : "パケット表示形式";
      await page.getByLabel(formatLabel, { exact: true }).selectOption("json");
      await expect
        .poll(() => page.locator('[data-log-entry="read"] [data-packet-value]').textContent())
        .toContain('"temperature": 23.5');
      await sample.getByLabel(encodingLabel, { exact: true }).selectOption("utf8");
      await sample.getByLabel(payloadLabel, { exact: true }).fill("BLEテスト");
      await sample
        .getByRole("button", {
          name: path === "/" ? "Write (12 B)" : "書き込み (12 B)",
          exact: true,
        })
        .click();
      await page.getByLabel(formatLabel, { exact: true }).selectOption("utf8");
      await page
        .locator('[data-log-entry="write"] [data-packet-value]')
        .getByText("BLEテスト", { exact: true })
        .waitFor();
      await sample
        .getByRole("button", {
          name: path === "/" ? "Load descriptors" : "記述子を表示",
          exact: true,
        })
        .click();
      const descriptor = sample.locator("[data-descriptor-uuid]");
      await descriptor.getByRole("button", { name: readLabel, exact: true }).click();
      await page.locator('[data-log-entry="descriptor-read"]').waitFor();
      await descriptor.getByLabel(encodingLabel, { exact: true }).selectOption("utf8");
      await descriptor.getByLabel(payloadLabel, { exact: true }).fill("Label");
      await descriptor
        .getByRole("button", { name: path === "/" ? "Write (5 B)" : "書き込み (5 B)", exact: true })
        .click();
      await page
        .locator('[data-log-entry="descriptor-write"] [data-packet-value]')
        .getByText("Label", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: disconnectLabel, exact: true }).click();
      expect(await page.locator("[data-log-entry]").count()).toBeGreaterThan(2);
      expect(await page.evaluate(() => window.__webBleTest.requests)).toBe(0);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    },
  );

  it("starts demo by environment and generates notifications only after opt-in", async () => {
    const { page, external, errors } = await openFixture(browser, demoOrigin, contexts);
    await page.goto(demoOrigin);
    expect(await page.getByLabel("Connection mode", { exact: true }).inputValue()).toBe("demo");
    await page.getByLabel("Connection mode", { exact: true }).selectOption("real");
    await page.reload();
    await page.getByRole("button", { name: "Connect demo device", exact: true }).waitFor();
    expect(await page.getByLabel("Connection mode", { exact: true }).inputValue()).toBe("demo");
    expect(await page.locator("[data-gatt-uuid]").count()).toBe(0);
    await page.getByRole("button", { name: "Connect demo device", exact: true }).click();
    const sample = page.locator(sampleSelector);
    await page.clock.install();
    expect(await page.locator('[data-log-entry="notification"]').count()).toBe(0);
    await sample.getByRole("button", { name: "Subscribe", exact: true }).click();
    await page.getByLabel("Packet format", { exact: true }).selectOption("json");
    await page.clock.runFor(1100);
    await expect
      .poll(() => page.locator('[data-log-entry="notification"]').count())
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Generate sample notification", exact: true }).click();
    await page.locator('[data-log-entry="notification"] [data-packet-value]').first().waitFor();
    await sample.getByRole("button", { name: "Stop", exact: true }).click();
    const notificationCount = await page.locator('[data-log-entry="notification"]').count();
    await page.clock.runFor(2100);
    expect(await page.locator('[data-log-entry="notification"]').count()).toBe(notificationCount);
    expect(await page.evaluate(() => window.__webBleTest.requests)).toBe(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  it("keeps capture and identities out of persistent browser storage", async () => {
    const { page } = await openFixture(browser, origin, contexts, { mode: "connected" });
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    await page
      .locator("[data-gatt-uuid]")
      .first()
      .getByRole("button", { name: "Read", exact: true })
      .click();
    const stored = await page.evaluate(() => ({
      values: Object.values(localStorage),
      opens: window.__webBleTest.databaseOpens,
    }));
    expect(stored.opens).toBe(0);
    expect(stored.values.join(" ")).not.toContain("fixture-private-device-id");
    expect(stored.values.join(" ")).not.toContain("onerror");
    await page.reload();
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).waitFor();
    expect(await page.locator("[data-log-entry]").count()).toBe(0);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.getByText("No saved sessions", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
  });

  it("supports demo when optional browser storage is disabled", async () => {
    const { page, errors } = await openFixture(browser, origin, contexts, { blockedStorage: true });
    await page.goto(origin);
    await page.getByLabel("Connection mode", { exact: true }).selectOption("demo");
    await page.getByRole("button", { name: "Connect demo device", exact: true }).click();
    await page.locator(sampleSelector).getByRole("button", { name: "Read", exact: true }).click();
    await page.locator('[data-log-entry="read"]').waitFor();
    expect(errors).toEqual([]);
  });

  it("keeps desktop and mobile demo layouts usable", async () => {
    const { page } = await openFixture(browser, demoOrigin, contexts);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(demoOrigin);
    await page.getByRole("button", { name: "Connect demo device", exact: true }).click();
    await page.locator(sampleSelector).getByRole("button", { name: "Read", exact: true }).click();
    await page.getByLabel("Packet format", { exact: true }).selectOption("json");
    if (process.env.WEB_BLE_SCREENSHOT_DIR) {
      await mkdir(process.env.WEB_BLE_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: join(process.env.WEB_BLE_SCREENSHOT_DIR, "demo-desktop.png"),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator("astro-island").count()).toBe(1);
    expect(await page.getByLabel("Connection mode", { exact: true }).count()).toBe(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (process.env.WEB_BLE_SCREENSHOT_DIR) {
      await page.screenshot({
        path: join(process.env.WEB_BLE_SCREENSHOT_DIR, "demo-mobile.png"),
        fullPage: false,
      });
      await page.getByRole("region", { name: "Data Log", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(process.env.WEB_BLE_SCREENSHOT_DIR, "demo-mobile-log.png"),
        fullPage: false,
      });
    }
  });
});
