import { useEffect, useRef, useState } from "preact/hooks";
import Dialog from "./Dialog";
import { resolveLocalizedText, useI18n } from "../lib/i18n";
import { logStorage, localPrefs, type SessionRecord } from "../lib/storage";
import { formatLogText } from "../lib/packet-format";
import type { LogEntry } from "../lib/types";

export default function HistoryModal({ onClose }: { onClose: () => void }) {
  const { locale, t } = useI18n();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selected, setSelected] = useState<SessionRecord | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    void logStorage.getSessions().then((values) => {
      if (active) setSessions(values);
    });
    return () => {
      active = false;
      request.current++;
    };
  }, []);
  async function select(session: SessionRecord) {
    const token = ++request.current;
    setSelected(session);
    setNotice("");
    const values = await logStorage.getLogsForSession(session.id);
    if (request.current === token) setLogs(values);
  }
  async function remove(id: string) {
    await logStorage.deleteSession(id);
    if (selected?.id === id) {
      request.current++;
      setSelected(null);
      setLogs([]);
    }
    setSessions(await logStorage.getSessions());
  }
  const text = logs
    .map((entry) =>
      formatLogText(
        entry,
        resolveLocalizedText(locale, entry),
        localPrefs.packetFormat,
        localPrefs.timeFormat,
        selected?.startTime ?? 0,
        locale,
      ),
    )
    .join("\n");
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("Unavailable");
      await navigator.clipboard.writeText(text);
      setNotice(t("log.copySuccess"));
    } catch {
      setNotice(t("log.copyFailure"));
    }
  }
  return (
    <Dialog title={t("history.title")} onClose={onClose}>
      <p class="mb-4 text-sm text-slate-600">{t("history.memoryOnly")}</p>
      <div class="grid gap-4 md:grid-cols-[240px_1fr]">
        <div class="space-y-2">
          {!sessions.length && <p class="text-sm text-slate-500">{t("history.emptySessions")}</p>}
          {sessions.map((session) => (
            <div key={session.id} class="flex gap-2 rounded-lg border border-slate-200 p-2">
              <button
                class="min-w-0 flex-1 text-left text-sm"
                onClick={() => void select(session)}
                aria-pressed={selected?.id === session.id}
              >
                <span class="block font-medium text-slate-800">
                  {t(session.mode === "demo" ? "history.demoSession" : "history.realSession")}
                </span>
                <time class="block text-xs text-slate-500">
                  {new Date(session.startTime).toLocaleString(locale)}
                </time>
                <span class="text-xs text-slate-500">
                  {t("history.logCount", { count: session.logCount })}
                </span>
              </button>
              <button
                aria-label={t("history.deleteSession")}
                class="rounded px-2 text-sm text-red-700"
                onClick={() => void remove(session.id)}
              >
                {t("common.delete")}
              </button>
            </div>
          ))}
        </div>
        <div class="min-w-0">
          {selected ? (
            <>
              <button
                class="mb-2 rounded border border-slate-300 px-3 py-2 text-sm"
                disabled={!logs.length}
                onClick={() => void copy()}
              >
                {t("history.copyText")}
              </button>
              <pre class="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-200">
                {text || t("history.noLogs")}
              </pre>
            </>
          ) : (
            <p class="text-sm text-slate-500">{t("history.selectSession")}</p>
          )}
          {notice && (
            <p role="status" class="mt-2 text-sm text-slate-600">
              {notice}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
