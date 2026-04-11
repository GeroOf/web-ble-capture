import { BluetoothManager } from "../lib/ble-client";
import { useI18n } from "../lib/i18n";
import {
  addLog,
  bleState,
  setError,
  setSubscriptionStatus,
  type CharacteristicInfo,
  type ServiceInfo,
} from "../lib/store";
import { trackEvent } from "../lib/analytics";
import { formatUuid } from "../lib/utils";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default function DeviceExplorer() {
  const { t } = useI18n();
  const { device, services, status } = bleState.value;

  if (!device) return null;

  return (
    <div class="space-y-6">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-slate-900">
              {device.name || t("device.unknownDevice")}
            </h2>
            <p class="font-mono text-sm text-slate-500">{device.id}</p>
          </div>
          <div>
            <span
              class={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                status === "connected"
                  ? "bg-green-100 text-green-800"
                  : status === "connecting"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-800"
              }`}
            >
              {t(`status.${status}`)}
            </span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-800">
          {t("device.servicesAndCharacteristics")}
        </h3>
        {services.length === 0 ? (
          <div class="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center text-slate-500">
            {status === "connecting" ? t("device.discoveringServices") : t("device.noServices")}
          </div>
        ) : (
          <div class="space-y-4">
            {services.map((service) => (
              <ServiceItem key={service.uuid} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceItem({ service }: { service: ServiceInfo }) {
  const { t } = useI18n();

  return (
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div class="font-mono text-sm font-medium text-slate-700">{formatUuid(service.uuid)}</div>
        <div class="text-xs text-slate-400">{t("device.service")}</div>
      </div>
      <div class="divide-y divide-slate-100">
        {service.characteristics.map((char) => (
          <CharacteristicItem key={char.uuid} char={char} />
        ))}
      </div>
    </div>
  );
}

function CharacteristicItem({ char }: { char: CharacteristicInfo }) {
  const { t } = useI18n();
  const { activeSubscriptions } = bleState.value;
  const isSubscribed = activeSubscriptions.has(char.uuid);
  const supportsNotify = char.properties.notify || char.properties.indicate;

  const handleNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;

    addLog({
      timestamp: Date.now(),
      type: "notification",
      serviceUuid: target.service.uuid,
      charUuid: target.uuid,
      data: target.value,
    });
  };

  const toggleSubscribe = async () => {
    if (!char.instance) return;
    const manager = new BluetoothManager();

    try {
      if (isSubscribed) {
        await manager.stopNotifications(char.instance, handleNotification);
        setSubscriptionStatus(char.uuid, false);
        addLog({
          timestamp: Date.now(),
          type: "info",
          messageKey: "log.unsubscribedFrom",
          messageValues: { target: formatUuid(char.uuid) },
        });
        trackEvent("unsubscribe_characteristic", { char_uuid: char.uuid });
      } else {
        await manager.startNotifications(char.instance, handleNotification);
        setSubscriptionStatus(char.uuid, true);
        addLog({
          timestamp: Date.now(),
          type: "info",
          messageKey: "log.subscribedTo",
          messageValues: { target: formatUuid(char.uuid) },
        });
        trackEvent("subscribe_characteristic", { char_uuid: char.uuid });
      }
    } catch (error) {
      console.error(error);
      setError({
        messageKey: "error.subscriptionToggleFailed",
        messageValues: { reason: getErrorMessage(error) },
      });
    }
  };

  return (
    <div class="group flex flex-col justify-between gap-2 px-4 py-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center">
      <div class="flex items-center gap-3">
        <div
          class={`h-2 w-2 shrink-0 rounded-full ${isSubscribed ? "animate-pulse bg-green-500" : "bg-slate-300"}`}
        ></div>
        <div class="truncate font-mono text-sm text-slate-600" title={char.uuid}>
          {formatUuid(char.uuid)}
        </div>
      </div>

      <div class="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <div class="flex flex-wrap gap-2">
          {char.properties.read && <Badge label={t("device.badge.read")} color="blue" />}
          {char.properties.write && <Badge label={t("device.badge.write")} color="amber" />}
          {char.properties.notify && <Badge label={t("device.badge.notify")} color="purple" />}
          {char.properties.indicate && <Badge label={t("device.badge.indicate")} color="indigo" />}
        </div>

        {supportsNotify && (
          <button
            onClick={toggleSubscribe}
            class={`shrink-0 rounded border px-3 py-1 text-xs transition-colors ${
              isSubscribed
                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {isSubscribed ? t("device.stop") : t("device.subscribe")}
          </button>
        )}
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: "blue" | "amber" | "purple" | "indigo" }) {
  const colors = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };

  return <span class={`rounded px-2 py-0.5 text-[10px] font-bold ${colors[color]}`}>{label}</span>;
}
