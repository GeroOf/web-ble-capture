import { localPrefs } from "./storage";

/**
 * UUID を人間可読な表示文字列に変換する。
 * 優先順位: エイリアス辞書 → BT SIG 16-bit 短縮 → 先頭8文字省略
 */
export function formatUuid(uuid: string): string {
  const alias = localPrefs.aliases[uuid];
  if (alias) {
    return alias;
  }

  if (uuid.startsWith("0000") && uuid.endsWith("-0000-1000-8000-00805f9b34fb")) {
    return "0x" + uuid.substring(4, 8).toUpperCase();
  }

  return uuid.substring(0, 8) + "...";
}

/**
 * DataView を 16 進ダンプ文字列に変換する。
 * 例: "4A 2F 00 FF"
 */
export function toHex(data: DataView): string {
  const arr = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")
    .toUpperCase();
}

/**
 * DataView を ASCII 文字列に変換する。
 * 非印刷文字は '.' に置換される。
 */
export function toAscii(data: DataView): string {
  const arr = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let str = "";
  for (let i = 0; i < arr.length; i++) {
    const code = arr[i];
    // Show printable ASCII (32-126)
    if (code >= 32 && code <= 126) {
      str += String.fromCharCode(code);
    } else {
      str += ".";
    }
  }
  return str;
}
