import { useEffect, useRef } from "preact/hooks";
import { useI18n, resolveLocalizedText } from "../lib/i18n";
import { bleState, clearLogs, type LogEntry } from "../lib/store";
import { formatUuid, toAscii, toHex } from "../lib/utils";

export default function LogConsole() {
  const { locale, t } = useI18n();
  const { logs } = bleState.value;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const copyLogs = () => {
    const text = logs
      .map((log) => {
        const time = new Date(log.timestamp).toISOString();
        const hex = log.data ? toHex(log.data) : "";
        const ascii = log.data ? toAscii(log.data) : "";
        const message = resolveLocalizedText(locale, log);
        return `[${time}] ${log.type.toUpperCase()}: ${message} ${log.charUuid || ""} Hex:${hex} Ascii:${ascii}`;
      })
      .join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert(t("log.copySuccess"));
      })
      .catch((error) => {
        console.error("Failed to copy logs:", error);
        alert(t("log.copyFailure"));
      });
  };

  return (
    <div class="flex h-[500px] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
      <div class="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-100">
            {t("log.dataLog")}
          </h3>
          <span class="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
            {logs.length}
          </span>
        </div>
        <div class="flex gap-4">
          <button
            onClick={copyLogs}
            class="text-xs text-slate-400 transition-colors hover:text-white hover:underline"
          >
            {t("log.copyAll")}
          </button>
          <button
            onClick={clearLogs}
            class="text-xs text-slate-400 transition-colors hover:text-white hover:underline"
          >
            {t("log.clearConsole")}
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        class="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5"
      >
        {logs.length === 0 ? (
          <div class="py-10 text-center italic text-slate-500">{t("log.empty")}</div>
        ) : (
          logs.map((log, index) => <LogLine key={index} entry={log} />)
        )}
      </div>
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const { locale, t } = useI18n();
  const time = new Intl.DateTimeFormat(locale, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(new Date(entry.timestamp));
  const message = resolveLocalizedText(locale, entry);

  return (
    <div class="flex gap-3 rounded p-1 hover:bg-slate-800/50">
      <span class="whitespace-nowrap text-slate-500">{time}</span>
      <span
        class={`w-24 truncate whitespace-nowrap font-bold ${
          entry.type === "error"
            ? "text-red-400"
            : entry.type === "info"
              ? "text-blue-400"
              : "text-green-400"
        }`}
      >
        [{t(`log.type.${entry.type}`)}]
      </span>
      <div class="min-w-0 flex-1">
        {message && <span class="text-slate-300">{message}</span>}
        {entry.charUuid && (
          <div class="mt-0.5 flex flex-col gap-2 sm:flex-row sm:gap-4">
            <span class="shrink-0 select-all text-slate-400" title={entry.charUuid}>
              {formatUuid(entry.charUuid)}:
            </span>
            {entry.data && (
              <div class="flex items-center gap-4">
                <span class="break-all select-all text-amber-300">{toHex(entry.data)}</span>
                <span class="hidden text-slate-500 sm:inline-block">|</span>
                <span class="break-all select-all text-slate-400">{toAscii(entry.data)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
