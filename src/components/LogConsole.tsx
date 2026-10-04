import { useEffect, useRef, useState } from "preact/hooks";
import { useI18n, resolveLocalizedText } from "../lib/i18n";
import { localPrefs, MAX_SESSION_LOGS } from "../lib/storage";
import { bleState, clearLogs, type LogEntry } from "../lib/store";
import { formatUuid } from "../lib/utils";
import {
  formatLogText,
  formatPacketTime,
  packetPresentation,
  PACKET_FORMATS,
  TIME_FORMATS,
  type PacketFormat,
  type TimeFormat,
} from "../lib/packet-format";

export default function LogConsole({ generateSample }: { generateSample?: () => void }) {
  const { locale, t } = useI18n();
  const { logs, startedAt, activeSubscriptions } = bleState.value;
  const [format, setFormat] = useState<PacketFormat>(localPrefs.packetFormat);
  const [time, setTime] = useState<TimeFormat>(localPrefs.timeFormat);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fullUuid, setFullUuid] = useState(false);
  const [notice, setNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoScroll && scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, autoScroll]);
  async function copy() {
    const text = logs
      .map((entry) =>
        formatLogText(entry, resolveLocalizedText(locale, entry), format, time, startedAt, locale),
      )
      .join("\n");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setNotice(t("log.copySuccess"));
    } catch {
      setNotice(t("log.copyFailure"));
    }
  }
  const select =
    "rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300";
  return (
    <section
      class="flex min-h-[560px] max-h-[80vh] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-sm"
      aria-label={t("log.dataLog")}
    >
      <header class="space-y-3 border-b border-slate-700 bg-slate-800 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-medium text-slate-100">
            {t("log.dataLog")}{" "}
            <span class="ml-2 text-xs text-slate-400">
              {logs.length}/{MAX_SESSION_LOGS}
            </span>
          </h3>
          <div class="flex flex-wrap gap-3 text-xs text-slate-200">
            {generateSample && (
              <button
                onClick={generateSample}
                disabled={!activeSubscriptions.size}
                class="rounded border border-blue-400 px-2 py-1 text-blue-200 disabled:opacity-50"
              >
                {t("capture.generate")}
              </button>
            )}
            <button onClick={() => void copy()} disabled={!logs.length} class="disabled:opacity-50">
              {t("log.copyAll")}
            </button>
            <button onClick={clearLogs}>{t("log.clearConsole")}</button>
          </div>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <label class="space-y-1 text-xs text-slate-300">
            <span class="block">{t("log.format")}</span>
            <select
              class={select}
              aria-label={t("log.format")}
              value={format}
              onChange={(event) => {
                const value = PACKET_FORMATS.find((value) => value === event.currentTarget.value);
                if (value) {
                  setFormat(value);
                  localPrefs.packetFormat = value;
                }
              }}
            >
              {PACKET_FORMATS.map((value) => (
                <option key={value} value={value}>
                  {t(`log.format.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label class="space-y-1 text-xs text-slate-300">
            <span class="block">{t("log.timeFormat")}</span>
            <select
              class={select}
              aria-label={t("log.timeFormat")}
              value={time}
              onChange={(event) => {
                const value = TIME_FORMATS.find((value) => value === event.currentTarget.value);
                if (value) {
                  setTime(value);
                  localPrefs.timeFormat = value;
                }
              }}
            >
              {TIME_FORMATS.map((value) => (
                <option key={value} value={value}>
                  {t(`log.time.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label class="flex items-center gap-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.currentTarget.checked)}
            />
            {t("log.autoScroll")}
          </label>
          <label class="flex items-center gap-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={fullUuid}
              onChange={(event) => setFullUuid(event.currentTarget.checked)}
            />
            {t("log.fullUuid")}
          </label>
        </div>
        {notice && (
          <p role="status" class="text-xs text-slate-200">
            {notice}
          </p>
        )}
      </header>
      <div ref={scrollRef} class="flex-1 overflow-y-auto p-4 font-mono text-xs" data-log-scroll>
        {!logs.length ? (
          <p class="py-10 text-center text-slate-400">{t("log.empty")}</p>
        ) : (
          logs.map((entry) => (
            <LogLine
              key={entry.id}
              entry={entry}
              format={format}
              time={time}
              startedAt={startedAt}
              fullUuid={fullUuid}
            />
          ))
        )}
      </div>
    </section>
  );
}

function LogLine({
  entry,
  format,
  time,
  startedAt,
  fullUuid,
}: {
  entry: LogEntry;
  format: PacketFormat;
  time: TimeFormat;
  startedAt: number;
  fullUuid: boolean;
}) {
  const { locale, t } = useI18n();
  const packet = entry.data ? packetPresentation(entry.data, format) : null;
  return (
    <article class="mb-2 rounded border-b border-slate-800 py-2" data-log-entry={entry.type}>
      <div class="mb-1 flex flex-wrap gap-x-3 gap-y-1">
        <time class="text-slate-500">
          {formatPacketTime(entry.timestamp, time, startedAt, locale)}
        </time>
        <span class={entry.type === "error" ? "text-red-300" : "text-blue-300"}>
          {t(`log.type.${entry.type}`)}
        </span>
        {entry.data && (
          <span class="text-slate-500">{t("log.bytes", { count: entry.data.byteLength })}</span>
        )}
      </div>
      {entry.messageKey || entry.message ? (
        <p class="break-words text-slate-300">{resolveLocalizedText(locale, entry)}</p>
      ) : null}
      {entry.charUuid && (
        <p class="mb-1 break-all text-slate-500" title={entry.charUuid}>
          {fullUuid ? entry.charUuid : formatUuid(entry.charUuid)}
          {entry.descriptorUuid
            ? ` / ${fullUuid ? entry.descriptorUuid : formatUuid(entry.descriptorUuid)}`
            : ""}
        </p>
      )}
      {packet && (
        <>
          <pre class="whitespace-pre-wrap break-all text-amber-200" data-packet-value>
            {packet.text}
          </pre>
          {packet.invalid && <p class="mt-1 text-amber-400">{t("log.invalidFormat")}</p>}
        </>
      )}
    </article>
  );
}
