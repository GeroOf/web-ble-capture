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

export interface BLEState {
    status: BluetoothStatus;
    device: BluetoothDevice | null;
    services: ServiceInfo[];
    error: string | null;
}

export const bleState = signal<BLEState>({
    status: 'disconnected',
    device: null,
    services: [],
    error: null
});

// Helper actions
export const resetState = () => {
    bleState.value = {
        status: 'disconnected',
        device: null,
        services: [],
        error: null
    };
};

export const setStatus = (status: BluetoothStatus) => {
    bleState.value = { ...bleState.value, status };
};

export const setError = (error: string) => {
    bleState.value = { ...bleState.value, status: 'error', error };
};

export const setDevice = (device: BluetoothDevice) => {
    bleState.value = { ...bleState.value, device };
};
