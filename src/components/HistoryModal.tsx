import { useState, useEffect } from 'preact/hooks';
import { logStorage, type SessionRecord, type PersistedLogEntry, convertDBEntryToLogEntry } from '../lib/storage';
import { toHex, toAscii } from '../lib/utils';

export default function HistoryModal({ onClose }: { onClose: () => void }) {
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

    const handleDeleteSession = async (e: Event, sessionId: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this session?')) {
            await logStorage.deleteSession(sessionId);
            if (selectedSessionId === sessionId) {
                setSelectedSessionId(null);
                setLogs([]);
            }
            await loadSessions();
        }
    };

    const handleCopyLogs = () => {
        const text = logs.map(dbEntry => {
            const log = convertDBEntryToLogEntry(dbEntry);
            const time = new Date(log.timestamp).toISOString();
            const hex = log.data ? toHex(log.data) : '';
            const ascii = log.data ? toAscii(log.data) : '';
            return `[${time}] ${log.type.toUpperCase()}: ${log.message || ''} ${log.charUuid || ''} Hex:${hex} Ascii:${ascii}`;
        }).join('\n');
        
        navigator.clipboard.writeText(text).then(() => {
            alert('Logs copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };

    /**
     * PersistedLogEntry の data (Uint8Array) を DataView に変換する。
     * convertDBEntryToLogEntry を使わずにインライン表示する箇所で利用。
     */
    const toDataView = (data: Uint8Array): DataView => {
        return new DataView(data.buffer, data.byteOffset, data.byteLength);
    };

    return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col h-[80vh] overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                    <h2 class="text-xl font-bold text-slate-800">Session History</h2>
                    <button onClick={onClose} class="text-slate-500 hover:text-slate-800 p-1 rounded hover:bg-slate-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div class="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div class="w-1/3 border-r border-slate-200 bg-slate-50 overflow-y-auto">
                        {loading && !selectedSessionId ? (
                            <div class="p-4 text-center text-slate-500">Loading...</div>
                        ) : sessions.length === 0 ? (
                            <div class="p-4 text-center text-slate-500 text-sm">No saved sessions</div>
                        ) : (
                            <ul class="divide-y divide-slate-200">
                                {sessions.map(s => (
                                    <li key={s.id}>
                                        <button 
                                            onClick={() => handleSelectSession(s.id)}
                                            class={`w-full text-left p-4 hover:bg-slate-100 transition-colors flex justify-between items-start group ${selectedSessionId === s.id ? 'bg-brand-50 border-l-4 border-brand-500' : 'border-l-4 border-transparent'}`}
                                        >
                                            <div class="overflow-hidden">
                                                <div class="font-semibold text-slate-800 truncate">{s.deviceName}</div>
                                                <div class="text-xs text-slate-500 mt-1">{new Date(s.startTime).toLocaleString()}</div>
                                                <div class="text-xs text-slate-500">{s.logCount} logs</div>
                                            </div>
                                            <div 
                                                onClick={(e) => handleDeleteSession(e, s.id)}
                                                class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 p-1 rounded"
                                                title="Delete session"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    
                    {/* Log Viewer */}
                    <div class="w-2/3 flex flex-col bg-slate-900 overflow-hidden relative">
                        {loading && selectedSessionId ? (
                            <div class="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10 text-white">Loading logs...</div>
                        ) : null}
                        
                        {selectedSessionId ? (
                            <>
                                <div class="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 text-white">
                                    <h3 class="text-sm font-semibold truncate flex-1">{sessions.find(s => s.id === selectedSessionId)?.deviceName} Logs</h3>
                                    <button 
                                        onClick={handleCopyLogs}
                                        class="text-xs text-slate-300 hover:text-white px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors ml-4"
                                    >
                                        Copy Text
                                    </button>
                                </div>
                                <div class="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 text-slate-300 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                                    {logs.length === 0 ? (
                                        <div class="text-slate-500 italic text-center py-10">No logs in this session.</div>
                                    ) : (
                                        logs.map((log, i) => (
                                            <div key={i} class="flex gap-2">
                                                <span class="text-slate-500 whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                                                </span>
                                                <span class={`font-bold whitespace-nowrap ${
                                                    log.type === 'error' ? 'text-red-400' :
                                                    log.type === 'info' ? 'text-blue-400' :
                                                    'text-green-400'
                                                }`}>
                                                    [{log.type.toUpperCase()}]
                                                </span>
                                                <span class="break-all">
                                                    {log.message && <span class="mr-2">{log.message}</span>}
                                                    {log.charUuid && <span class="text-slate-400 mr-2">{log.charUuid}</span>}
                                                    {log.data && (
                                                        <span class="text-amber-300 mr-2">{toHex(toDataView(log.data))}</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div class="flex-1 flex justify-center items-center text-slate-500">
                                Select a session from the left to view logs
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
