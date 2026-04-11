import { useEffect, useState } from "preact/hooks";
import { resolveLocalizedText, useI18n } from "../lib/i18n";
import {
  convertDBEntryToLogEntry,
  logStorage,
  type PersistedLogEntry,
  type SessionRecord,
} from "../lib/storage";
import { toAscii, toHex } from "../lib/utils";

export default function HistoryModal({ onClose }: { onClose: () => void }) {
  const { locale, t } = useI18n();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<PersistedLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const data = await logStorage.getSessions();
    setSessions(data);
    setLoading(false);
  };

  const handleSelectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setLoading(true);
    const data = await logStorage.getLogsForSession(sessionId);
    setLogs(data);
    setLoading(false);
  };

  const handleDeleteSession = async (event: Event, sessionId: string) => {
    event.stopPropagation();
    if (confirm(t("history.deleteConfirm"))) {
      await logStorage.deleteSession(sessionId);
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setLogs([]);
      }
      await loadSessions();
    }
  };

  const handleCopyLogs = () => {
    const text = logs
      .map((dbEntry) => {
        const log = convertDBEntryToLogEntry(dbEntry);
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
        console.error("Failed to copy session logs:", error);
        alert(t("log.copyFailure"));
      });
  };

  const formatDateTime = (value: number) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(value));

  const formatTime = (value: number) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
    }).format(new Date(value));

  const toDataView = (data: Uint8Array): DataView =>
    new DataView(data.buffer, data.byteOffset, data.byteLength);

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div class="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
          <h2 class="text-xl font-bold text-slate-800">{t("history.title")}</h2>
          <button
            onClick={onClose}
            class="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="flex flex-1 overflow-hidden">
          <div class="w-1/3 overflow-y-auto border-r border-slate-200 bg-slate-50">
            {loading && !selectedSessionId ? (
              <div class="p-4 text-center text-slate-500">{t("history.loading")}</div>
            ) : sessions.length === 0 ? (
              <div class="p-4 text-center text-sm text-slate-500">{t("history.emptySessions")}</div>
            ) : (
              <ul class="divide-y divide-slate-200">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      onClick={() => handleSelectSession(session.id)}
                      class={`group flex w-full items-start justify-between border-l-4 p-4 text-left transition-colors hover:bg-slate-100 ${
                        selectedSessionId === session.id
                          ? "border-brand-500 bg-brand-50"
                          : "border-transparent"
                      }`}
                    >
                      <div class="mr-4 overflow-hidden">
                        <div class="truncate font-semibold text-slate-800">
                          {session.deviceName}
                        </div>
                        <div class="mt-1 text-xs text-slate-500">
                          {formatDateTime(session.startTime)}
                        </div>
                        <div class="text-xs text-slate-500">
                          {t("history.logCount", { count: session.logCount })}
                        </div>
                      </div>
                      <div
                        onClick={(event) => handleDeleteSession(event, session.id)}
                        class="rounded p-1 text-red-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                        title={t("history.deleteSession")}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div class="relative flex w-2/3 flex-col overflow-hidden bg-slate-900">
            {loading && selectedSessionId ? (
              <div class="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 text-white">
                {t("history.loadingLogs")}
              </div>
            ) : null}

            {selectedSessionId ? (
              <>
                <div class="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2 text-white">
                  <h3 class="flex-1 truncate text-sm font-semibold">
                    {sessions.find((session) => session.id === selectedSessionId)?.deviceName}{" "}
                    {t("history.logsSuffix")}
                  </h3>
                  <button
                    onClick={handleCopyLogs}
                    class="ml-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
                  >
                    {t("history.copyText")}
                  </button>
                </div>
                <div class="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 text-slate-300">
                  {logs.length === 0 ? (
                    <div class="py-10 text-center italic text-slate-500">{t("history.noLogs")}</div>
                  ) : (
                    logs.map((log, index) => {
                      const runtimeLog = convertDBEntryToLogEntry(log);
                      const message = resolveLocalizedText(locale, runtimeLog);
                      return (
                        <div key={index} class="flex gap-2">
                          <span class="whitespace-nowrap text-slate-500">
                            {formatTime(log.timestamp)}
                          </span>
                          <span
                            class={`whitespace-nowrap font-bold ${
                              log.type === "error"
                                ? "text-red-400"
                                : log.type === "info"
                                  ? "text-blue-400"
                                  : "text-green-400"
                            }`}
                          >
                            [{runtimeLog.type.toUpperCase()}]
                          </span>
                          <span class="break-all">
                            {message && <span class="mr-2">{message}</span>}
                            {log.charUuid && (
                              <span class="mr-2 text-slate-400">{log.charUuid}</span>
                            )}
                            {log.data && (
                              <span class="mr-2 text-amber-300">{toHex(toDataView(log.data))}</span>
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div class="flex flex-1 items-center justify-center text-slate-500">
                {t("history.selectSession")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
