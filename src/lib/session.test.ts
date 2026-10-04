import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { addLog, bleState, clearLogs, disconnectState, resetState, setDevice } from "./store";
import { localPrefs, logStorage, MAX_SESSIONS } from "./storage";
import type { PeripheralDevice } from "./gatt-types";

const device: PeripheralDevice = Object.assign(new EventTarget(), {
  id: "private-device-id",
  name: "Private device name",
});
beforeEach(() => {
  resetState();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bounded memory capture", () => {
  it("retains exactly the newest 1000 packets as immutable snapshots", async () => {
    setDevice(device, "real", []);
    const bytes = Uint8Array.of(1);
    for (let index = 0; index < 1005; index++)
      addLog({ timestamp: index, type: "notification", data: new DataView(bytes.buffer) });
    bytes[0] = 255;
    expect(bleState.value.logs).toHaveLength(1000);
    expect(bleState.value.logs[0]?.timestamp).toBe(5);
    expect(bleState.value.logs.at(-1)?.data?.getUint8(0)).toBe(1);
    expect(await logStorage.getLogsForSession(bleState.value.sessionId!)).toHaveLength(1000);
  });
  it("does not store device identities or use persistent capture storage", async () => {
    const setItem = vi.fn();
    const open = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem });
    vi.stubGlobal("indexedDB", { open });
    setDevice(device, "real", []);
    addLog({ timestamp: 1, type: "read", data: new DataView(Uint8Array.of(3).buffer) });
    const records = await logStorage.getSessions();
    expect(JSON.stringify(records)).not.toContain(device.id);
    expect(JSON.stringify(records)).not.toContain(device.name);
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it("keeps the last capture available after disconnect and allows explicit clear", () => {
    setDevice(device, "demo", []);
    addLog({ timestamp: 1, type: "read" });
    disconnectState();
    expect(bleState.value.device).toBeNull();
    expect(bleState.value.logs).toHaveLength(1);
    clearLogs();
    expect(bleState.value.logs).toHaveLength(0);
  });
  it("bounds session history and returns copies to readers", async () => {
    for (let index = 0; index < MAX_SESSIONS + 2; index++)
      logStorage.startSession(`bounded-${index}`, "demo");
    const records = await logStorage.getSessions();
    expect(records).toHaveLength(MAX_SESSIONS);
    expect(records[0]?.id).toBe("bounded-21");
    records[0]!.logCount = 9000;
    expect((await logStorage.getSessions())[0]?.logCount).toBe(0);
  });
  it("remains usable when presentation storage is disabled", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem() {
        throw new Error("Quota");
      },
    });
    expect(localPrefs.mode).toBeNull();
    expect(localPrefs.packetFormat).toBe("hex-ascii");
    expect(() => {
      localPrefs.mode = "demo";
    }).not.toThrow();
  });
});
