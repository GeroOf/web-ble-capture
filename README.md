# Web BLE Network Capture

A web-based tool to capture and analyze BLE (Bluetooth Low Energy) network traffic.

## Features

- **Search & Connect**: Filter the browser chooser by device name, prefix and service UUID, with validation and connection progress.
- **GATT Operations**: Read, write with or without response, subscribe to value changes, and inspect/read/write descriptors where the browser and device permit.
- **Packet Presentation**: Choose Hex/ASCII, UTF-8, decimal, binary, Base64, UInt16 LE/BE or JSON, and clock/ISO/elapsed timestamps. Copy the selected representation.
- **Hardware-free Demo**: Use the same connection and packet UI with a synthetic peripheral, sample reads/writes and notifications.
- **Local Capture**: Keep the latest 1000 entries and up to 20 sessions in tab memory. Capture history is cleared on reload; device identities and packets are not written to browser storage or sent to analytics.

## Getting Started

### Prerequisites

- A modern browser with Web Bluetooth API support (Chrome, Edge, Opera, etc.).
- A BLE-capable device for real connections. Demo mode also works when Web Bluetooth is unavailable.
- For local development: Node.js 22.22.2+ within 22.x, 24.15.0+ within 24.x, or 26+, and npm 9.6.5+.

### Installation

No installation is required to use the hosted version.
To run locally:

1. Clone the repository:

   ```sh
   git clone https://github.com/GeroOf/web-ble-capture.git
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Start the development server:

   ```sh
   npm run dev
   ```

## Usage

1. Open the application in your browser.
2. Click the "Scan" button to search for devices.
3. Select a device to connect.
4. Interact with the device via the UI.

### Demo without a BLE device

Select **Demo (no BLE device)** under **Connection mode**, then click **Connect demo device**. Read the Battery or sample characteristic, write Hex/UTF-8 to the writable sample, load descriptors, or subscribe and generate a sample notification. A banner identifies synthetic data.

To start with demo selected, overriding the saved initial mode:

```sh
PUBLIC_BLE_DEMO=true npm run dev
```

For a static build, set the same environment variable before building. Use a new output directory to preserve existing output:

```sh
ble_demo_output="$(mktemp -d /tmp/web-ble-demo.XXXXXX)"
PUBLIC_BLE_DEMO=true npm run build -- --outDir "$ble_demo_output"
```

The flag selects the initial mode; it does not connect automatically. Presentation settings and UUID aliases may persist, but device names, IDs, connection state and packet logs do not. Existing IndexedDB capture records are not read, changed or deleted.

## Verification

```sh
npm run check
npm run lint
npm test -- --run
npm run test:e2e
npm run skills:check
```

The E2E tests require installed Google Chrome. They build normal and demo configurations into new temporary directories and use local static servers and simulated Bluetooth devices. They cover both locales, JavaScript disabled, search validation, cancellation and delayed connection, read/write/descriptor operations, display formats, subscriptions, bounded logs and non-persistent capture. They do not verify physical BLE devices.

The project uses the official npm registry and disables installation scripts in `.npmrc`. Review an installation script before enabling it for a specific dependency. Engine checks reject unsupported Node.js or npm versions.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
