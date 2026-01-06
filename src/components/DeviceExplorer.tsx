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

function CharacteristicItem({ char }: { char: CharacteristicInfo }) {
    return (
        <div class="px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between">
            <div class="font-mono text-sm text-slate-600">{char.uuid}</div>
            <div class="flex gap-2">
                {char.properties.read && <Badge label="READ" color="blue" />}
                {char.properties.write && <Badge label="WRITE" color="amber" />}
                {char.properties.notify && <Badge label="NOTIFY" color="purple" />}
                {char.properties.indicate && <Badge label="INDICATE" color="indigo" />}
            </div>
        </div>
    );
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
