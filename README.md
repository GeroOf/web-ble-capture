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

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
