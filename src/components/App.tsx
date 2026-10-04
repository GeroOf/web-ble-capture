import { useEffect, useRef, useState } from "preact/hooks";
import AliasManagerModal from "./AliasManagerModal";
import DeviceExplorer from "./DeviceExplorer";
import HistoryModal from "./HistoryModal";
import LogConsole from "./LogConsole";
import { BluetoothManager } from "../lib/ble-client";
import { bleErrorKey } from "../lib/ble-error";
import { buildRequestOptions } from "../lib/ble-input";
import {
  DEFAULT_SEARCH,
  SERVICE_PRESETS,
  type ConnectionMode,
  type PeripheralDevice,
} from "../lib/gatt-types";
import { I18nProvider, useI18n, type Locale } from "../lib/i18n";
import { localPrefs } from "../lib/storage";
import {
  addLog,
  bleState,
  clearError,
  disconnectState,
  resetState,
  setDevice,
  setError,
  setStatus,
} from "../lib/store";

interface Session {
  manager: BluetoothManager;
  device?: PeripheralDevice;
  disconnected?: EventListener;
}
const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100";

function AppContent({ demoDefault }: { demoDefault: boolean }) {
  const { t } = useI18n();
  const { status, error, device } = bleState.value;
  const [mode, setMode] = useState<ConnectionMode>(() =>
    demoDefault ? "demo" : (localPrefs.mode ?? "real"),
  );
  const [name, setName] = useState("");
  const [match, setMatch] = useState<"prefix" | "exact">("prefix");
  const [preset, setPreset] = useState("all");
  const [custom, setCustom] = useState("");
  const [additional, setAdditional] = useState(localPrefs.customServices);
  const [notice, setNotice] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showAliases, setShowAliases] = useState(false);
  const attempt = useRef(0);
  const session = useRef<Session | null>(null);
  const connected = status === "connected";
  const busy = status === "selecting" || status === "connecting" || status === "discovering";
  const supported = mode === "demo" || BluetoothManager.isSupported();
  const service =
    preset === "all"
      ? ""
      : preset === "custom"
        ? custom
        : (SERVICE_PRESETS[preset as keyof typeof SERVICE_PRESETS] ?? "");
  const search = { name, nameMatch: match, service, additionalServices: additional };
  let inputError = "";
  try {
    if (preset === "custom" && !custom.trim()) inputError = t("error.input.uuid");
    else buildRequestOptions(search);
  } catch (error) {
    inputError = t(bleErrorKey(error));
  }

  function release() {
    const current = session.current;
    session.current = null;
    if (current?.device && current.disconnected)
      current.device.removeEventListener("gattserverdisconnected", current.disconnected);
    current?.manager.dispose();
  }
  useEffect(
    () => () => {
      attempt.current++;
      release();
      resetState();
    },
    [],
  );
  useEffect(() => {
    try {
      buildRequestOptions({ ...DEFAULT_SEARCH, additionalServices: additional });
      localPrefs.customServices = additional;
    } catch {
      /* Incomplete input is not stored. */
    }
  }, [additional]);

  async function connect() {
    if (busy || connected || inputError || !supported) return;
    const token = ++attempt.current;
    release();
    clearError();
    setNotice("");
    setStatus("selecting");
    let manager: BluetoothManager | null = null;
    try {
      if (mode === "demo") {
        const { DemoBluetoothManager } = await import("../lib/demo-ble");
        if (token !== attempt.current) return;
        manager = new DemoBluetoothManager();
      } else manager = new BluetoothManager();
      session.current = { manager };
      const selected = await manager.scan(search);
      if (token !== attempt.current) {
        manager.dispose();
        return;
      }
      if (!selected) {
        release();
        setStatus("disconnected");
        setNotice(t("capture.cancelled"));
        return;
      }
      const current = manager;
      const disconnected: EventListener = () => {
        if (session.current?.manager !== current) return;
        const wasConnected = bleState.value.device === selected;
        attempt.current++;
        release();
        disconnectState();
        setNotice(t("capture.disconnected"));
        if (wasConnected)
          addLog({ timestamp: Date.now(), type: "info", messageKey: "capture.disconnected" });
      };
      session.current = { manager, device: selected, disconnected };
      selected.addEventListener("gattserverdisconnected", disconnected);
      setStatus("connecting");
      await manager.connect(selected);
      if (token !== attempt.current) {
        manager.dispose();
        return;
      }
      setStatus("discovering");
      const services = await manager.discover();
      if (token !== attempt.current) {
        manager.dispose();
        return;
      }
      setDevice(selected, mode, services);
      addLog({ timestamp: Date.now(), type: "info", messageKey: "capture.connected" });
    } catch (error) {
      manager?.dispose();
      if (token !== attempt.current) return;
      release();
      setError({ messageKey: bleErrorKey(error) });
    }
  }
  function disconnect() {
    const wasConnected = connected;
    attempt.current++;
    release();
    disconnectState();
    setNotice(t(wasConnected ? "capture.disconnected" : "capture.connectionCancelled"));
    if (wasConnected)
      addLog({ timestamp: Date.now(), type: "info", messageKey: "capture.disconnected" });
  }
  function changeMode(value: string) {
    if (busy || connected || (value !== "real" && value !== "demo")) return;
    setMode(value);
    localPrefs.mode = value;
    setNotice("");
    resetState();
  }

  return (
    <div class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label class="min-w-56 space-y-1 text-sm font-medium text-slate-700">
          <span>{t("capture.mode")}</span>
          <select
            aria-label={t("capture.mode")}
            class={field}
            value={mode}
            disabled={busy || connected}
            onChange={(event) => changeMode(event.currentTarget.value)}
          >
            <option value="real">{t("capture.real")}</option>
            <option value="demo">{t("capture.demo")}</option>
          </select>
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <span
            role="status"
            class={`rounded-full px-3 py-1 text-sm font-medium ${connected ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}
          >
            {t(`status.${status}`)}
          </span>
          <button
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onClick={() => setShowHistory(true)}
          >
            {t("home.history")}
          </button>
          <button
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onClick={() => setShowAliases(true)}
          >
            {t("home.manageAliases")}
          </button>
          {connected && (
            <button
              class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              onClick={disconnect}
            >
              {t("home.disconnect")}
            </button>
          )}
        </div>
      </div>
      {mode === "demo" && (
        <p class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          {t("capture.demoNotice")}
        </p>
      )}
      {!supported && (
        <div
          role="alert"
          class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <strong>{t("fallback.browserNotSupportedTitle")}</strong>
          <p>{t("fallback.browserNotSupportedBody")}</p>
          <p>{t("fallback.browserNotSupportedHint")}</p>
        </div>
      )}
      {notice && (
        <p role="status" class="text-sm text-slate-600">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t(error.messageKey ?? "error.operation")}
        </p>
      )}
      <div class="grid gap-5 xl:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
        <section class="min-w-0">
          {!connected ? (
            <form
              class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void connect();
              }}
            >
              <p class="text-sm text-slate-600">{t("home.heroDescription")}</p>
              <label class="block space-y-1 text-sm font-medium text-slate-700">
                <span>{t("capture.name")}</span>
                <input
                  class={field}
                  value={name}
                  disabled={busy}
                  maxLength={248}
                  onInput={(event) => setName(event.currentTarget.value)}
                />
              </label>
              <label class="block space-y-1 text-sm font-medium text-slate-700">
                <span>{t("capture.nameMatch")}</span>
                <select
                  class={field}
                  value={match}
                  disabled={busy}
                  onChange={(event) =>
                    setMatch(event.currentTarget.value === "exact" ? "exact" : "prefix")
                  }
                >
                  <option value="prefix">{t("capture.prefix")}</option>
                  <option value="exact">{t("capture.exact")}</option>
                </select>
              </label>
              <label class="block space-y-1 text-sm font-medium text-slate-700">
                <span>{t("capture.service")}</span>
                <select
                  class={field}
                  value={preset}
                  disabled={busy}
                  onChange={(event) => setPreset(event.currentTarget.value)}
                >
                  <option value="all">{t("capture.all")}</option>
                  {Object.keys(SERVICE_PRESETS).map((key) => (
                    <option key={key} value={key}>
                      {t(`capture.preset.${key}`)}
                    </option>
                  ))}
                  <option value="custom">{t("capture.custom")}</option>
                </select>
              </label>
              {preset === "custom" && (
                <label class="block space-y-1 text-sm font-medium text-slate-700">
                  <span>{t("capture.serviceUuid")}</span>
                  <input
                    class={field}
                    value={custom}
                    disabled={busy}
                    maxLength={36}
                    onInput={(event) => setCustom(event.currentTarget.value)}
                  />
                </label>
              )}
              <label class="block space-y-1 text-sm font-medium text-slate-700">
                <span>{t("home.additionalServicesLabel")}</span>
                <input
                  class={`${field} font-mono`}
                  value={additional}
                  disabled={busy}
                  maxLength={4096}
                  onInput={(event) => setAdditional(event.currentTarget.value)}
                />
              </label>
              <p class="text-xs text-slate-500">{t("capture.searchHelp")}</p>
              {inputError && (
                <p role="alert" class="text-sm text-red-700">
                  {inputError}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || !supported || !!inputError}
                class="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {busy
                  ? t(`status.${status}`)
                  : t(mode === "demo" ? "capture.demoConnect" : "home.scanConnect")}
              </button>
              {status === "selecting" && mode === "real" && (
                <p class="text-sm text-slate-500">{t("capture.selectingHint")}</p>
              )}
              {(status === "connecting" || status === "discovering") && (
                <button
                  type="button"
                  onClick={disconnect}
                  class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm"
                >
                  {t("capture.cancelConnect")}
                </button>
              )}
            </form>
          ) : (
            <>
              {device && (
                <div class="mb-4 rounded-xl border border-slate-200 bg-white p-4">
                  <h2 class="break-words font-semibold text-slate-900">
                    {device.name || t("device.unknownDevice")}
                  </h2>
                  <p class="break-all font-mono text-xs text-slate-500">{device.id}</p>
                </div>
              )}
              {session.current && <DeviceExplorer manager={session.current.manager} />}
            </>
          )}
        </section>
        <LogConsole
          generateSample={
            connected && mode === "demo"
              ? () => session.current?.manager.generatePacket()
              : undefined
          }
        />
      </div>
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      {showAliases && <AliasManagerModal onClose={() => setShowAliases(false)} />}
    </div>
  );
}

export default function App({
  locale,
  demoDefault = false,
}: {
  locale: Locale;
  demoDefault?: boolean;
}) {
  return (
    <I18nProvider locale={locale}>
      <AppContent demoDefault={demoDefault} />
    </I18nProvider>
  );
}
