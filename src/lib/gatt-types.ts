export type ConnectionMode = "real" | "demo";

export interface GattProperties {
  readonly read: boolean;
  readonly write: boolean;
  readonly writeWithoutResponse: boolean;
  readonly notify: boolean;
  readonly indicate: boolean;
}

export interface GattDescriptor {
  readonly uuid: string;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

export interface GattCharacteristic extends EventTarget {
  readonly uuid: string;
  readonly service: { readonly uuid: string };
  readonly properties: GattProperties;
  readonly value?: DataView;
  readValue(): Promise<DataView>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  getDescriptors(): Promise<GattDescriptor[]>;
  startNotifications(): Promise<GattCharacteristic>;
  stopNotifications(): Promise<GattCharacteristic>;
}

export interface GattService {
  readonly uuid: string;
  getCharacteristics(): Promise<GattCharacteristic[]>;
}

export interface GattServer {
  readonly connected: boolean;
  connect(): Promise<GattServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<GattService[]>;
}

export interface PeripheralDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: GattServer;
}

export interface SearchOptions {
  name: string;
  nameMatch: "prefix" | "exact";
  service: string;
  additionalServices: string;
}

export const SERVICE_PRESETS = {
  battery: "180f",
  heartRate: "180d",
  deviceInformation: "180a",
  environment: "181a",
  uart: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
} as const;

export const DEFAULT_SEARCH: SearchOptions = {
  name: "",
  nameMatch: "prefix",
  service: "",
  additionalServices: "",
};
