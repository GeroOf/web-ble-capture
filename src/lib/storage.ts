import { copyPacket } from "./ble-input";
import type { ConnectionMode } from "./gatt-types";
import { PACKET_FORMATS, TIME_FORMATS, type PacketFormat, type TimeFormat } from "./packet-format";
import type { LogEntry } from "./types";

export const MAX_SESSION_LOGS = 1000;
export const MAX_SESSIONS = 20;
export interface SessionRecord {
  id: string;
  mode: ConnectionMode;
  startTime: number;
  logCount: number;
}
const sessions = new Map<string, { record: SessionRecord; logs: LogEntry[] }>();
const snapshot = (entry: LogEntry): LogEntry => ({
  ...entry,
  messageValues: entry.messageValues ? { ...entry.messageValues } : undefined,
  data: entry.data ? copyPacket(entry.data) : undefined,
});

export const logStorage = {
  startSession(id: string, mode: ConnectionMode): void {
    sessions.set(id, { record: { id, mode, startTime: Date.now(), logCount: 0 }, logs: [] });
    while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
  },
  addLog(id: string, entry: LogEntry): void {
    const session = sessions.get(id);
    if (!session) return;
    session.logs = [...session.logs, snapshot(entry)].slice(-MAX_SESSION_LOGS);
    session.record.logCount = session.logs.length;
  },
  async getSessions(): Promise<SessionRecord[]> {
    return Array.from(sessions.values())
      .reverse()
      .map((session) => ({ ...session.record }));
  },
  async getLogsForSession(id: string): Promise<LogEntry[]> {
    return (sessions.get(id)?.logs ?? []).map(snapshot);
  },
  async deleteSession(id: string): Promise<void> {
    sessions.delete(id);
  },
};

function readSetting(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSetting(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* Presentation settings are optional when browser storage is disabled. */
  }
}

let aliasSource: string | null = null;
let aliasCache: Readonly<Record<string, string>> = Object.freeze({});

export const localPrefs = {
  get customServices(): string {
    return readSetting("webble_custom_services") ?? "";
  },
  set customServices(value: string) {
    if (value.length <= 4096) writeSetting("webble_custom_services", value);
  },
  get aliases(): Readonly<Record<string, string>> {
    const raw = readSetting("webble_aliases") ?? "{}";
    if (raw === aliasSource) return aliasCache;
    aliasSource = raw;
    try {
      if (raw.length > 65536) {
        aliasCache = Object.freeze({});
        return aliasCache;
      }
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        aliasCache = Object.freeze({});
        return aliasCache;
      }
      aliasCache = Object.freeze(
        Object.fromEntries(
          Object.entries(value).filter(
            ([key, alias]) => key.length <= 128 && typeof alias === "string" && alias.length <= 128,
          ),
        ),
      );
    } catch {
      aliasCache = Object.freeze({});
    }
    return aliasCache;
  },
  set aliases(value: Record<string, string>) {
    writeSetting("webble_aliases", JSON.stringify(value));
  },
  get mode(): ConnectionMode | null {
    const value = readSetting("webble_mode");
    return value === "demo" || value === "real" ? value : null;
  },
  set mode(value: ConnectionMode | null) {
    if (value) writeSetting("webble_mode", value);
  },
  get packetFormat(): PacketFormat {
    const value = readSetting("webble_packet_format");
    return PACKET_FORMATS.find((format) => format === value) ?? "hex-ascii";
  },
  set packetFormat(value: PacketFormat) {
    writeSetting("webble_packet_format", value);
  },
  get timeFormat(): TimeFormat {
    const value = readSetting("webble_time_format");
    return TIME_FORMATS.find((format) => format === value) ?? "clock";
  },
  set timeFormat(value: TimeFormat) {
    writeSetting("webble_time_format", value);
  },
};
