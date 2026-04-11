import { useEffect, useState } from "preact/hooks";
import { useI18n } from "../lib/i18n";
import { localPrefs } from "../lib/storage";

export default function AliasManagerModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [newUuid, setNewUuid] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAliases(localPrefs.aliases);
  }, []);

  const handleSave = () => {
    if (!newUuid.trim() || !newName.trim()) {
      setError(t("aliases.requiredError"));
      return;
    }

    const cleanUuid = newUuid.trim().toLowerCase();
    const newAliases = { ...aliases, [cleanUuid]: newName.trim() };
    localPrefs.aliases = newAliases;
    setAliases(newAliases);
    setNewUuid("");
    setNewName("");
    setError("");
  };

  const handleDelete = (uuid: string) => {
    const newAliases = { ...aliases };
    delete newAliases[uuid];
    localPrefs.aliases = newAliases;
    setAliases(newAliases);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div class="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
          <h2 class="text-xl font-bold text-slate-800">{t("aliases.title")}</h2>
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

        <div class="flex-1 overflow-y-auto p-6">
          <p class="mb-6 text-sm text-slate-600">{t("aliases.description")}</p>

          <div class="mb-8 space-y-4">
            <h3 class="text-sm font-semibold text-slate-800">{t("aliases.addNew")}</h3>
            <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                placeholder={t("aliases.uuidPlaceholder")}
                value={newUuid}
                onInput={(event) => setNewUuid(event.currentTarget.value)}
                class="w-full flex-1 rounded border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                placeholder={t("aliases.aliasPlaceholder")}
                value={newName}
                onInput={(event) => setNewName(event.currentTarget.value)}
                class="w-full flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={handleSave}
                class="w-full shrink-0 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 sm:w-auto"
              >
                {t("aliases.add")}
              </button>
            </div>
            {error && <p class="text-xs text-red-500">{error}</p>}
          </div>

          <div>
            <h3 class="mb-3 text-sm font-semibold text-slate-800">{t("aliases.saved")}</h3>
            {Object.keys(aliases).length === 0 ? (
              <div class="rounded border border-slate-100 bg-slate-50 py-6 text-center text-sm italic text-slate-500">
                {t("aliases.empty")}
              </div>
            ) : (
              <ul class="overflow-hidden rounded-lg border border-slate-200 divide-y divide-slate-100">
                {Object.entries(aliases).map(([uuid, name]) => (
                  <li
                    key={uuid}
                    class="flex items-center justify-between p-3 transition-colors hover:bg-slate-50"
                  >
                    <div class="mr-4 overflow-hidden">
                      <div class="text-sm font-medium text-slate-800">{name}</div>
                      <div class="truncate font-mono text-xs text-slate-500">{uuid}</div>
                    </div>
                    <button
                      onClick={() => handleDelete(uuid)}
                      class="rounded p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title={t("aliases.deleteAlias")}
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
