import { useState } from "preact/hooks";
import type { BluetoothManager } from "../lib/ble-client";
import { bleErrorKey } from "../lib/ble-error";
import { isGattWriteAllowed, parseWriteValue } from "../lib/ble-input";
import type { GattDescriptor } from "../lib/gatt-types";
import { useI18n } from "../lib/i18n";
import { packetPresentation } from "../lib/packet-format";
import {
  addLog,
  bleState,
  setSubscriptionStatus,
  type CharacteristicInfo,
  type ServiceInfo,
  type LogEntryType,
} from "../lib/store";
import { formatUuid } from "../lib/utils";

const button =
  "rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const input =
  "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50";

export default function DeviceExplorer({ manager }: { manager: BluetoothManager }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const matches = (uuid: string) => `${uuid} ${formatUuid(uuid)}`.toLowerCase().includes(term);
  const services = bleState.value.services
    .map((service) => ({
      ...service,
      characteristics: matches(service.uuid)
        ? service.characteristics
        : service.characteristics.filter((characteristic) => matches(characteristic.uuid)),
    }))
    .filter((service) => service.characteristics.length > 0);
  return (
    <div class="space-y-4">
      <label class="block space-y-1 text-sm text-slate-700">
        <span>{t("capture.browse")}</span>
        <input
          class={input}
          value={query}
          maxLength={128}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <h3 class="font-medium text-slate-800">{t("device.servicesAndCharacteristics")}</h3>
      {services.length ? (
        services.map((service) => (
          <ServiceItem key={service.id} service={service} manager={manager} />
        ))
      ) : (
        <p class="rounded-lg bg-slate-100 p-4 text-sm text-slate-500">{t("capture.noResults")}</p>
      )}
    </div>
  );
}

function ServiceItem({ service, manager }: { service: ServiceInfo; manager: BluetoothManager }) {
  return (
    <section
      class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      data-service-uuid={service.uuid}
    >
      <h4
        class="break-all border-b border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800"
        title={service.uuid}
      >
        {formatUuid(service.uuid)}
      </h4>
      <div class="divide-y divide-slate-200">
        {service.characteristics.map((characteristic) => (
          <CharacteristicItem key={characteristic.id} char={characteristic} manager={manager} />
        ))}
      </div>
    </section>
  );
}

interface DescriptorItem {
  id: string;
  instance: GattDescriptor;
}
function CharacteristicItem({
  char,
  manager,
}: {
  char: CharacteristicInfo;
  manager: BluetoothManager;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [descriptors, setDescriptors] = useState<DescriptorItem[] | null>(null);
  const subscribed = bleState.value.activeSubscriptions.has(char.id);
  const latest = bleState.value.logs.findLast(
    (entry) => entry.characteristicId === char.id && !entry.descriptorUuid && entry.data,
  );
  const log = (type: LogEntryType, data?: DataView, messageKey?: string) => {
    if (manager.isDisposed) return;
    addLog({
      timestamp: Date.now(),
      type,
      data,
      messageKey,
      serviceUuid: char.instance.service.uuid,
      charUuid: char.uuid,
      characteristicId: char.id,
    });
  };
  async function run(action: () => Promise<void>) {
    if (busy || manager.isDisposed) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      if (!manager.isDisposed) {
        const key = bleErrorKey(error);
        setError(t(key));
        log("error", undefined, key);
      }
    } finally {
      setBusy(false);
    }
  }
  async function subscribe() {
    if (subscribed) {
      try {
        await manager.stopNotifications(char.instance);
      } finally {
        if (!manager.isDisposed) setSubscriptionStatus(char.id, false);
      }
      log("info", undefined, "gatt.unsubscribed");
    } else {
      await manager.startNotifications(
        char.instance,
        (data) => log("notification", data),
        () => log("error", undefined, "error.input.size"),
      );
      if (manager.isDisposed) return;
      setSubscriptionStatus(char.id, true);
      log("info", undefined, "gatt.subscribed");
    }
  }
  return (
    <article class="space-y-3 p-4" data-gatt-uuid={char.uuid}>
      <h5 class="break-all font-mono text-sm font-medium text-slate-900" title={char.uuid}>
        {formatUuid(char.uuid)}
      </h5>
      <div class="flex flex-wrap gap-1 text-[11px] text-slate-600">
        {char.properties.read && <span class="rounded bg-blue-50 px-2 py-1">READ</span>}
        {char.properties.write && <span class="rounded bg-amber-50 px-2 py-1">WRITE</span>}
        {char.properties.writeWithoutResponse && (
          <span class="rounded bg-amber-50 px-2 py-1">WRITE NO RESPONSE</span>
        )}
        {char.properties.notify && <span class="rounded bg-purple-50 px-2 py-1">NOTIFY</span>}
        {char.properties.indicate && <span class="rounded bg-purple-50 px-2 py-1">INDICATE</span>}
      </div>
      <div class="flex flex-wrap gap-2">
        {char.properties.read && (
          <button
            class={button}
            disabled={busy}
            onClick={() => void run(async () => log("read", await manager.read(char.instance)))}
          >
            {t("gatt.read")}
          </button>
        )}
        {(char.properties.notify || char.properties.indicate) && (
          <button class={button} disabled={busy} onClick={() => void run(subscribe)}>
            {t(subscribed ? "device.stop" : "device.subscribe")}
          </button>
        )}
        {typeof char.instance.getDescriptors === "function" && (
          <button
            class={button}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const values = await manager.descriptors(char.instance);
                setDescriptors(
                  values.map((instance, index) => ({
                    instance,
                    id: `${char.id}/${instance.uuid}:${index}`,
                  })),
                );
              })
            }
          >
            {t("gatt.descriptors")}
          </button>
        )}
      </div>
      {(char.properties.write || char.properties.writeWithoutResponse) &&
        isGattWriteAllowed(char.uuid) && (
          <WriteEditor
            busy={busy}
            withResponse={char.properties.write}
            withoutResponse={char.properties.writeWithoutResponse}
            onWrite={(bytes, response) =>
              run(async () => {
                await manager.write(char.instance, bytes, response);
                log("write", new DataView(bytes.buffer));
              })
            }
          />
        )}
      {latest?.data && (
        <div class="rounded bg-slate-50 p-2 text-xs">
          <span class="text-slate-500">{t("gatt.value")}: </span>
          <code class="break-all text-slate-800">
            {packetPresentation(latest.data, "hex-ascii").text}
          </code>
        </div>
      )}
      {error && (
        <p role="alert" class="text-sm text-red-700">
          {error}
        </p>
      )}
      {descriptors && (
        <div class="space-y-3 border-t border-slate-200 pt-3">
          {!descriptors.length && <p class="text-xs text-slate-500">{t("gatt.noDescriptors")}</p>}
          {descriptors.map((descriptor) => (
            <DescriptorEditor
              key={descriptor.id}
              descriptor={descriptor}
              char={char}
              manager={manager}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function WriteEditor({
  busy,
  withResponse,
  withoutResponse,
  onWrite,
}: {
  busy: boolean;
  withResponse: boolean;
  withoutResponse: boolean;
  onWrite: (bytes: Uint8Array<ArrayBuffer>, response: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const [payload, setPayload] = useState("");
  const [encoding, setEncoding] = useState<"hex" | "utf8">("hex");
  const [response, setResponse] = useState(withResponse);
  let bytes: Uint8Array<ArrayBuffer> | null = null;
  let error = "";
  try {
    bytes = parseWriteValue(payload, encoding);
  } catch (value) {
    error = t(bleErrorKey(value));
  }
  return (
    <div class="space-y-2 rounded-lg bg-slate-50 p-3">
      <div class="flex flex-wrap gap-2">
        <label class="text-xs text-slate-600">
          <span>{t("gatt.encoding")}</span>
          <select
            class={`${input} mt-1`}
            value={encoding}
            aria-label={t("gatt.encoding")}
            disabled={busy}
            onChange={(event) => setEncoding(event.currentTarget.value === "utf8" ? "utf8" : "hex")}
          >
            <option value="hex">Hex</option>
            <option value="utf8">UTF-8</option>
          </select>
        </label>
        {withResponse && withoutResponse && (
          <label class="text-xs text-slate-600">
            <span>{t("gatt.response")}</span>
            <select
              class={`${input} mt-1`}
              value={response ? "response" : "no-response"}
              aria-label={t("gatt.response")}
              disabled={busy}
              onChange={(event) => setResponse(event.currentTarget.value === "response")}
            >
              <option value="response">{t("gatt.withResponse")}</option>
              <option value="no-response">{t("gatt.withoutResponse")}</option>
            </select>
          </label>
        )}
      </div>
      <label class="block text-xs text-slate-600">
        <span>{t("gatt.payload")}</span>
        <textarea
          class={`${input} mt-1 font-mono`}
          rows={2}
          maxLength={4096}
          value={payload}
          disabled={busy}
          onInput={(event) => setPayload(event.currentTarget.value)}
        />
      </label>
      <p class="text-xs text-slate-500">{t("gatt.limit")}</p>
      {payload && error && (
        <p role="alert" class="text-xs text-red-700">
          {error}
        </p>
      )}
      <button
        class={button}
        disabled={busy || !bytes}
        onClick={() => {
          if (bytes) void onWrite(bytes, response);
        }}
      >
        {t("gatt.write")}
        {bytes ? ` (${bytes.byteLength} B)` : ""}
      </button>
    </div>
  );
}

function DescriptorEditor({
  descriptor,
  char,
  manager,
}: {
  descriptor: DescriptorItem;
  char: CharacteristicInfo;
  manager: BluetoothManager;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState<DataView | null>(null);
  async function run(
    type: "descriptor-read" | "descriptor-write",
    bytes?: Uint8Array<ArrayBuffer>,
  ) {
    if (busy || manager.isDisposed) return;
    setBusy(true);
    setError("");
    try {
      let data: DataView;
      if (bytes) {
        await manager.writeDescriptor(descriptor.instance, bytes);
        data = new DataView(bytes.buffer);
      } else data = await manager.readDescriptor(descriptor.instance);
      if (manager.isDisposed) return;
      setValue(data);
      addLog({
        timestamp: Date.now(),
        type,
        data,
        serviceUuid: char.instance.service.uuid,
        charUuid: char.uuid,
        characteristicId: char.id,
        descriptorUuid: descriptor.instance.uuid,
      });
    } catch (error) {
      if (!manager.isDisposed) setError(t(bleErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      class="space-y-2 rounded-lg border border-slate-200 p-3"
      data-descriptor-uuid={descriptor.instance.uuid}
    >
      <h6 class="break-all text-xs font-semibold text-slate-700">
        {t("gatt.descriptor")} <span class="font-mono">{formatUuid(descriptor.instance.uuid)}</span>
      </h6>
      <button class={button} disabled={busy} onClick={() => void run("descriptor-read")}>
        {t("gatt.read")}
      </button>
      {isGattWriteAllowed(descriptor.instance.uuid) ? (
        <WriteEditor
          busy={busy}
          withResponse={true}
          withoutResponse={false}
          onWrite={(bytes) => run("descriptor-write", bytes)}
        />
      ) : (
        <p class="text-xs text-slate-500">{t("error.unsupported")}</p>
      )}
      {value && (
        <code class="block break-all text-xs text-slate-600">
          {packetPresentation(value, "hex-ascii").text}
        </code>
      )}
      {error && (
        <p role="alert" class="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
