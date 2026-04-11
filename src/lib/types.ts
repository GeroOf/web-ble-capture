/** BLE 接続ステータス */
export type BluetoothStatus = "disconnected" | "connecting" | "connected" | "error";

/** ログエントリの種別 */
export type LogEntryType = "notification" | "read" | "write" | "info" | "error";

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
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    notify: boolean;
    indicate: boolean;
  };
  instance: BluetoothRemoteGATTCharacteristic | null; // Non-serializable, reference only
}

/** サービス情報 */
export interface ServiceInfo {
  uuid: string;
  characteristics: CharacteristicInfo[];
}

/** ログエントリ（メモリ上のランタイム表現） */
export interface LogEntry {
  timestamp: number;
  type: LogEntryType;
  serviceUuid?: string;
  charUuid?: string;
  data?: DataView; // We will store raw data
  message?: string;
  messageKey?: string;
  messageValues?: MessageValues;
}

/** BLE アプリケーション全体のステート */
export interface BLEState {
  status: BluetoothStatus;
  device: BluetoothDevice | null;
  services: ServiceInfo[];
  error: LocalizedText | null;
  logs: LogEntry[];
  activeSubscriptions: Set<string>; // Set of characteristic UUIDs
  sessionId: string | null;
}
