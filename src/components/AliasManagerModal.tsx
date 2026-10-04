import { useState } from "preact/hooks";
import Dialog from "./Dialog";
import { useI18n } from "../lib/i18n";
import { localPrefs } from "../lib/storage";
import { normalizeServiceUuid } from "../lib/ble-input";
import { bleErrorKey } from "../lib/ble-error";

export default function AliasManagerModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [aliases, setAliases] = useState(localPrefs.aliases);
  const [uuid, setUuid] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  function save() {
    if (!uuid.trim() || !name.trim()) {
      setError(t("aliases.requiredError"));
      return;
    }
    try {
      const key = normalizeServiceUuid(uuid);
      const next = { ...aliases, [key]: name.trim() };
      localPrefs.aliases = next;
      setAliases(next);
      setUuid("");
      setName("");
      setError("");
    } catch (error) {
      setError(t(bleErrorKey(error)));
    }
  }
  function remove(key: string) {
    const next = { ...aliases };
    delete next[key];
    localPrefs.aliases = next;
    setAliases(next);
  }
  const input =
    "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300";
  return (
    <Dialog title={t("aliases.title")} onClose={onClose}>
      <p class="mb-4 text-sm text-slate-600">{t("aliases.description")}</p>
      <form
        class="mb-5 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label class="text-sm text-slate-700">
          <span>UUID</span>
          <input
            class={`${input} mt-1 font-mono`}
            value={uuid}
            maxLength={36}
            placeholder={t("aliases.uuidPlaceholder")}
            onInput={(event) => setUuid(event.currentTarget.value)}
          />
        </label>
        <label class="text-sm text-slate-700">
          <span>{t("aliases.addNew")}</span>
          <input
            class={`${input} mt-1`}
            value={name}
            maxLength={128}
            placeholder={t("aliases.aliasPlaceholder")}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>
        {error && (
          <p role="alert" class="text-sm text-red-700 sm:col-span-2">
            {error}
          </p>
        )}
        <button type="submit" class="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white">
          {t("aliases.addNew")}
        </button>
      </form>
      <ul class="space-y-2">
        {Object.entries(aliases).map(([key, value]) => (
          <li key={key} class="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div class="min-w-0 flex-1">
              <p class="break-all text-sm font-medium text-slate-800">{value}</p>
              <code class="break-all text-xs text-slate-500">{key}</code>
            </div>
            <button class="text-sm text-red-700" onClick={() => remove(key)}>
              {t("common.delete")}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
