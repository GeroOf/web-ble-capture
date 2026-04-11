import type { LogEntry, LogEntryType, MessageValues } from "./types";

const DB_NAME = "WebBLECaptureDB";
const DB_VERSION = 1;

const STORE_SESSIONS = "sessions";
const STORE_LOGS = "logs";

export interface SessionRecord {
  id: string;
  deviceName: string;
  startTime: number;
  logCount: number;
}

export interface PersistedLogEntry {
  sessionId: string;
  timestamp: number;
  type: LogEntryType;
  serviceUuid?: string;
  charUuid?: string;
  data?: Uint8Array;
  message?: string;
  messageKey?: string;
  messageValues?: MessageValues;
}

function convertLogEntryForDB(sessionId: string, entry: LogEntry): PersistedLogEntry {
  return {
    sessionId,
    timestamp: entry.timestamp,
    type: entry.type,
    serviceUuid: entry.serviceUuid,
    charUuid: entry.charUuid,
    data: entry.data
      ? new Uint8Array(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength)
      : undefined,
    message: entry.message,
    messageKey: entry.messageKey,
    messageValues: entry.messageValues,
  };
}

export function convertDBEntryToLogEntry(dbEntry: PersistedLogEntry): LogEntry {
  return {
    timestamp: dbEntry.timestamp,
    type: dbEntry.type,
    serviceUuid: dbEntry.serviceUuid,
    charUuid: dbEntry.charUuid,
    data: dbEntry.data
      ? new DataView(dbEntry.data.buffer, dbEntry.data.byteOffset, dbEntry.data.byteLength)
      : undefined,
    message: dbEntry.message,
    messageKey: dbEntry.messageKey,
    messageValues: dbEntry.messageValues,
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_LOGS)) {
          const store = db.createObjectStore(STORE_LOGS, { keyPath: "id", autoIncrement: true });
          store.createIndex("sessionId", "sessionId", { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export const logStorage = {
  async startSession(id: string, deviceName: string): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_SESSIONS, "readwrite");
      const store = tx.objectStore(STORE_SESSIONS);
      store.put({
        id,
        deviceName,
        startTime: Date.now(),
        logCount: 0,
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.error("Failed to start session in DB:", error);
    }
  },

  async addLog(sessionId: string, entry: LogEntry): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction([STORE_SESSIONS, STORE_LOGS], "readwrite");

      // Add Log
      const logStore = tx.objectStore(STORE_LOGS);
      const dbEntry = convertLogEntryForDB(sessionId, entry);
      logStore.add(dbEntry);

      // Update log count
      const sessionStore = tx.objectStore(STORE_SESSIONS);
      const sessionReq = sessionStore.get(sessionId);
      sessionReq.onsuccess = () => {
        const session = sessionReq.result as SessionRecord;
        if (session) {
          session.logCount += 1;
          sessionStore.put(session);
        }
      };

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.error("Failed to log to DB:", error);
    }
  },

  async getSessions(): Promise<SessionRecord[]> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_SESSIONS, "readonly");
      const store = tx.objectStore(STORE_SESSIONS);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          // Sort descending by startTime
          const sessions = (request.result as SessionRecord[]).sort(
            (a, b) => b.startTime - a.startTime,
          );
          resolve(sessions);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to get sessions:", error);
      return [];
    }
  },

  async getLogsForSession(sessionId: string): Promise<PersistedLogEntry[]> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_LOGS, "readonly");
      const store = tx.objectStore(STORE_LOGS);
      const index = store.index("sessionId");
      const request = index.getAll(sessionId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as PersistedLogEntry[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to get logs:", error);
      return [];
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const db = await getDB();
      const tx = db.transaction([STORE_SESSIONS, STORE_LOGS], "readwrite");

      // Delete Session
      tx.objectStore(STORE_SESSIONS).delete(sessionId);

      // Delete Logs
      const logStore = tx.objectStore(STORE_LOGS);
      const index = logStore.index("sessionId");
      const cursorReq = index.openCursor(IDBKeyRange.only(sessionId));

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  },
};

//
// LocalStorage wrappers
//
export const localPrefs = {
  get customServices(): string {
    return localStorage.getItem("webble_custom_services") || "";
  },
  set customServices(val: string) {
    localStorage.setItem("webble_custom_services", val);
  },
  get aliases(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem("webble_aliases") || "{}");
    } catch {
      return {};
    }
  },
  set aliases(val: Record<string, string>) {
    localStorage.setItem("webble_aliases", JSON.stringify(val));
  },
};
