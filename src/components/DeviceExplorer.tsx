import { bleState, type ServiceInfo, type CharacteristicInfo } from '../lib/store';

export default function DeviceExplorer() {
    const { device, services, status } = bleState.value;

    if (!device) return null;

    return (
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold text-slate-900">{device.name || 'Unknown Device'}</h2>
                        <p class="text-sm text-slate-500 font-mono">{device.id}</p>
                    </div>
                    <div>
                        <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            status === 'connected' ? 'bg-green-100 text-green-800' : 
                            status === 'connecting' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                            {status === 'connected' ? 'Connected' : status}
                        </span>
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-lg font-semibold text-slate-800">Services & Characteristics</h3>
                {services.length === 0 ? (
                    <div class="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                        {status === 'connecting' ? 'Discovering services...' : 'No services found or not connected.'}
                    </div>
                ) : (
                    <div class="space-y-4">
                        {services.map((service) => (
                            <ServiceItem key={service.uuid} service={service} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ServiceItem({ service }: { service: ServiceInfo }) {
    return (
        <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div class="font-mono text-sm text-slate-700 font-medium">{service.uuid}</div>
                <div class="text-xs text-slate-400">Service</div>
            </div>
            <div class="divide-y divide-slate-100">
                {service.characteristics.map((char) => (
                    <CharacteristicItem key={char.uuid} char={char} />
                ))}
            </div>
        </div>
    );
}

import { BluetoothManager } from '../lib/ble-client';
import { addLog, setSubscriptionStatus, setError } from '../lib/store';

function CharacteristicItem({ char }: { char: CharacteristicInfo }) {
    const { activeSubscriptions } = bleState.value;
    const isSubscribed = activeSubscriptions.has(char.uuid);
    
    // Check if notify/indicate is supported
    const supportsNotify = char.properties.notify || char.properties.indicate;

    const toggleSubscribe = async () => {
        if (!char.instance) return;
        const manager = new BluetoothManager();
        
        try {
            if (isSubscribed) {
                await manager.stopNotifications(char.instance, handleNotification);
                setSubscriptionStatus(char.uuid, false);
                addLog({ timestamp: Date.now(), type: 'info', message: `Unsubscribed from ${shortenUuid(char.uuid)}` });
            } else {
                await manager.startNotifications(char.instance, handleNotification);
                setSubscriptionStatus(char.uuid, true);
                addLog({ timestamp: Date.now(), type: 'info', message: `Subscribed to ${shortenUuid(char.uuid)}` });
            }
        } catch (e: any) {
            console.error(e);
            setError(`Failed to toggle subscription: ${e.message}`);
        }
    };

    const handleNotification = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (!target.value) return;
        
        addLog({
            timestamp: Date.now(),
            type: 'notification',
            serviceUuid: target.service.uuid,
            charUuid: target.uuid,
            data: target.value
        });
    };

    return (
        <div class="px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between group gap-2">
            <div class="flex items-center gap-3">
                 <div class={`w-2 h-2 rounded-full shrink-0 ${isSubscribed ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                 <div class="font-mono text-sm text-slate-600 truncate" title={char.uuid}>{shortenUuid(char.uuid)}</div>
            </div>
            
            <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <div class="flex gap-2 flex-wrap">
                    {char.properties.read && <Badge label="READ" color="blue" />}
                    {char.properties.write && <Badge label="WRITE" color="amber" />}
                    {char.properties.notify && <Badge label="NOTIFY" color="purple" />}
                    {char.properties.indicate && <Badge label="INDICATE" color="indigo" />}
                </div>
                
                {supportsNotify && (
                    <button
                        onClick={toggleSubscribe}
                        class={`text-xs px-3 py-1 rounded border transition-colors shrink-0 ${
                            isSubscribed
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                        {isSubscribed ? 'Stop' : 'Subscribe'}
                    </button>
                )}
            </div>
        </div>
    );
}

// Helper (duplicated for now, could be shared)
function shortenUuid(uuid: string) {
    if (uuid.startsWith('0000') && uuid.endsWith('-0000-1000-8000-00805f9b34fb')) {
        return '0x' + uuid.substring(4, 8).toUpperCase();
    }
    return uuid.substring(0, 8) + '...';
}

function Badge({ label, color }: { label: string, color: 'blue' | 'amber' | 'purple' | 'indigo' }) {
    const colors = {
        blue: 'bg-blue-100 text-blue-700',
        amber: 'bg-amber-100 text-amber-700',
        purple: 'bg-purple-100 text-purple-700',
        indigo: 'bg-indigo-100 text-indigo-700',
    };
    
    return (
        <span class={`text-[10px] font-bold px-2 py-0.5 rounded ${colors[color]}`}>
            {label}
        </span>
    );
}
