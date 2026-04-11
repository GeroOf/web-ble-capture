import { useState, useEffect } from 'preact/hooks';
import { localPrefs } from '../lib/storage';

export default function AliasManagerModal({ onClose }: { onClose: () => void }) {
    const [aliases, setAliases] = useState<Record<string, string>>({});
    const [newUuid, setNewUuid] = useState('');
    const [newName, setNewName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        setAliases(localPrefs.aliases);
    }, []);

    const handleSave = () => {
        if (!newUuid.trim() || !newName.trim()) {
            setError('UUID and Name are required.');
            return;
        }
        
        // Basic UUID validation (allows 16-bit, 32-bit, or 128-bit format roughly)
        const cleanUuid = newUuid.trim().toLowerCase();
        
        const newAliases = { ...aliases, [cleanUuid]: newName.trim() };
        localPrefs.aliases = newAliases;
        setAliases(newAliases);
        setNewUuid('');
        setNewName('');
        setError('');
    };

    const handleDelete = (uuid: string) => {
        const newAliases = { ...aliases };
        delete newAliases[uuid];
        localPrefs.aliases = newAliases;
        setAliases(newAliases);
    };

    return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                    <h2 class="text-xl font-bold text-slate-800">UUID Aliases</h2>
                    <button onClick={onClose} class="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div class="p-6 overflow-y-auto flex-1">
                    <p class="text-sm text-slate-600 mb-6">
                        Map complex UUIDs to human-readable names. These aliases will replace standard UUID displays in the device explorer and logs.
                    </p>
                    
                    <div class="space-y-4 mb-8">
                        <h3 class="font-semibold text-slate-800 text-sm">Add New Alias</h3>
                        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <input 
                                type="text"
                                placeholder="UUID (e.g. 0000aaaa-... or 1234)"
                                value={newUuid}
                                onInput={(e) => setNewUuid(e.currentTarget.value)}
                                class="flex-1 w-full px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            <input 
                                type="text"
                                placeholder="Alias (e.g. Temp Sensor)"
                                value={newName}
                                onInput={(e) => setNewName(e.currentTarget.value)}
                                class="flex-1 w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            <button 
                                onClick={handleSave}
                                class="w-full sm:w-auto px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors shrink-0 font-medium text-sm shadow-sm"
                            >
                                Add
                            </button>
                        </div>
                        {error && <p class="text-red-500 text-xs">{error}</p>}
                    </div>

                    <div>
                        <h3 class="font-semibold text-slate-800 text-sm mb-3">Saved Aliases</h3>
                        {Object.keys(aliases).length === 0 ? (
                            <div class="text-slate-500 text-sm italic text-center py-6 bg-slate-50 rounded border border-slate-100">
                                No aliases configured
                            </div>
                        ) : (
                            <ul class="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                                {Object.entries(aliases).map(([uuid, name]) => (
                                    <li key={uuid} class="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                                        <div class="overflow-hidden mr-4">
                                            <div class="font-medium text-slate-800 text-sm">{name}</div>
                                            <div class="text-xs text-slate-500 font-mono truncate">{uuid}</div>
                                        </div>
                                        <button 
                                            onClick={() => handleDelete(uuid)}
                                            class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete alias"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
