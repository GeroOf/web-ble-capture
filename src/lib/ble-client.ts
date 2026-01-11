export class BluetoothManager {
  /**
   * Checks if Web Bluetooth API is supported in the current environment.
   */
  static isSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    return !!navigator.bluetooth;
  }

  /**
   * Request a Bluetooth device from the user.
   * Currently uses acceptAllDevices: true to allow discovery of any device.
   * Note: optionalServices might need to be populated for specific service access later.
   */
  async scan(additionalServices: string[] = []): Promise<BluetoothDevice> {
    if (!BluetoothManager.isSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser.');
    }

    try {
      // Default common services
      const defaultServices = [
          'generic_access',
          'generic_attribute',
          'battery_service',
          'device_information',
          'environmental_sensing'
      ];

      // Merge and deduplicate
      const optionalServices = Array.from(new Set([...defaultServices, ...additionalServices]));

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices
      });
      return device;
    } catch (error) {
      console.error('User cancelled or error during scan:', error);
      throw error;
    }
  }

  async connect(device: BluetoothDevice): Promise<BluetoothRemoteGATTServer> {
    if (!device.gatt) {
        throw new Error('Device does not support GATT');
    }
    // If already connected, return it
    if (device.gatt.connected) {
        return device.gatt;
    }
    return await device.gatt.connect();
  }

  disconnect(device: BluetoothDevice) {
    if (device.gatt && device.gatt.connected) {
        device.gatt.disconnect();
    }
  }

  async getServices(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTService[]> {
    return await server.getPrimaryServices();
  }

  async getCharacteristics(service: BluetoothRemoteGATTService): Promise<BluetoothRemoteGATTCharacteristic[]> {
    return await service.getCharacteristics();
  }

  async startNotifications(
    characteristic: BluetoothRemoteGATTCharacteristic, 
    callback: (event: Event) => void
  ): Promise<void> {
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', callback);
  }

  async stopNotifications(
    characteristic: BluetoothRemoteGATTCharacteristic, 
    callback: (event: Event) => void
  ): Promise<void> {
    await characteristic.stopNotifications();
    characteristic.removeEventListener('characteristicvaluechanged', callback);
  }
}
