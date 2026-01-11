import { useState } from 'preact/hooks';
import LogConsole from './LogConsole';
import { BluetoothManager } from '../lib/ble-client';
import { bleState, setStatus, setDevice, setError, resetState, addLog, type ServiceInfo, type CharacteristicInfo } from '../lib/store';
import DeviceExplorer from './DeviceExplorer';

export default function App() {
    const { status, error } = bleState.value;
    const [customServices, setCustomServices] = useState('');

    const handleScan = async () => {
        const manager = new BluetoothManager();
        setStatus('connecting');
        
        try {
            const additionalServices = customServices
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            const device = await manager.scan(additionalServices);
            setDevice(device);
            
            // Handle disconnection
            device.addEventListener('gattserverdisconnected', handleDisconnectEvent);
            
            // Connect
            const server = await manager.connect(device);
            
            // Discover
            const services = await manager.getServices(server);
            
            // Map services and characteristics
            const servicesData: ServiceInfo[] = [];
            
            for (const service of services) {
                const chars = await manager.getCharacteristics(service);
                
                const charInfos: CharacteristicInfo[] = chars.map(c => ({
                    uuid: c.uuid,
                    properties: {
                        read: c.properties.read,
                        write: c.properties.write,
                        notify: c.properties.notify,
                        indicate: c.properties.indicate
                    },
                    instance: c
                }));
                
                servicesData.push({
                    uuid: service.uuid,
                    characteristics: charInfos
                });
            }
            
            // Update state
            bleState.value = {
                ...bleState.value,
                status: 'connected',
                services: servicesData
            };
             addLog({ timestamp: Date.now(), type: 'info', message: `Connected to ${device.name}` });
            
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Connection failed');
        }
    };

    const handleDisconnectEvent = () => {
        addLog({ timestamp: Date.now(), type: 'info', message: 'Device disconnected' });
        resetState();
    };

    const handleDisconnect = () => {
        if (bleState.value.device?.gatt?.connected) {
            bleState.value.device.gatt.disconnect();
        }
        // State reset will happen via event listener or we force it if needed, 
        // but event listener is safer for all cases (e.g. out of range).
        // However, if we manually disconnect, the event fires too.
    };

    // Cleanup listener on unmount if needed, though mostly handled by state reset
    // managing the device reference.

    if (status === 'connected') {
        return (
            <div class="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
                 <div class="lg:w-1/3 flex flex-col gap-4 overflow-hidden">
                     <div class="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                        <span class="font-bold text-slate-700">Connected</span>
                        <button 
                            onClick={handleDisconnect}
                            class="text-sm px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                        >
                            Disconnect
                        </button>
                     </div>
                     <div class="flex-1 overflow-y-auto">
                        <DeviceExplorer />
                     </div>
                 </div>
                 
                 <div class="lg:w-2/3 flex flex-col overflow-hidden">
                    <LogConsole />
                 </div>
            </div>
        );
    }

    return (
        <div class="flex flex-col items-center justify-center min-h-[50vh] space-y-8">
             <div class="space-y-4 max-w-2xl text-center">
                <h2 class="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
                    Web BLE <span class="text-brand-600">Capture</span>
                </h2>
                <p class="text-xl text-slate-600">
                    Scan, Connect, and Inspect BLE Peripherals directly from your browser.
                </p>
            </div>

            <div class="w-full max-w-md space-y-4">
                {error && (
                    <div class="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex justify-between items-start">
                        <span>{error}</span>
                        <button onClick={() => setError('')} class="ml-2 text-red-500 hover:text-red-700">&times;</button>
                    </div>
                )}
                
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Additional Service UUIDs (Optional)</label>
                    <input 
                        type="text" 
                        value={customServices}
                        onInput={(e) => setCustomServices(e.currentTarget.value)}
                        placeholder="e.g. 1234, 0000aaaa-0000..."
                        class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
                    />
                    <p class="text-xs text-slate-500">Comma separated full 128-bit UUIDs or 16-bit aliases.</p>
                </div>

                <button
                    onClick={handleScan}
                    disabled={status === 'connecting'}
                    class="w-full px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {status === 'connecting' ? 'Connecting...' : 'Scan & Connect'}
                </button>
            </div>
        </div>
    );
}
