import { execFile } from "node:child_process";
import { readFile, stat, mkdtemp } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

declare global {
  interface Window {
    __webBleTest: { requests: number; notify?: () => void };
  }
}

const execute = promisify(execFile);
const contexts: BrowserContext[] = [];
let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  const output = await mkdtemp(join(tmpdir(), "web-ble-e2e-"));
  const buildArgs = ["run", "build", "--", "--outDir", output];
  const npmCli = process.env.npm_execpath;
  await execute(npmCli ? process.execPath : "npm", npmCli ? [npmCli, ...buildArgs] : buildArgs, {
    cwd: process.cwd(),
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", PUBLIC_GA_ID: "" },
  });
  const mime: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".json": "application/json",
  };
  server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
      let file = resolve(output, `.${path}`);
      if (file !== output && !file.startsWith(output + sep)) throw new Error("invalid path");
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing server port");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});

afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  await browser?.close();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function openPage(
  javaScriptEnabled = true,
  mode: "unsupported" | "cancel" | "connected" = "unsupported",
) {
  const context = await browser.newContext({ javaScriptEnabled });
  contexts.push(context);
  const external: string[] = [];
  await context.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((mode) => {
    window.__webBleTest = { requests: 0 };
    if (mode === "unsupported") {
      Object.defineProperty(navigator, "bluetooth", { value: undefined, configurable: true });
      return;
    }
    class Characteristic extends EventTarget {
      uuid = "00002a19-0000-1000-8000-00805f9b34fb";
      properties = { notify: true, indicate: false, read: false, write: false };
      value = new DataView(new Uint8Array([0xaa, 0x4a, 0x2f, 0xbb]).buffer, 1, 2);
      service = { uuid: "0000180f-0000-1000-8000-00805f9b34fb" };
      async startNotifications() {
        return this;
      }
      async stopNotifications() {
        return this;
      }
    }
    const characteristic = new Characteristic();
    const device = Object.assign(new EventTarget(), {
      id: "fixture-device",
      name: '<img src=x onerror="window.__webBleXss=true">',
      gatt: {
        connected: false,
        async connect() {
          this.connected = true;
          return this;
        },
        async getPrimaryServices() {
          return [
            { uuid: characteristic.service.uuid, getCharacteristics: async () => [characteristic] },
          ];
        },
        disconnect() {
          this.connected = false;
          device.dispatchEvent(new Event("gattserverdisconnected"));
        },
      },
    });
    window.__webBleTest.notify = () =>
      characteristic.dispatchEvent(new Event("characteristicvaluechanged"));
    Object.defineProperty(navigator, "bluetooth", {
      value: {
        async requestDevice() {
          window.__webBleTest.requests++;
          if (mode === "cancel") throw new DOMException("Cancelled", "NotFoundError");
          return device;
        },
      },
      configurable: true,
    });
  }, mode);
  return { page, external, errors };
}

describe("updated SSG application", () => {
  it.each([
    ["/", "en", "Browser Not Supported", "JavaScript is required to use the Web Bluetooth API."],
    ["/ja/", "ja", "ブラウザ非対応", "Web Bluetooth API を利用するには JavaScript が必要です。"],
  ])(
    "keeps %s usable without Bluetooth or JavaScript",
    async (path, locale, fallback, noscript) => {
      const supported = await openPage();
      await supported.page.goto(origin + path);
      await supported.page.getByText(fallback, { exact: true }).waitFor({ state: "visible" });
      expect(await supported.page.locator("html").getAttribute("lang")).toBe(locale);
      const metadata = await supported.page
        .locator('script[type="application/ld+json"]')
        .textContent();
      expect(JSON.parse(metadata ?? "")["@type"]).toBe("WebApplication");
      expect(supported.errors).toEqual([]);
      expect(supported.external).toEqual([]);

      const disabled = await openPage(false);
      await disabled.page.goto(origin + path);
      await disabled.page.getByText(noscript, { exact: true }).waitFor({ state: "visible" });
      expect(disabled.external).toEqual([]);
    },
  );

  it("requests Bluetooth only on click and recovers after cancellation", async () => {
    const { page, external, errors } = await openPage(true, "cancel");
    await page.goto(origin);
    const scan = page.getByRole("button", { name: "Scan & Connect", exact: true });
    await scan.waitFor({ state: "visible" });
    expect(await page.evaluate(() => window.__webBleTest.requests)).toBe(0);
    await scan.click();
    await page
      .getByText("Connection failed: Cancelled", { exact: true })
      .waitFor({ state: "visible" });
    expect(await page.evaluate(() => window.__webBleTest.requests)).toBe(1);
    expect(await scan.isEnabled()).toBe(true);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  it("receives notifications, escapes device text and stops the subscription", async () => {
    const { page, external, errors } = await openPage(true, "connected");
    await page.goto(origin);
    await page.getByRole("button", { name: "Scan & Connect", exact: true }).click();
    await page
      .getByRole("heading", { name: '<img src=x onerror="window.__webBleXss=true">', exact: true })
      .waitFor();
    expect(await page.locator("img[src=x]").count()).toBe(0);
    expect(await page.evaluate(() => "__webBleXss" in window)).toBe(false);
    await page.getByRole("button", { name: "Subscribe", exact: true }).click();
    await page.getByRole("button", { name: "Stop", exact: true }).waitFor();
    await page.evaluate(() => window.__webBleTest.notify?.());
    await page.getByText("4A 2F", { exact: true }).waitFor();
    expect(await page.getByText("AA 4A 2F BB", { exact: true }).count()).toBe(0);
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await page.getByRole("button", { name: "Subscribe", exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear Console", exact: true }).click();
    await page.evaluate(async () => {
      window.__webBleTest.notify?.();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    expect(await page.getByText("4A 2F", { exact: true }).count()).toBe(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});
