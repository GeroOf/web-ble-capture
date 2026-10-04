import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoBluetoothManager, DEMO_CHARACTERISTIC_UUID } from "./demo-ble";
import { DEFAULT_SEARCH } from "./gatt-types";
import { parseWriteValue } from "./ble-input";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("hardware-free GATT", () => {
  it("connects, explores, reads and writes without invoking a real Bluetooth API", async () => {
    const requestDevice = vi.fn();
    vi.stubGlobal("navigator", { bluetooth: { requestDevice } });
    const manager = new DemoBluetoothManager();
    const device = await manager.scan(DEFAULT_SEARCH);
    await manager.connect(device);
    const services = await manager.discover();
    expect(services).toHaveLength(2);
    const sample = services
      .flatMap((service) => service.characteristics)
      .find((char) => char.uuid === DEMO_CHARACTERISTIC_UUID)!;
    expect(JSON.parse(new TextDecoder().decode(await manager.read(sample.instance))).seq).toBe(0);
    await manager.write(sample.instance, parseWriteValue("こんにちは", "utf8"), true);
    expect(new TextDecoder().decode(await manager.read(sample.instance))).toBe("こんにちは");
    await manager.write(sample.instance, Uint8Array.of(7, 9), false);
    expect([...new Uint8Array((await manager.read(sample.instance)).buffer)]).toEqual([7, 9]);
    const [descriptor] = await manager.descriptors(sample.instance);
    await manager.writeDescriptor(descriptor!, parseWriteValue("label", "utf8"));
    expect(new TextDecoder().decode(await manager.readDescriptor(descriptor!))).toBe("label");
    expect(requestDevice).not.toHaveBeenCalled();
    manager.dispose();
  });
  it("generates deterministic samples only while subscribed and cleans timers", async () => {
    vi.useFakeTimers();
    const manager = new DemoBluetoothManager();
    await manager.connect(await manager.scan(DEFAULT_SEARCH));
    const sample = (await manager.discover())[1]!.characteristics[0]!.instance;
    const values = vi.fn();
    manager.generatePacket();
    expect(values).not.toHaveBeenCalled();
    await manager.startNotifications(sample, values);
    await manager.startNotifications(sample, values);
    await vi.advanceTimersByTimeAsync(1000);
    expect(values).toHaveBeenCalledTimes(1);
    expect(JSON.parse(new TextDecoder().decode(values.mock.calls[0]![0] as DataView)).seq).toBe(1);
    await manager.stopNotifications(sample);
    manager.generatePacket();
    await vi.advanceTimersByTimeAsync(2000);
    expect(values).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    manager.dispose();
  });
  it("enforces read-only capabilities and disconnected access", async () => {
    const manager = new DemoBluetoothManager();
    await manager.connect(await manager.scan(DEFAULT_SEARCH));
    const battery = (await manager.discover())[0]!.characteristics[0]!.instance;
    await expect(manager.write(battery, Uint8Array.of(1), true)).rejects.toMatchObject({
      name: "NotSupportedError",
    });
    manager.dispose();
    await expect(manager.read(battery)).rejects.toMatchObject({ name: "InvalidStateError" });
  });
  it("applies name and service filters to the fixed peripheral", async () => {
    const manager = new DemoBluetoothManager();
    await expect(manager.scan({ ...DEFAULT_SEARCH, name: "Other" })).rejects.toThrow("noMatch");
    await expect(
      manager.scan({ ...DEFAULT_SEARCH, name: "Web BLE", service: "180f" }),
    ).resolves.toMatchObject({ name: "Web BLE Demo" });
    manager.dispose();
  });
});
