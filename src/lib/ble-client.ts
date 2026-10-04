import { buildRequestOptions, copyPacket, isGattWriteAllowed } from "./ble-input";
import type {
  ConnectionMode,
  GattCharacteristic,
  GattDescriptor,
  GattServer,
  PeripheralDevice,
  SearchOptions,
} from "./gatt-types";
import type { ServiceInfo } from "./types";

const queues = new WeakMap<GattServer, Promise<void>>();
function enqueue<T>(server: GattServer, action: () => Promise<T>): Promise<T> {
  const result = (queues.get(server) ?? Promise.resolve()).then(action);
  queues.set(
    server,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}

export class BluetoothManager {
  readonly mode: ConnectionMode = "real";
  protected device: PeripheralDevice | null = null;
  private disposed = false;
  private subscriptions = new Map<GattCharacteristic, EventListener>();

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  protected rememberDevice(device: PeripheralDevice): PeripheralDevice {
    if (this.disposed) throw new DOMException("Cancelled", "AbortError");
    this.device = device;
    return device;
  }

  async scan(search: SearchOptions): Promise<PeripheralDevice | null> {
    const options = buildRequestOptions(search);
    if (!BluetoothManager.isSupported()) throw new DOMException("Unavailable", "NotSupportedError");
    try {
      return this.rememberDevice(await navigator.bluetooth.requestDevice(options));
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") return null;
      throw error;
    }
  }

  async connect(device: PeripheralDevice): Promise<void> {
    this.rememberDevice(device);
    if (!device.gatt) throw new DOMException("No GATT", "NotSupportedError");
    const gatt = device.gatt;
    await enqueue(gatt, async () => {
      if (this.disposed) throw new DOMException("Cancelled", "AbortError");
      const server = gatt.connected ? gatt : await gatt.connect();
      if (this.disposed) {
        server.disconnect();
        throw new DOMException("Cancelled", "AbortError");
      }
    });
  }

  private operation<T>(action: () => Promise<T>): Promise<T> {
    const server = this.device?.gatt;
    if (!server) return Promise.reject(new DOMException("Disconnected", "InvalidStateError"));
    return enqueue(server, async () => {
      if (this.disposed || !server.connected)
        throw new DOMException("Disconnected", "InvalidStateError");
      const value = await action();
      if (this.disposed) throw new DOMException("Cancelled", "AbortError");
      return value;
    });
  }

  async discover(): Promise<ServiceInfo[]> {
    return this.operation(async () => {
      const services = await this.device!.gatt!.getPrimaryServices();
      const result: ServiceInfo[] = [];
      for (const [serviceIndex, service] of services.entries()) {
        if (this.disposed) throw new DOMException("Cancelled", "AbortError");
        const characteristics = await service.getCharacteristics();
        const id = `${service.uuid}:${serviceIndex}`;
        result.push({
          id,
          uuid: service.uuid,
          characteristics: characteristics.map((instance, index) => ({
            id: `${id}/${instance.uuid}:${index}`,
            uuid: instance.uuid,
            instance,
            properties: {
              read: !!instance.properties.read,
              write: !!instance.properties.write,
              writeWithoutResponse: !!instance.properties.writeWithoutResponse,
              notify: !!instance.properties.notify,
              indicate: !!instance.properties.indicate,
            },
          })),
        });
      }
      return result;
    });
  }

  read(characteristic: GattCharacteristic): Promise<DataView> {
    return this.operation(async () => {
      if (!characteristic.properties.read)
        throw new DOMException("Read unavailable", "NotSupportedError");
      return copyPacket(await characteristic.readValue());
    });
  }

  async write(
    characteristic: GattCharacteristic,
    bytes: Uint8Array<ArrayBuffer>,
    response: boolean,
  ): Promise<void> {
    const payload = new Uint8Array(
      copyPacket(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)).buffer,
    );
    return this.operation(async () => {
      if (response) {
        if (!isGattWriteAllowed(characteristic.uuid))
          throw new DOMException("Write blocked", "NotSupportedError");
        if (
          !characteristic.properties.write ||
          typeof characteristic.writeValueWithResponse !== "function"
        )
          throw new DOMException("Write unavailable", "NotSupportedError");
        await characteristic.writeValueWithResponse(payload);
      } else {
        if (!isGattWriteAllowed(characteristic.uuid))
          throw new DOMException("Write blocked", "NotSupportedError");
        if (
          !characteristic.properties.writeWithoutResponse ||
          typeof characteristic.writeValueWithoutResponse !== "function"
        )
          throw new DOMException("Write unavailable", "NotSupportedError");
        await characteristic.writeValueWithoutResponse(payload);
      }
    });
  }

  descriptors(characteristic: GattCharacteristic): Promise<GattDescriptor[]> {
    return this.operation(() => characteristic.getDescriptors());
  }
  readDescriptor(descriptor: GattDescriptor): Promise<DataView> {
    return this.operation(async () => copyPacket(await descriptor.readValue()));
  }
  async writeDescriptor(descriptor: GattDescriptor, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    const payload = new Uint8Array(
      copyPacket(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)).buffer,
    );
    return this.operation(() => {
      if (!isGattWriteAllowed(descriptor.uuid))
        throw new DOMException("Write blocked", "NotSupportedError");
      return descriptor.writeValue(payload);
    });
  }

  async startNotifications(
    characteristic: GattCharacteristic,
    callback: (data: DataView) => void,
    invalid: () => void = () => {},
  ): Promise<void> {
    return this.operation(async () => {
      if (this.subscriptions.has(characteristic)) return;
      if (!characteristic.properties.notify && !characteristic.properties.indicate)
        throw new DOMException("Notifications unavailable", "NotSupportedError");
      const handler: EventListener = () => {
        if (
          this.disposed ||
          !this.device?.gatt?.connected ||
          !this.subscriptions.has(characteristic) ||
          !characteristic.value
        )
          return;
        try {
          callback(copyPacket(characteristic.value));
        } catch {
          invalid();
        }
      };
      this.subscriptions.set(characteristic, handler);
      characteristic.addEventListener("characteristicvaluechanged", handler);
      try {
        await characteristic.startNotifications();
        if (this.disposed) {
          await characteristic.stopNotifications().catch(() => {});
          throw new DOMException("Cancelled", "AbortError");
        }
      } catch (error) {
        characteristic.removeEventListener("characteristicvaluechanged", handler);
        this.subscriptions.delete(characteristic);
        throw error;
      }
    });
  }

  async stopNotifications(characteristic: GattCharacteristic): Promise<void> {
    const handler = this.subscriptions.get(characteristic);
    if (handler) characteristic.removeEventListener("characteristicvaluechanged", handler);
    this.subscriptions.delete(characteristic);
    return this.operation(async () => {
      await characteristic.stopNotifications();
    });
  }

  generatePacket(): void {
    /* Real devices produce their own values. */
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [characteristic, handler] of this.subscriptions) {
      characteristic.removeEventListener("characteristicvaluechanged", handler);
    }
    this.subscriptions.clear();
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }
}
