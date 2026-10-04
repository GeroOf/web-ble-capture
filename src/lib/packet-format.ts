import type { LogEntry } from "./types";

export const PACKET_FORMATS = [
  "hex-ascii",
  "hex",
  "ascii",
  "utf8",
  "decimal",
  "binary",
  "base64",
  "uint16-le",
  "uint16-be",
  "json",
] as const;
export type PacketFormat = (typeof PACKET_FORMATS)[number];
export const TIME_FORMATS = ["clock", "iso", "elapsed"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export function formatPacket(data: DataView, format: PacketFormat): string {
  const bytes = Array.from({ length: data.byteLength }, (_, index) => data.getUint8(index));
  const hex = bytes.map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  const ascii = bytes
    .map((value) => (value >= 32 && value <= 126 ? String.fromCharCode(value) : "."))
    .join("");
  switch (format) {
    case "hex-ascii":
      return `${hex} | ${ascii}`;
    case "hex":
      return hex;
    case "ascii":
      return ascii;
    case "decimal":
      return bytes.join(" ");
    case "binary":
      return bytes.map((value) => value.toString(2).padStart(8, "0")).join(" ");
    case "base64":
      return btoa(bytes.map((value) => String.fromCharCode(value)).join(""));
    case "uint16-le":
    case "uint16-be": {
      if (data.byteLength % 2) throw new Error("unaligned");
      return Array.from({ length: data.byteLength / 2 }, (_, index) =>
        data.getUint16(index * 2, format === "uint16-le"),
      ).join(" ");
    }
    case "utf8":
    case "json": {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
      return format === "json" ? JSON.stringify(JSON.parse(text), null, 2) : text;
    }
  }
}

export function packetPresentation(
  data: DataView,
  format: PacketFormat,
): { text: string; invalid: boolean } {
  try {
    return { text: formatPacket(data, format), invalid: false };
  } catch {
    return { text: formatPacket(data, "hex"), invalid: true };
  }
}

export function formatPacketTime(
  timestamp: number,
  format: TimeFormat,
  startedAt: number,
  locale: string,
): string {
  if (format === "iso") return new Date(timestamp).toISOString();
  if (format === "elapsed") return `+${(Math.max(0, timestamp - startedAt) / 1000).toFixed(3)}s`;
  return new Intl.DateTimeFormat(locale, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(new Date(timestamp));
}

export function formatLogText(
  entry: LogEntry,
  message: string,
  packetFormat: PacketFormat,
  timeFormat: TimeFormat,
  startedAt: number,
  locale: string,
): string {
  const time = formatPacketTime(entry.timestamp, timeFormat, startedAt, locale);
  const packet = entry.data ? packetPresentation(entry.data, packetFormat) : null;
  return [
    `[${time}]`,
    entry.type.toUpperCase(),
    entry.charUuid,
    entry.descriptorUuid,
    message,
    packet
      ? `${entry.data!.byteLength}B ${packet.invalid ? "[Hex fallback] " : ""}${packet.text}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
