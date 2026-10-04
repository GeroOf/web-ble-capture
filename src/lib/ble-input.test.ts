import { describe, expect, it } from "vitest";
import {
  buildRequestOptions,
  copyPacket,
  normalizeServiceUuid,
  parseWriteValue,
  isGattWriteAllowed,
} from "./ble-input";
import { DEFAULT_SEARCH } from "./gatt-types";

describe("BLE inputs", () => {
  it.each([
    "180f",
    "0x180F",
    "0000180f",
    "battery_service",
    "0000180F-0000-1000-8000-00805F9B34FB",
  ])("normalizes equivalent UUID %s", (value) => {
    expect(normalizeServiceUuid(value)).toBe("0000180f-0000-1000-8000-00805f9b34fb");
  });
  it("accepts 32-bit and custom UUIDs", () => {
    expect(normalizeServiceUuid("12345678")).toBe("12345678-0000-1000-8000-00805f9b34fb");
    expect(normalizeServiceUuid("7b100001-9a24-4d0a-a4be-112233445566")).toBe(
      "7b100001-9a24-4d0a-a4be-112233445566",
    );
  });
  it.each(["180", "xyz", "180g", "0x123", "../secret", "0000180f-0000-1000-8000-00805f9b34fg"])(
    "rejects invalid UUID %s",
    (value) => {
      expect(() => normalizeServiceUuid(value)).toThrow();
    },
  );
  it("keeps filtering separate from accessible optional services", () => {
    const options = buildRequestOptions({
      ...DEFAULT_SEARCH,
      name: " Sensor ",
      nameMatch: "exact",
      service: "180f",
      additionalServices: "180d, 0x180F; 12345678",
    });
    expect("filters" in options ? options.filters : null).toEqual([
      { name: " Sensor ", services: [normalizeServiceUuid("180f")] },
    ]);
    expect(options.optionalServices).toContain(normalizeServiceUuid("12345678"));
    expect(new Set(options.optionalServices).size).toBe(options.optionalServices?.length);
    expect(buildRequestOptions({ ...DEFAULT_SEARCH, name: "Sensor" })).toMatchObject({
      filters: [{ namePrefix: "Sensor" }],
    });
    expect(buildRequestOptions(DEFAULT_SEARCH)).toMatchObject({ acceptAllDevices: true });
  });
  it("validates UTF-8 name length and service limits before selection", () => {
    expect(() => buildRequestOptions({ ...DEFAULT_SEARCH, name: "あ".repeat(83) })).toThrow("name");
    expect(() =>
      buildRequestOptions({
        ...DEFAULT_SEARCH,
        additionalServices: Array(17).fill("180f").join(","),
      }),
    ).toThrow("services");
    expect(() => buildRequestOptions({ ...DEFAULT_SEARCH, additionalServices: "oops" })).toThrow(
      "uuid",
    );
  });
  it.each(["00 0F FF", "000fff", "0x00:0x0f:0xff", "00,0F,FF"])("decodes valid Hex %s", (value) => {
    expect([...parseWriteValue(value, "hex")]).toEqual([0, 15, 255]);
  });
  it.each(["A B", "0x", "0x0xFF", "1", "ZZ", "GG00", "F0xF"])(
    "rejects malformed Hex %s",
    (value) => {
      expect(() => parseWriteValue(value, "hex")).toThrow("hex");
    },
  );
  it("bounds encoded writes and preserves UTF-8 text", () => {
    expect(new TextDecoder().decode(parseWriteValue("センサー", "utf8"))).toBe("センサー");
    expect(parseWriteValue("ab".repeat(512), "hex").length).toBe(512);
    expect(() => parseWriteValue("ab".repeat(513), "hex")).toThrow("size");
    expect(() => parseWriteValue("あ".repeat(171), "utf8")).toThrow("size");
    expect(() => parseWriteValue("", "hex")).toThrow("empty");
  });
  it("copies only the view and detaches it from subsequent mutations", () => {
    const bytes = Uint8Array.of(99, 10, 20, 88);
    const packet = copyPacket(new DataView(bytes.buffer, 1, 2));
    bytes.fill(0);
    expect([...new Uint8Array(packet.buffer)]).toEqual([10, 20]);
    expect(() => copyPacket(new DataView(new ArrayBuffer(513)))).toThrow("size");
  });
  it("blocks standardized privacy/configuration writes", () => {
    for (const uuid of ["2902", "2903", "2a02"]) expect(isGattWriteAllowed(uuid)).toBe(false);
    expect(isGattWriteAllowed("2901")).toBe(true);
  });
});
