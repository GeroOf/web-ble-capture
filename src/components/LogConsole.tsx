import { useEffect, useRef } from 'preact/hooks';
import { bleState, clearLogs, type LogEntry } from '../lib/store';

export default function LogConsole() {
    const { logs } = bleState.value;
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs.length]);

    const copyLogs = () => {
        const text = logs.map(log => {
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

    return (
        <div class="flex flex-col h-[500px] bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700">
            <div class="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                <div class="flex items-center gap-2">
                    <h3 class="text-sm font-semibold text-slate-100 uppercase tracking-wider">Data Log</h3>
                    <span class="px-2 py-0.5 rounded-full bg-slate-700 text-xs text-slate-300">
                        {logs.length}
                    </span>
                </div>
                <div class="flex gap-4">
                    <button 
                        onClick={copyLogs}
                        class="text-xs text-slate-400 hover:text-white transition-colors hover:underline"
                    >
                        Copy All
                    </button>
                    <button 
                        onClick={clearLogs}
                        class="text-xs text-slate-400 hover:text-white transition-colors hover:underline"
                    >
                        Clear Console
                    </button>
                </div>
            </div>
            
            <div 
                ref={scrollRef}
                class="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
            >
                {logs.length === 0 ? (
                    <div class="text-slate-500 italic text-center py-10">
                        No data captured yet. Subscribe to a characteristic to start logging.
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <LogLine key={index} entry={log} />
                    ))
                )}
            </div>
        </div>
    );
}

function LogLine({ entry }: { entry: LogEntry }) {
    const time = new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });

    return (
        <div class="flex gap-3 hover:bg-slate-800/50 p-1 rounded">
            <span class="text-slate-500 whitespace-nowrap">{time}</span>
            <span class={`font-bold whitespace-nowrap w-24 truncate ${
                entry.type === 'error' ? 'text-red-400' :
                entry.type === 'info' ? 'text-blue-400' :
                'text-green-400'
            }`}>
                [{entry.type.toUpperCase()}]
            </span>
            <div class="flex-1 min-w-0">
                {entry.message && (
                    <span class="text-slate-300">{entry.message}</span>
                )}
                {entry.charUuid && (
                    <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-0.5">
                         <span class="text-slate-400 shrink-0 select-all" title={entry.charUuid}>
                            {shortenUuid(entry.charUuid)}:
                        </span>
                        {entry.data && (
                            <div class="flex gap-4 items-center">
                                <span class="text-amber-300 break-all select-all">{toHex(entry.data)}</span>
                                <span class="text-slate-500 hidden sm:inline-block">|</span>
                                <span class="text-slate-400 break-all select-all">
                                    {toAscii(entry.data)}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helpers
function shortenUuid(uuid: string) {
    if (uuid.startsWith('0000') && uuid.endsWith('-0000-1000-8000-00805f9b34fb')) {
        return '0x' + uuid.substring(4, 8).toUpperCase();
    }
    return uuid.substring(0, 8) + '...';
}

function toHex(data: DataView) {
    const arr = new Uint8Array(data.buffer);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
}

function toAscii(data: DataView) {
    const arr = new Uint8Array(data.buffer);
    let str = '';
    for (let i = 0; i < arr.length; i++) {
        const code = arr[i];
        // Show printable ASCII (32-126)
        if (code >= 32 && code <= 126) {
            str += String.fromCharCode(code);
        } else {
            str += '.';
        }
    }
    return str;
}
