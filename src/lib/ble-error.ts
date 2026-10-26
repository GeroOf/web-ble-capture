import { BleInputError } from "./ble-input";

export class GattResourceError extends Error {
  constructor(readonly resource: "services" | "characteristics" | "descriptors") {
    super(`GATT discovery limit exceeded: ${resource}`);
    this.name = "GattResourceError";
  }
}

export function bleErrorKey(error: unknown): string {
  if (error instanceof BleInputError) return `error.input.${error.code}`;
  if (error instanceof GattResourceError) return `error.discovery.${error.resource}`;
  const name = error instanceof Error ? error.name : "";
  if (name === "SecurityError" || name === "NotAllowedError") return "error.permission";
  if (name === "InvalidStateError" || name === "NetworkError" || name === "AbortError")
    return "error.disconnected";
  if (name === "NotSupportedError") return "error.unsupported";
  return "error.operation";
}
