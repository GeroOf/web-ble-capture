# Web BLE Network Capture

A web-based tool to capture and analyze BLE (Bluetooth Low Energy) network traffic.

## Features

- **Scan & Connect**: Discover and connect to nearby BLE devices using the Web Bluetooth API.
- **Service & Characteristic Discovery**: Explore available services and characteristics on connected devices.
- **Analyze Traffic**: (Add specific analysis features here if implemented, e.g., read/write/notify)
- **Export Data**: (Add export features if implemented)

## Getting Started

### Prerequisites

- A modern browser with Web Bluetooth API support (Chrome, Edge, Opera, etc.).
- A BLE-capable device (computer or smartphone).
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

## Verification

```sh
npm run check
npm run lint
npm test -- --run
npm run test:e2e
npm run skills:check
```

The E2E tests require installed Google Chrome. They build into a new temporary directory and use a local static server and simulated Bluetooth devices. They cover both locales, JavaScript disabled, unsupported browsers, cancellation, notifications and subscription removal. They do not verify physical BLE devices.

The project uses the official npm registry and disables installation scripts in `.npmrc`. Review an installation script before enabling it for a specific dependency. Engine checks reject unsupported Node.js or npm versions.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
