import { BluetoothManager } from "./ble-client";
import { BleInputError, buildRequestOptions, copyPacket, normalizeServiceUuid } from "./ble-input";
import type {
  GattCharacteristic,
  GattDescriptor,
  GattProperties,
  GattServer,
  GattService,
  PeripheralDevice,
  SearchOptions,
} from "./gatt-types";

export const DEMO_SERVICE_UUID = "7b100001-9a24-4d0a-a4be-112233445566";
export const DEMO_CHARACTERISTIC_UUID = "7b100002-9a24-4d0a-a4be-112233445566";
const BATTERY_SERVICE = normalizeServiceUuid("180f");
const BATTERY_CHARACTERISTIC = normalizeServiceUuid("2a19");

function view(bytes: BufferSource): DataView {
  return copyPacket(
    ArrayBuffer.isView(bytes)
      ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : new DataView(bytes),
  );
}

class DemoDescriptor implements GattDescriptor {
  readonly uuid = normalizeServiceUuid("2901");
  private value = view(new TextEncoder().encode("Demo value"));
  constructor(private connected: () => boolean) {}
  private check(): void {
    if (!this.connected()) throw new DOMException("Disconnected", "InvalidStateError");
  }
  async readValue(): Promise<DataView> {
    this.check();
    return copyPacket(this.value);
  }
  async writeValue(bytes: BufferSource): Promise<void> {
    this.check();
    this.value = view(bytes);
  }
}

class DemoCharacteristic extends EventTarget implements GattCharacteristic {
  value: DataView;
  private interval: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private descriptor: DemoDescriptor;
  constructor(
    readonly uuid: string,
    readonly service: { uuid: string },
    readonly properties: GattProperties,
    private connected: () => boolean,
    private battery = false,
  ) {
    super();
    this.descriptor = new DemoDescriptor(connected);
    this.value = battery
      ? view(Uint8Array.of(87))
      : view(new TextEncoder().encode('{"seq":0,"temperature":23.5}'));
  }
  private check(): void {
    if (!this.connected()) throw new DOMException("Disconnected", "InvalidStateError");
  }
  async readValue(): Promise<DataView> {
    this.check();
    return copyPacket(this.value);
  }
  async writeValueWithResponse(bytes: BufferSource): Promise<void> {
    this.check();
    if (!this.properties.write) throw new DOMException("Read only", "NotSupportedError");
    this.value = view(bytes);
  }
  async writeValueWithoutResponse(bytes: BufferSource): Promise<void> {
    this.check();
    if (!this.properties.writeWithoutResponse)
      throw new DOMException("Read only", "NotSupportedError");
    this.value = view(bytes);
  }
  async getDescriptors(): Promise<GattDescriptor[]> {
    this.check();
    return [this.descriptor];
  }
  async startNotifications(): Promise<GattCharacteristic> {
    this.check();
    if (!this.interval) this.interval = setInterval(() => this.emit(), 1000);
    return this;
  }
  async stopNotifications(): Promise<GattCharacteristic> {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    return this;
  }
  emit(): void {
    if (!this.connected() || !this.interval) return;
    this.sequence++;
    this.value = this.battery
      ? view(Uint8Array.of(87 - (this.sequence % 10)))
      : view(
          new TextEncoder().encode(
            JSON.stringify({ seq: this.sequence, temperature: 23.5 + (this.sequence % 5) / 10 }),
          ),
        );
    this.dispatchEvent(new Event("characteristicvaluechanged"));
  }
}

class DemoServer implements GattServer {
  connected = false;
  readonly characteristics: DemoCharacteristic[];
  private services: GattService[];
  constructor(private device: EventTarget) {
    const battery = new DemoCharacteristic(
      BATTERY_CHARACTERISTIC,
      { uuid: BATTERY_SERVICE },
      { read: true, write: false, writeWithoutResponse: false, notify: true, indicate: false },
      () => this.connected,
      true,
    );
    const sample = new DemoCharacteristic(
      DEMO_CHARACTERISTIC_UUID,
      { uuid: DEMO_SERVICE_UUID },
      { read: true, write: true, writeWithoutResponse: true, notify: true, indicate: true },
      () => this.connected,
    );
    this.characteristics = [battery, sample];
    this.services = this.characteristics.map((characteristic) => ({
      uuid: characteristic.service.uuid,
      getCharacteristics: async () => [characteristic],
    }));
  }
  async connect(): Promise<GattServer> {
    this.connected = true;
    return this;
  }
  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    for (const characteristic of this.characteristics) void characteristic.stopNotifications();
    this.device.dispatchEvent(new Event("gattserverdisconnected"));
  }
  async getPrimaryServices(): Promise<GattService[]> {
    if (!this.connected) throw new DOMException("Disconnected", "InvalidStateError");
    return this.services;
  }
}

class DemoDevice extends EventTarget implements PeripheralDevice {
  readonly id = "demo-peripheral";
  readonly name = "Web BLE Demo";
  readonly gatt = new DemoServer(this);
}

export class DemoBluetoothManager extends BluetoothManager {
  override readonly mode = "demo" as const;
  override async scan(search: SearchOptions): Promise<PeripheralDevice> {
    buildRequestOptions(search);
    const device = new DemoDevice();
    const name = search.name;
    const matchesName =
      !name || (search.nameMatch === "exact" ? device.name === name : device.name.startsWith(name));
    const service = search.service ? normalizeServiceUuid(search.service) : "";
    if (!matchesName || (service && ![BATTERY_SERVICE, DEMO_SERVICE_UUID].includes(service)))
      throw new BleInputError("noMatch");
    return this.rememberDevice(device);
  }
  override generatePacket(): void {
    if (this.device instanceof DemoDevice)
      for (const characteristic of this.device.gatt.characteristics) characteristic.emit();
  }
}
