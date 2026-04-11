import { signal } from "@preact/signals";
import { logStorage } from "./storage";
import type { BLEState, BluetoothStatus, LocalizedText, LogEntry } from "./types";

// Re-export types for consumer convenience
export type {
  BluetoothStatus,
  CharacteristicInfo,
  ServiceInfo,
  LogEntry,
  BLEState,
  LogEntryType,
} from "./types";

/** ステートの初期値（resetState と共有） */
const INITIAL_STATE: BLEState = {
  status: "disconnected",
  device: null,
  services: [],
  error: null,
  logs: [],
  activeSubscriptions: new Set(),
  sessionId: null,
};

export const bleState = signal<BLEState>({ ...INITIAL_STATE });

function normalizeText(text: LocalizedText | string): LocalizedText {
  return typeof text === "string" ? { message: text } : text;
}

// Helper actions
export const resetState = () => {
  bleState.value = { ...INITIAL_STATE, activeSubscriptions: new Set() };
};

export const setStatus = (status: BluetoothStatus) => {
  bleState.value = { ...bleState.value, status };
};

export const setError = (error: LocalizedText | string) => {
  const normalized = normalizeText(error);
  bleState.value = { ...bleState.value, status: "error", error: normalized };
  addLog({ timestamp: Date.now(), type: "error", ...normalized });
};

export const clearError = () => {
  bleState.value = {
    ...bleState.value,
    error: null,
    status: bleState.value.status === "error" ? "disconnected" : bleState.value.status,
  };
};

export const setDevice = (device: BluetoothDevice) => {
  const sessionId = `${Date.now()}_${device.name || "Unknown"}`;
  logStorage.startSession(sessionId, device.name || "Unknown");
  bleState.value = { ...bleState.value, device, sessionId };
};

export const addLog = (entry: LogEntry) => {
  // Limit logs to keep memory usage in check (e.g. 1000 entries)
  const newLogs = [...bleState.value.logs, entry];
  if (newLogs.length > 1000) {
    newLogs.shift();
  }

  // Save to IndexedDB
  const { sessionId } = bleState.value;
  if (sessionId) {
    logStorage.addLog(sessionId, entry).catch((e) => console.error("DB Error", e));
  }

  bleState.value = { ...bleState.value, logs: newLogs };
};

export const clearLogs = () => {
  bleState.value = { ...bleState.value, logs: [] };
};

export const setSubscriptionStatus = (charUuid: string, isSubscribed: boolean) => {
  const newSet = new Set(bleState.value.activeSubscriptions);
  if (isSubscribed) {
    newSet.add(charUuid);
  } else {
    newSet.delete(charUuid);
  }
  bleState.value = { ...bleState.value, activeSubscriptions: newSet };
};
