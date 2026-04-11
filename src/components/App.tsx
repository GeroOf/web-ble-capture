import { useEffect, useState } from "preact/hooks";
import AliasManagerModal from "./AliasManagerModal";
import DeviceExplorer from "./DeviceExplorer";
import HistoryModal from "./HistoryModal";
import LogConsole from "./LogConsole";
import { trackEvent } from "../lib/analytics";
import { BluetoothManager } from "../lib/ble-client";
import { I18nProvider, resolveLocalizedText, useI18n, type Locale } from "../lib/i18n";
import { localPrefs } from "../lib/storage";
import {
  addLog,
  bleState,
  clearError,
  resetState,
  setDevice,
  setError,
  setStatus,
  type CharacteristicInfo,
  type ServiceInfo,
} from "../lib/store";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function AppContent() {
  const { locale, t } = useI18n();
  const { status, error } = bleState.value;
  const [customServices, setCustomServices] = useState(localPrefs.customServices);
  const [showHistory, setShowHistory] = useState(false);
  const [showAliases, setShowAliases] = useState(false);

  useEffect(() => {
    localPrefs.customServices = customServices;
  }, [customServices]);

  const handleDisconnectEvent = () => {
    addLog({ timestamp: Date.now(), type: "info", messageKey: "log.deviceDisconnected" });
    resetState();
  };

  const handleScan = async () => {
    const manager = new BluetoothManager();
    setStatus("connecting");

    try {
      const additionalServices = customServices
        .split(",")
        .map((service) => service.trim())
        .filter((service) => service.length > 0);

      const device = await manager.scan(additionalServices);
      trackEvent("scan_device");
      setDevice(device);

      device.addEventListener("gattserverdisconnected", handleDisconnectEvent);

      const server = await manager.connect(device);
      const services = await manager.getServices(server);
      const servicesData: ServiceInfo[] = [];

      for (const service of services) {
        const chars = await manager.getCharacteristics(service);

        const charInfos: CharacteristicInfo[] = chars.map((characteristic) => ({
          uuid: characteristic.uuid,
          properties: {
            read: characteristic.properties.read,
            write: characteristic.properties.write,
            notify: characteristic.properties.notify,
            indicate: characteristic.properties.indicate,
          },
          instance: characteristic,
        }));

        servicesData.push({
          uuid: service.uuid,
          characteristics: charInfos,
        });
      }

      bleState.value = {
        ...bleState.value,
        status: "connected",
        error: null,
        services: servicesData,
      };
      addLog({
        timestamp: Date.now(),
        type: "info",
        messageKey: "log.connectedTo",
        messageValues: { deviceName: device.name || t("device.unknownDevice") },
      });
      trackEvent("connect_device");
    } catch (error) {
      console.error(error);
      setError({
        messageKey: "error.connectionFailed",
        messageValues: { reason: getErrorMessage(error) },
      });
    }
  };

  const handleDisconnect = () => {
    if (bleState.value.device?.gatt?.connected) {
      bleState.value.device.gatt.disconnect();
      trackEvent("disconnect_device");
    }
  };

  if (status === "connected") {
    return (
      <div class="relative flex h-[calc(100vh-8rem)] flex-col gap-6 lg:flex-row">
        <div class="flex flex-col gap-4 overflow-hidden lg:w-1/3">
          <div class="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
            <span class="font-bold text-slate-700">{t("home.connectedPanel")}</span>
            <div class="flex gap-2">
              <button
                onClick={() => setShowHistory(true)}
                class="rounded bg-blue-50 px-3 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-100"
              >
                {t("home.history")}
              </button>
              <button
                onClick={handleDisconnect}
                class="rounded bg-red-50 px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-100"
              >
                {t("home.disconnect")}
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto">
            <DeviceExplorer />
          </div>
        </div>

        <div class="flex flex-col overflow-hidden lg:w-2/3">
          <LogConsole />
        </div>
        {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      </div>
    );
  }

  return (
    <div class="flex min-h-[50vh] flex-col items-center justify-center space-y-8">
      <div class="max-w-2xl space-y-4 text-center">
        <h2 class="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Web BLE <span class="text-brand-600">Capture</span>
        </h2>
        <p class="text-xl text-slate-600">{t("home.heroDescription")}</p>
      </div>

      <div class="w-full max-w-md space-y-4">
        {error && (
          <div class="flex items-start justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <span>{resolveLocalizedText(locale, error)}</span>
            <button onClick={clearError} class="ml-2 text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        )}

        <div class="space-y-2">
          <div class="flex items-end justify-between">
            <label class="block text-sm font-medium text-gray-700">
              {t("home.additionalServicesLabel")}
            </label>
            <button
              onClick={() => setShowAliases(true)}
              class="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-600 transition-colors hover:text-brand-800"
            >
              {t("home.manageAliases")}
            </button>
          </div>
          <input
            type="text"
            value={customServices}
            onInput={(event) => setCustomServices(event.currentTarget.value)}
            placeholder="e.g. 1234, 0000aaaa-0000..."
            class="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          />
          <p class="text-xs text-slate-500">{t("home.additionalServicesHelp")}</p>
        </div>

        <button
          onClick={handleScan}
          disabled={status === "connecting"}
          class="w-full transform rounded-xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "connecting" ? t("home.connecting") : t("home.scanConnect")}
        </button>

        <button
          onClick={() => setShowHistory(true)}
          class="mt-4 w-full rounded-xl bg-slate-100 px-8 py-4 text-lg font-semibold text-slate-700 shadow transition-all hover:bg-slate-200"
        >
          {t("home.viewSessionHistory")}
        </button>
      </div>

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      {showAliases && <AliasManagerModal onClose={() => setShowAliases(false)} />}
    </div>
  );
}

export default function App({ locale }: { locale: Locale }) {
  return (
    <I18nProvider locale={locale}>
      <AppContent />
    </I18nProvider>
  );
}
