import { signal } from '@preact/signals';

export type BluetoothStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface CharacteristicInfo {
    uuid: string;
    properties: {
        read: boolean;
        write: boolean;
        notify: boolean;
        indicate: boolean;
    };
    instance: BluetoothRemoteGATTCharacteristic | null; // Non-serializable, reference only
}

export interface ServiceInfo {
    uuid: string;
    characteristics: CharacteristicInfo[];
}

export interface LogEntry {
    timestamp: number;
    type: 'notification' | 'read' | 'write' | 'info' | 'error';
    serviceUuid?: string;
    charUuid?: string;
    data?: DataView; // We will store raw data
    message?: string;
}

export interface BLEState {
    status: BluetoothStatus;
    device: BluetoothDevice | null;
    services: ServiceInfo[];
    error: string | null;
    logs: LogEntry[];
    activeSubscriptions: Set<string>; // Set of characteristic UUIDs
}

export const bleState = signal<BLEState>({
    status: 'disconnected',
    device: null,
    services: [],
    error: null,
    logs: [],
    activeSubscriptions: new Set()
});

// Helper actions
export const resetState = () => {
    bleState.value = {
        status: 'disconnected',
        device: null,
        services: [],
        error: null,
        logs: [],
        activeSubscriptions: new Set()
    };
};

export const setStatus = (status: BluetoothStatus) => {
    bleState.value = { ...bleState.value, status };
};

export const setError = (error: string) => {
    bleState.value = { ...bleState.value, status: 'error', error };
    addLog({ timestamp: Date.now(), type: 'error', message: error });
};

export const setDevice = (device: BluetoothDevice) => {
    bleState.value = { ...bleState.value, device };
};

export const addLog = (entry: LogEntry) => {
    // Limit logs to keep memory usage in check (e.g. 1000 entries)
    const newLogs = [...bleState.value.logs, entry];
    if (newLogs.length > 1000) {
        newLogs.shift();
    }
    bleState.value = { ...bleState.value, logs: newLogs };
};

export const clearLogs = () => {
    bleState.value = { ...bleState.value, logs: [] };
};

export const setSubscriptionStatus = (charUuid: string, isSubscribed: boolean) => {
    const newSet = new Set(bleState.value.activeSubscriptions);
    if (isSubscribed) {
        newSet.add(charUuid);
    } else {
        newSet.delete(charUuid);
    }
    bleState.value = { ...bleState.value, activeSubscriptions: newSet };
};
