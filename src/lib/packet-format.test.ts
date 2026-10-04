import { describe, expect, it } from "vitest";
import { formatLogText, formatPacket, formatPacketTime, packetPresentation } from "./packet-format";

const bytes = Uint8Array.of(0xee, 0x4a, 0x2f, 0xff);
const packet = new DataView(bytes.buffer, 1, 2);
describe("packet presentation", () => {
  it.each([
    ["hex-ascii", "4A 2F | J/"],
    ["hex", "4A 2F"],
    ["ascii", "J/"],
    ["utf8", "J/"],
    ["decimal", "74 47"],
    ["binary", "01001010 00101111"],
    ["base64", "Si8="],
    ["uint16-le", "12106"],
    ["uint16-be", "18991"],
  ] as const)("renders %s without adjacent bytes", (format, expected) => {
    expect(formatPacket(packet, format)).toBe(expected);
  });
  it("pretty prints JSON and preserves Unicode", () => {
    const value = new TextEncoder().encode('{"value":"温度","n":2}');
    expect(formatPacket(new DataView(value.buffer), "json")).toBe(
      '{\n  "value": "温度",\n  "n": 2\n}',
    );
  });
  it("falls back to the original bytes for invalid UTF-8, JSON and aligned numbers", () => {
    const invalid = new DataView(Uint8Array.of(0xff).buffer);
    for (const format of ["utf8", "json", "uint16-le"] as const) {
      expect(packetPresentation(invalid, format)).toEqual({ text: "FF", invalid: true });
    }
  });
  it("supports empty data and sanitizes control bytes for ASCII", () => {
    expect(formatPacket(new DataView(new ArrayBuffer(0)), "hex")).toBe("");
    expect(formatPacket(new DataView(Uint8Array.of(0, 0x41, 0x7f).buffer), "ascii")).toBe(".A.");
  });
  it("supports ISO and stable elapsed timestamps", () => {
    expect(formatPacketTime(1000, "iso", 0, "en")).toBe("1970-01-01T00:00:01.000Z");
    expect(formatPacketTime(1250, "elapsed", 1000, "en")).toBe("+0.250s");
    expect(formatPacketTime(900, "elapsed", 1000, "ja")).toBe("+0.000s");
  });
  it("copies the chosen format, including a descriptor target", () => {
    const text = formatLogText(
      {
        timestamp: 1250,
        type: "descriptor-read",
        charUuid: "abcd",
        descriptorUuid: "2901",
        data: packet,
      },
      "",
      "base64",
      "elapsed",
      1000,
      "en",
    );
    expect(text).toBe("[+0.250s] DESCRIPTOR-READ abcd 2901 2B Si8=");
  });
});
