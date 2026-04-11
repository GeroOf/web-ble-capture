import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { LocalizedText, MessageValues } from "./types";

export const SUPPORTED_LOCALES = ["ja", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleMeta {
  title: string;
  description: string;
  keywords: string;
}

const LOCALE_META: Record<Locale, LocaleMeta> = {
  ja: {
    title: "Web BLE Capture | ブラウザ完結の簡易BLEパケットキャプチャ",
    description:
      "ブラウザだけで動作するインストール不要の軽量BLE通信キャプチャツール。Web Bluetooth APIを利用してPeripheralデバイスのGATT通信を解析します。",
    keywords:
      "Web Bluetooth, BLEキャプチャ, ネットワークキャプチャ, ブラウザ完結, Web BLE Capture, GATT",
  },
  en: {
    title: "Web BLE Capture | Browser-based BLE packet capture",
    description:
      "Lightweight BLE traffic capture running entirely in the browser with Web Bluetooth API support and no backend communication.",
    keywords: "Web Bluetooth, BLE capture, network capture, browser-based, Web BLE Capture, GATT",
  },
};

export const MESSAGES = {
  ja: {
    "nav.github": "GitHub",
    "nav.switchToJa": "日本語",
    "nav.switchToEn": "English",
    "status.connected": "接続済み",
    "status.connecting": "接続中",
    "status.disconnected": "未接続",
    "status.error": "エラー",
    "home.heroDescription": "ブラウザから直接 BLE Peripheral をスキャン・接続・解析します。",
    "home.additionalServicesLabel": "追加 Service UUID（任意）",
    "home.manageAliases": "エイリアス管理",
    "home.additionalServicesHelp":
      "128-bit UUID または 16-bit エイリアスをカンマ区切りで入力します。",
    "home.scanConnect": "スキャンして接続",
    "home.connecting": "接続中...",
    "home.viewSessionHistory": "セッション履歴を見る",
    "home.history": "履歴",
    "home.disconnect": "切断",
    "home.connectedPanel": "接続済み",
    "common.loading": "読み込み中...",
    "common.close": "閉じる",
    "common.delete": "削除",
    "device.unknownDevice": "不明なデバイス",
    "device.servicesAndCharacteristics": "サービスとキャラクタリスティック",
    "device.discoveringServices": "サービスを探索しています...",
    "device.noServices": "サービスが見つからないか、未接続です。",
    "device.service": "サービス",
    "device.subscribe": "購読開始",
    "device.stop": "停止",
    "device.badge.read": "読取",
    "device.badge.write": "書込",
    "device.badge.notify": "通知",
    "device.badge.indicate": "表示",
    "log.dataLog": "データログ",
    "log.copyAll": "すべてコピー",
    "log.clearConsole": "クリア",
    "log.empty": "まだデータはありません。キャラクタリスティックを購読するとログが表示されます。",
    "log.copySuccess": "ログをクリップボードにコピーしました。",
    "log.copyFailure": "ログのコピーに失敗しました。",
    "log.type.notification": "通知",
    "log.type.read": "読取",
    "log.type.write": "書込",
    "log.type.info": "情報",
    "log.type.error": "エラー",
    "history.title": "セッション履歴",
    "history.loading": "読み込み中...",
    "history.emptySessions": "保存済みセッションはありません",
    "history.deleteConfirm": "このセッションを削除しますか？",
    "history.deleteSession": "セッションを削除",
    "history.loadingLogs": "ログを読み込み中...",
    "history.copyText": "テキストをコピー",
    "history.noLogs": "このセッションにログはありません。",
    "history.selectSession": "左側からセッションを選択するとログを表示します",
    "history.logsSuffix": "ログ",
    "history.logCount": "{count} 件",
    "aliases.title": "UUID エイリアス",
    "aliases.description":
      "複雑な UUID を読みやすい名前へ置き換えます。設定したエイリアスはデバイス一覧とログ表示に反映されます。",
    "aliases.addNew": "新しいエイリアスを追加",
    "aliases.uuidPlaceholder": "UUID（例: 0000aaaa-... または 1234）",
    "aliases.aliasPlaceholder": "エイリアス（例: 温度センサー）",
    "aliases.add": "追加",
    "aliases.requiredError": "UUID とエイリアス名は必須です。",
    "aliases.saved": "保存済みエイリアス",
    "aliases.empty": "エイリアスはまだありません",
    "aliases.deleteAlias": "エイリアスを削除",
    "fallback.jsRequired": "Web Bluetooth API を利用するには JavaScript が必要です。",
    "fallback.browserNotSupportedTitle": "ブラウザ非対応",
    "fallback.browserNotSupportedBody":
      "このブラウザは Web Bluetooth API に対応していないようです。",
    "fallback.browserNotSupportedHint": "Chrome、Edge、または iOS では Bluefy を試してください。",
    "redirect.title": "日本語ページへ移動しています",
    "redirect.description": "日本語版の Web BLE Capture に移動します。",
    "redirect.message": "日本語ページへ移動しています。",
    "redirect.linkLabel": "自動で移動しない場合はこちら",
    "log.connectedTo": "{deviceName} に接続しました",
    "log.deviceDisconnected": "デバイスが切断されました",
    "log.subscribedTo": "{target} の購読を開始しました",
    "log.unsubscribedFrom": "{target} の購読を停止しました",
    "error.connectionFailed": "接続に失敗しました: {reason}",
    "error.subscriptionToggleFailed": "購読状態の変更に失敗しました: {reason}",
  },
  en: {
    "nav.github": "GitHub",
    "nav.switchToJa": "Japanese",
    "nav.switchToEn": "English",
    "status.connected": "Connected",
    "status.connecting": "Connecting",
    "status.disconnected": "Disconnected",
    "status.error": "Error",
    "home.heroDescription":
      "Scan, connect, and inspect BLE peripherals directly from your browser.",
    "home.additionalServicesLabel": "Additional Service UUIDs (Optional)",
    "home.manageAliases": "Manage Aliases",
    "home.additionalServicesHelp": "Enter comma-separated 128-bit UUIDs or 16-bit aliases.",
    "home.scanConnect": "Scan & Connect",
    "home.connecting": "Connecting...",
    "home.viewSessionHistory": "View Session History",
    "home.history": "History",
    "home.disconnect": "Disconnect",
    "home.connectedPanel": "Connected",
    "common.loading": "Loading...",
    "common.close": "Close",
    "common.delete": "Delete",
    "device.unknownDevice": "Unknown Device",
    "device.servicesAndCharacteristics": "Services & Characteristics",
    "device.discoveringServices": "Discovering services...",
    "device.noServices": "No services found or not connected.",
    "device.service": "Service",
    "device.subscribe": "Subscribe",
    "device.stop": "Stop",
    "device.badge.read": "READ",
    "device.badge.write": "WRITE",
    "device.badge.notify": "NOTIFY",
    "device.badge.indicate": "INDICATE",
    "log.dataLog": "Data Log",
    "log.copyAll": "Copy All",
    "log.clearConsole": "Clear Console",
    "log.empty": "No data captured yet. Subscribe to a characteristic to start logging.",
    "log.copySuccess": "Logs copied to clipboard.",
    "log.copyFailure": "Failed to copy logs.",
    "log.type.notification": "NOTIFY",
    "log.type.read": "READ",
    "log.type.write": "WRITE",
    "log.type.info": "INFO",
    "log.type.error": "ERROR",
    "history.title": "Session History",
    "history.loading": "Loading...",
    "history.emptySessions": "No saved sessions",
    "history.deleteConfirm": "Are you sure you want to delete this session?",
    "history.deleteSession": "Delete session",
    "history.loadingLogs": "Loading logs...",
    "history.copyText": "Copy Text",
    "history.noLogs": "No logs in this session.",
    "history.selectSession": "Select a session from the left to view logs",
    "history.logsSuffix": "Logs",
    "history.logCount": "{count} logs",
    "aliases.title": "UUID Aliases",
    "aliases.description":
      "Map complex UUIDs to human-readable names. These aliases replace UUID labels in the device explorer and logs.",
    "aliases.addNew": "Add New Alias",
    "aliases.uuidPlaceholder": "UUID (e.g. 0000aaaa-... or 1234)",
    "aliases.aliasPlaceholder": "Alias (e.g. Temp Sensor)",
    "aliases.add": "Add",
    "aliases.requiredError": "UUID and alias name are required.",
    "aliases.saved": "Saved Aliases",
    "aliases.empty": "No aliases configured",
    "aliases.deleteAlias": "Delete alias",
    "fallback.jsRequired": "JavaScript is required to use the Web Bluetooth API.",
    "fallback.browserNotSupportedTitle": "Browser Not Supported",
    "fallback.browserNotSupportedBody":
      "Your browser does not appear to support the Web Bluetooth API.",
    "fallback.browserNotSupportedHint": "Please try Chrome, Edge, or Bluefy on iOS.",
    "redirect.title": "Redirecting to the Japanese page",
    "redirect.description": "Redirecting to the Japanese version of Web BLE Capture.",
    "redirect.message": "Redirecting to the Japanese page.",
    "redirect.linkLabel": "Click here if you are not redirected automatically",
    "log.connectedTo": "Connected to {deviceName}",
    "log.deviceDisconnected": "Device disconnected",
    "log.subscribedTo": "Subscribed to {target}",
    "log.unsubscribedFrom": "Unsubscribed from {target}",
    "error.connectionFailed": "Connection failed: {reason}",
    "error.subscriptionToggleFailed": "Failed to change subscription state: {reason}",
  },
} as const;

export type MessageKey = keyof typeof MESSAGES.ja;

interface I18nContextValue {
  locale: Locale;
  t: (key: MessageKey | string, values?: MessageValues) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, values?: MessageValues): string {
  if (!values) {
    return template;
  }

  return template.replaceAll(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value === undefined ? "" : String(value);
  });
}

export function getLocaleMeta(locale: Locale): LocaleMeta {
  return LOCALE_META[locale];
}

export function getLocalePath(locale: Locale): string {
  return `/${locale}/`;
}

export function translate(
  locale: Locale,
  key: MessageKey | string,
  values?: MessageValues,
): string {
  const template = MESSAGES[locale][key as MessageKey];
  return interpolate(template ?? key, values);
}

export function resolveLocalizedText(
  locale: Locale,
  text: LocalizedText | null | undefined,
): string {
  if (!text) {
    return "";
  }

  if (text.messageKey) {
    return translate(locale, text.messageKey as MessageKey, text.messageValues);
  }

  return text.message ?? "";
}

export function I18nProvider({
  children,
  locale,
}: {
  children: ComponentChildren;
  locale: Locale;
}) {
  const value: I18nContextValue = {
    locale,
    t: (key, values) => translate(locale, key, values),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}
