import type { SearchOptions } from "./gatt-types";

export const MAX_PACKET_BYTES = 512;
export const MAX_ADDITIONAL_SERVICES = 16;

const BLOCKED_WRITES = new Set(
  ["2902", "2903", "2a02"].map((uuid) => `0000${uuid}-0000-1000-8000-00805f9b34fb`),
);
export function isGattWriteAllowed(uuid: string): boolean {
  try {
    return !BLOCKED_WRITES.has(normalizeServiceUuid(uuid));
  } catch {
    return false;
  }
}

const STANDARD_SERVICES: Record<string, string> = {
  generic_access: "1800",
  generic_attribute: "1801",
  battery_service: "180f",
  device_information: "180a",
  heart_rate: "180d",
  environmental_sensing: "181a",
};

export class BleInputError extends Error {
  constructor(
    public readonly code: "uuid" | "services" | "name" | "hex" | "empty" | "size" | "noMatch",
  ) {
    super(code);
    this.name = "BleInputError";
  }
}

export function normalizeServiceUuid(input: string): string {
  let value = input.trim().toLowerCase();
  value = STANDARD_SERVICES[value] ?? value;
  if (/^0x[0-9a-f]{4}(?:[0-9a-f]{4})?$/.test(value)) value = value.slice(2);
  if (/^[0-9a-f]{4}$/.test(value)) value = `0000${value}`;
  if (/^[0-9a-f]{8}$/.test(value)) return `${value}-0000-1000-8000-00805f9b34fb`;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) return value;
  throw new BleInputError("uuid");
}

export function buildRequestOptions(search: SearchOptions): RequestDeviceOptions {
  if (search.additionalServices.length > 4096) throw new BleInputError("services");
  const tokens = search.additionalServices.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length > MAX_ADDITIONAL_SERVICES) throw new BleInputError("services");
  const additional = tokens.map(normalizeServiceUuid);
  const service = search.service ? normalizeServiceUuid(search.service) : undefined;
  const name = search.name;
  if (name.length > 248) throw new BleInputError("name");
  if (new TextEncoder().encode(name).byteLength > 248) throw new BleInputError("name");
  const optionalServices = [
    ...new Set([
      ...Object.values(STANDARD_SERVICES).map(normalizeServiceUuid),
      ...additional,
      ...(service ? [service] : []),
    ]),
  ];
  if (!name && !service) return { acceptAllDevices: true, optionalServices };
  const filter: BluetoothLEScanFilter = {
    ...(name ? (search.nameMatch === "exact" ? { name } : { namePrefix: name }) : {}),
    ...(service ? { services: [service] } : {}),
  };
  return { filters: [filter], optionalServices };
}

export function parseWriteValue(input: string, encoding: "hex" | "utf8"): Uint8Array<ArrayBuffer> {
  let bytes: Uint8Array<ArrayBuffer>;
  if (encoding === "utf8") {
    if (input.length > MAX_PACKET_BYTES) throw new BleInputError("size");
    bytes = new TextEncoder().encode(input);
  } else {
    if (input.length > 4096) throw new BleInputError("size");
    const tokens = input
      .trim()
      .split(/[\s,:]+/)
      .filter(Boolean)
      .map((token) => token.replace(/^0x/i, ""));
    if (tokens.some((token) => !token.length || token.length % 2 || /[^0-9a-f]/i.test(token)))
      throw new BleInputError("hex");
    const value = tokens.join("");
    if (value.length > MAX_PACKET_BYTES * 2) throw new BleInputError("size");
    bytes = new Uint8Array(value.length / 2);
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  if (!bytes.length) throw new BleInputError("empty");
  if (bytes.length > MAX_PACKET_BYTES) throw new BleInputError("size");
  return bytes;
}

export function copyPacket(value: DataView): DataView<ArrayBuffer> {
  if (value.byteLength > MAX_PACKET_BYTES) throw new BleInputError("size");
  const bytes = new Uint8Array(value.byteLength);
  for (let i = 0; i < bytes.length; i++) bytes[i] = value.getUint8(i);
  return new DataView(bytes.buffer);
}
