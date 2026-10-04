import { execFile } from "node:child_process";
import { readFile, stat, mkdtemp } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import type { Browser, BrowserContext } from "playwright";

export interface BrowserFixtureState {
  requests: number;
  userGesture: boolean;
  options?: RequestDeviceOptions;
  notify?: () => void;
  notifySecond?: () => void;
  resolveConnection?: () => void;
  copiedText: string;
  databaseOpens: number;
  denyRead: boolean;
  writes: number;
}
declare global {
  interface Window {
    __webBleTest: BrowserFixtureState;
  }
}
const execute = promisify(execFile);

export async function buildServer(demo: boolean): Promise<{ server: Server; origin: string }> {
  const output = await mkdtemp(join(tmpdir(), "web-ble-e2e-"));
  const args = ["run", "build", "--", "--outDir", output];
  const npmCli = process.env.npm_execpath;
  await execute(npmCli ? process.execPath : "npm", npmCli ? [npmCli, ...args] : args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: "1",
      PUBLIC_BLE_DEMO: demo ? "true" : "",
      PUBLIC_GA_ID: "G-TEST-NO-TRANSMISSION",
    },
  });
  const mime: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".json": "application/json",
  };
  const server = createServer(async (request, response) => {
    try {
      let file = resolve(
        output,
        `.${decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)}`,
      );
      if (file !== output && !file.startsWith(output + sep)) throw new Error("invalid path");
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing server port");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

export type FixtureMode = "unsupported" | "cancel" | "connected" | "deferred" | "duplicate";
export async function openFixture(
  browser: Browser,
  origin: string,
  contexts: BrowserContext[],
  options: { mode?: FixtureMode; javaScriptEnabled?: boolean; blockedStorage?: boolean } = {},
) {
  const context = await browser.newContext({
    javaScriptEnabled: options.javaScriptEnabled ?? true,
  });
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
  await page.addInitScript(
    ({ mode, blockedStorage }) => {
      Object.defineProperty(navigator, "bluetooth", { configurable: true, value: undefined });
      window.__webBleTest = {
        requests: 0,
        userGesture: false,
        copiedText: "",
        databaseOpens: 0,
        denyRead: false,
        writes: 0,
      };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            window.__webBleTest.copiedText = text;
          },
        },
      });
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (...args) {
        window.__webBleTest.databaseOpens++;
        return open.apply(this, args);
      };
      if (blockedStorage)
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          get() {
            throw new DOMException("Blocked", "SecurityError");
          },
        });
      if (mode === "unsupported") {
        Object.defineProperty(navigator, "bluetooth", { configurable: true, value: undefined });
        return;
      }
      function data(value: BufferSource): DataView<ArrayBuffer> {
        const bytes = ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : new Uint8Array(value);
        return new DataView(new Uint8Array(bytes).buffer);
      }
      class Descriptor {
        uuid = "00002901-0000-1000-8000-00805f9b34fb";
        value = data(new TextEncoder().encode("Fixture description"));
        async readValue() {
          return this.value;
        }
        async writeValue(bytes: BufferSource) {
          this.value = data(bytes);
          window.__webBleTest.writes++;
        }
      }
      class Characteristic extends EventTarget {
        uuid = "00002a19-0000-1000-8000-00805f9b34fb";
        properties = {
          notify: true,
          indicate: false,
          read: true,
          write: true,
          writeWithoutResponse: true,
        };
        value = new DataView(new Uint8Array([0xaa, 0x4a, 0x2f, 0xbb]).buffer, 1, 2);
        service = { uuid: "0000180f-0000-1000-8000-00805f9b34fb" };
        descriptor = new Descriptor();
        async startNotifications() {
          return this;
        }
        async stopNotifications() {
          return this;
        }
        async readValue() {
          if (window.__webBleTest.denyRead) throw new DOMException("Denied", "SecurityError");
          return this.value;
        }
        async writeValueWithResponse(bytes: BufferSource) {
          this.value = data(bytes);
          window.__webBleTest.writes++;
        }
        async writeValueWithoutResponse(bytes: BufferSource) {
          this.value = data(bytes);
          window.__webBleTest.writes++;
        }
        async getDescriptors() {
          return [this.descriptor];
        }
      }
      const characteristic = new Characteristic();
      const second = new Characteristic();
      second.value = data(Uint8Array.of(1, 2));
      let deferred = mode === "deferred";
      const device = Object.assign(new EventTarget(), {
        id: "fixture-private-device-id",
        name: '<img src=x onerror="window.__webBleXss=true">',
        gatt: {
          connected: false,
          async connect() {
            if (deferred) {
              deferred = false;
              await new Promise<void>((resolve) => {
                window.__webBleTest.resolveConnection = resolve;
              });
            }
            this.connected = true;
            return this;
          },
          async getPrimaryServices() {
            return [
              {
                uuid: characteristic.service.uuid,
                getCharacteristics: async () =>
                  mode === "duplicate" ? [characteristic, second] : [characteristic],
              },
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
      window.__webBleTest.notifySecond = () =>
        second.dispatchEvent(new Event("characteristicvaluechanged"));
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: {
          async requestDevice(request: RequestDeviceOptions) {
            window.__webBleTest.requests++;
            window.__webBleTest.options = request;
            window.__webBleTest.userGesture = navigator.userActivation.isActive;
            if (mode === "cancel") throw new DOMException("Cancelled", "NotFoundError");
            return device;
          },
        },
      });
    },
    { mode: options.mode ?? "unsupported", blockedStorage: options.blockedStorage ?? false },
  );
  return { page, external, errors };
}
