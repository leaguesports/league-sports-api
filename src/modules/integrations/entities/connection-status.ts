import { DomainError } from "../../../lib/domain-error";

export type ConnectionStatusValue = "connected" | "disconnected";

export class ConnectionStatus {
  static readonly CONNECTED = new ConnectionStatus("connected");
  static readonly DISCONNECTED = new ConnectionStatus("disconnected");

  private constructor(readonly value: ConnectionStatusValue) {}

  static from(raw: unknown): ConnectionStatus {
    if (raw === "connected") return ConnectionStatus.CONNECTED;
    if (raw === "disconnected") return ConnectionStatus.DISCONNECTED;
    throw new DomainError("status must be connected or disconnected");
  }

  get isConnected(): boolean {
    return this.value === "connected";
  }

  get isDisconnected(): boolean {
    return this.value === "disconnected";
  }

  equals(other: ConnectionStatus): boolean {
    return this.value === other.value;
  }
}
