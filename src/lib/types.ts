import type {
  ConnectionMode,
  GattCharacteristic,
  GattProperties,
  PeripheralDevice,
} from "./gatt-types";

/** BLE 接続ステータス */
export type BluetoothStatus =
  | "disconnected"
  | "selecting"
  | "connecting"
  | "discovering"
  | "connected"
  | "error";

/** ログエントリの種別 */
export type LogEntryType =
  | "notification"
  | "read"
  | "write"
  | "descriptor-read"
  | "descriptor-write"
  | "info"
  | "error";

/** 多言語メッセージのパラメータ */
export type MessageValues = Record<string, number | string>;

/** 多言語化可能なメッセージ */
export interface LocalizedText {
  message?: string;
  messageKey?: string;
  messageValues?: MessageValues;
}

/** キャラクタリスティック情報 */
export interface CharacteristicInfo {
  id: string;
  uuid: string;
  properties: GattProperties;
  instance: GattCharacteristic;
}

/** サービス情報 */
export interface ServiceInfo {
  id: string;
  uuid: string;
  characteristics: CharacteristicInfo[];
}

/** ログエントリ（メモリ上のランタイム表現） */
export interface LogEntry {
  id?: number;
  timestamp: number;
  type: LogEntryType;
  serviceUuid?: string;
  charUuid?: string;
  characteristicId?: string;
  descriptorUuid?: string;
  data?: DataView; // We will store raw data
  message?: string;
  messageKey?: string;
  messageValues?: MessageValues;
}

/** BLE アプリケーション全体のステート */
export interface BLEState {
  status: BluetoothStatus;
  device: PeripheralDevice | null;
  mode: ConnectionMode;
  startedAt: number;
  services: ServiceInfo[];
  error: LocalizedText | null;
  logs: LogEntry[];
  activeSubscriptions: Set<string>; // Set of characteristic UUIDs
  sessionId: string | null;
}
