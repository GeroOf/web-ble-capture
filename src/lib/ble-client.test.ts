import { describe, expect, it, vi } from "vitest";
import { BluetoothManager } from "./ble-client";
import { normalizeServiceUuid } from "./ble-input";
import type {
  GattCharacteristic,
  GattDescriptor,
  GattProperties,
  GattServer,
  GattService,
  PeripheralDevice,
} from "./gatt-types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
class Characteristic extends EventTarget implements GattCharacteristic {
  readonly uuid = normalizeServiceUuid("ab01");
  readonly service = { uuid: normalizeServiceUuid("ab00") };
  properties: GattProperties = {
    read: true,
    write: true,
    writeWithoutResponse: true,
    notify: true,
    indicate: false,
  };
  value = new DataView(Uint8Array.of(1, 2).buffer);
  readValue = vi.fn(async () => this.value);
  writeValueWithResponse = vi.fn(async (_value: BufferSource) => {});
  writeValueWithoutResponse = vi.fn(async (_value: BufferSource) => {});
  getDescriptors = vi.fn(async (): Promise<GattDescriptor[]> => []);
  startNotifications = vi.fn(async (): Promise<GattCharacteristic> => this);
  stopNotifications = vi.fn(async (): Promise<GattCharacteristic> => this);
  emit() {
    this.dispatchEvent(new Event("characteristicvaluechanged"));
  }
}
function fixture() {
  const first = new Characteristic();
  const second = new Characteristic();
  const service: GattService = {
    uuid: first.service.uuid,
    getCharacteristics: async () => [first, second],
  };
  const server = {
    connected: false,
    connect: vi.fn(async (): Promise<GattServer> => {
      server.connected = true;
      return server;
    }),
    disconnect: vi.fn(() => {
      server.connected = false;
    }),
    getPrimaryServices: async () => [service],
  };
  const device: PeripheralDevice = Object.assign(new EventTarget(), {
    id: "fixture",
    gatt: server,
  });
  return { first, second, server, device, manager: new BluetoothManager() };
}

describe("GATT session lifecycle", () => {
  it("supports indication-only values", async () => {
    const { manager, device, first } = fixture();
    await manager.connect(device);
    first.properties = { ...first.properties, notify: false, indicate: true };
    const values = vi.fn();
    await manager.startNotifications(first, values);
    first.emit();
    expect(values).toHaveBeenCalledTimes(1);
    manager.dispose();
  });
  it("stops a subscription that succeeds after cancellation", async () => {
    const { manager, device, first } = fixture();
    await manager.connect(device);
    const pending = deferred<GattCharacteristic>();
    first.startNotifications.mockImplementationOnce(() => pending.promise);
    const values = vi.fn();
    const result = manager.startNotifications(first, values).catch((error) => error);
    await Promise.resolve();
    manager.dispose();
    pending.resolve(first);
    expect(await result).toMatchObject({ name: "AbortError" });
    first.emit();
    expect(values).not.toHaveBeenCalled();
    expect(first.stopNotifications).toHaveBeenCalled();
  });
  it("identifies duplicate UUID instances separately", async () => {
    const { manager, device } = fixture();
    await manager.connect(device);
    const graph = await manager.discover();
    expect(graph[0]!.characteristics[0]!.id).not.toBe(graph[0]!.characteristics[1]!.id);
    manager.dispose();
  });
  it("serializes operations and sends immutable writes through the selected method", async () => {
    const { manager, device, first, second } = fixture();
    await manager.connect(device);
    const pending = deferred<DataView<ArrayBuffer>>();
    first.readValue.mockImplementationOnce(() => pending.promise);
    const read = manager.read(first);
    await Promise.resolve();
    const bytes = Uint8Array.of(10, 20);
    const write = manager.write(second, bytes, false);
    bytes.fill(99);
    expect(second.writeValueWithoutResponse).not.toHaveBeenCalled();
    pending.resolve(first.value);
    await read;
    await write;
    const value = second.writeValueWithoutResponse.mock.calls[0]![0] as Uint8Array;
    expect([...value]).toEqual([10, 20]);
    expect(second.writeValueWithResponse).not.toHaveBeenCalled();
    manager.dispose();
  });
  it("recovers the queue after a failed operation and enforces capabilities", async () => {
    const { manager, device, first } = fixture();
    await manager.connect(device);
    first.readValue.mockRejectedValueOnce(new DOMException("Denied", "SecurityError"));
    await expect(manager.read(first)).rejects.toMatchObject({ name: "SecurityError" });
    await expect(manager.read(first)).resolves.toBeInstanceOf(DataView);
    first.properties = { ...first.properties, write: false };
    await expect(manager.write(first, Uint8Array.of(1), true)).rejects.toMatchObject({
      name: "NotSupportedError",
    });
    expect(first.writeValueWithResponse).not.toHaveBeenCalled();
    manager.dispose();
  });
  it("detaches subscription callbacks and copies received buffers", async () => {
    const { manager, device, first } = fixture();
    await manager.connect(device);
    const receiver = vi.fn();
    await manager.startNotifications(first, receiver);
    first.emit();
    expect(receiver).toHaveBeenCalledTimes(1);
    first.value.setUint8(0, 9);
    expect((receiver.mock.calls[0]![0] as DataView).getUint8(0)).toBe(1);
    await manager.stopNotifications(first);
    first.emit();
    expect(receiver).toHaveBeenCalledTimes(1);
    await manager.startNotifications(first, receiver);
    manager.dispose();
    first.emit();
    expect(receiver).toHaveBeenCalledTimes(1);
  });
  it("does not retain callbacks after a failed subscription", async () => {
    const { manager, device, first } = fixture();
    await manager.connect(device);
    first.startNotifications.mockRejectedValueOnce(new Error("Failure"));
    const receiver = vi.fn();
    await expect(manager.startNotifications(first, receiver)).rejects.toThrow();
    first.emit();
    expect(receiver).not.toHaveBeenCalled();
    await manager.startNotifications(first, receiver);
    first.emit();
    expect(receiver).toHaveBeenCalledTimes(1);
    manager.dispose();
  });
  it("rejects late reads after disconnect without updating consumers", async () => {
    const { manager, device, first } = fixture();
    await manager.connect(device);
    const pending = deferred<DataView<ArrayBuffer>>();
    first.readValue.mockImplementationOnce(() => pending.promise);
    const result = manager.read(first).catch((error) => error);
    await Promise.resolve();
    manager.dispose();
    pending.resolve(first.value);
    expect(await result).toMatchObject({ name: "AbortError" });
  });
  it("finishes cleanup of cancelled connects before reconnecting the same server", async () => {
    const { manager, device, server } = fixture();
    const pending = deferred<GattServer>();
    server.connect.mockImplementationOnce(() => pending.promise);
    const old = manager.connect(device).catch((error) => error);
    await Promise.resolve();
    manager.dispose();
    const replacement = new BluetoothManager();
    const next = replacement.connect(device);
    expect(server.connect).toHaveBeenCalledTimes(1);
    server.connected = true;
    pending.resolve(server);
    expect(await old).toMatchObject({ name: "AbortError" });
    await next;
    expect(server.connected).toBe(true);
    expect(server.connect).toHaveBeenCalledTimes(2);
    replacement.dispose();
  });
  it("blocks configuration descriptor writes and oversized values before native calls", async () => {
    const { manager, device, first } = fixture();
    await manager.connect(device);
    const descriptor: GattDescriptor = {
      uuid: normalizeServiceUuid("2902"),
      readValue: async () => first.value,
      writeValue: vi.fn(async () => {}),
    };
    await expect(manager.writeDescriptor(descriptor, Uint8Array.of(1, 0))).rejects.toMatchObject({
      name: "NotSupportedError",
    });
    expect(descriptor.writeValue).not.toHaveBeenCalled();
    await expect(manager.write(first, new Uint8Array(513), true)).rejects.toThrow("size");
    expect(first.writeValueWithResponse).not.toHaveBeenCalled();
    manager.dispose();
  });
});
