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
  async scan(): Promise<BluetoothDevice> {
    if (!BluetoothManager.isSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser.');
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [] // We might need to add common services here later
      });
      return device;
    } catch (error) {
      console.error('User cancelled or error during scan:', error);
      throw error;
    }
  }
}
