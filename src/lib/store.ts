import { signal } from "@preact/signals";
import { copyPacket } from "./ble-input";
import { logStorage, MAX_SESSION_LOGS } from "./storage";
import type { ConnectionMode, PeripheralDevice } from "./gatt-types";
import type { BLEState, BluetoothStatus, LocalizedText, LogEntry, ServiceInfo } from "./types";
export type {
  BluetoothStatus,
  CharacteristicInfo,
  ServiceInfo,
  LogEntry,
  BLEState,
  LogEntryType,
} from "./types";

let logSequence = 0;
let sessionSequence = 0;
function initialState(): BLEState {
  return {
    status: "disconnected",
    device: null,
    services: [],
    error: null,
    logs: [],
    activeSubscriptions: new Set(),
    sessionId: null,
    mode: "real",
    startedAt: 0,
  };
}
export const bleState = signal<BLEState>(initialState());
export const resetState = () => {
  bleState.value = initialState();
};
export const setStatus = (status: BluetoothStatus) => {
  bleState.value = { ...bleState.value, status };
};
export const setError = (error: LocalizedText | string) => {
  const normalized = typeof error === "string" ? { message: error } : error;
  bleState.value = {
    ...bleState.value,
    status: bleState.value.status === "connected" ? "connected" : "error",
    error: normalized,
  };
};
export const clearError = () => {
  bleState.value = { ...bleState.value, error: null };
};
export const setDevice = (
  device: PeripheralDevice,
  mode: ConnectionMode,
  services: ServiceInfo[],
) => {
  const sessionId = `session-${++sessionSequence}`;
  const startedAt = Date.now();
  logStorage.startSession(sessionId, mode);
  bleState.value = {
    ...initialState(),
    status: "connected",
    device,
    mode,
    services,
    sessionId,
    startedAt,
  };
};
export const disconnectState = () => {
  bleState.value = {
    ...bleState.value,
    status: "disconnected",
    device: null,
    services: [],
    activeSubscriptions: new Set(),
    error: null,
  };
};
export const addLog = (entry: LogEntry) => {
  const snapshot: LogEntry = {
    ...entry,
    id: ++logSequence,
    data: entry.data ? copyPacket(entry.data) : undefined,
    messageValues: entry.messageValues ? { ...entry.messageValues } : undefined,
  };
  const { sessionId, logs } = bleState.value;
  if (sessionId) logStorage.addLog(sessionId, snapshot);
  bleState.value = { ...bleState.value, logs: [...logs, snapshot].slice(-MAX_SESSION_LOGS) };
};
export const clearLogs = () => {
  bleState.value = { ...bleState.value, logs: [] };
};
export const setSubscriptionStatus = (id: string, subscribed: boolean) => {
  const activeSubscriptions = new Set(bleState.value.activeSubscriptions);
  if (subscribed) activeSubscriptions.add(id);
  else activeSubscriptions.delete(id);
  bleState.value = { ...bleState.value, activeSubscriptions };
};
