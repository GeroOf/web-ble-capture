import { BleInputError } from "./ble-input";

export function bleErrorKey(error: unknown): string {
  if (error instanceof BleInputError) return `error.input.${error.code}`;
  const name = error instanceof Error ? error.name : "";
  if (name === "SecurityError" || name === "NotAllowedError") return "error.permission";
  if (name === "InvalidStateError" || name === "NetworkError" || name === "AbortError")
    return "error.disconnected";
  if (name === "NotSupportedError") return "error.unsupported";
  return "error.operation";
}
