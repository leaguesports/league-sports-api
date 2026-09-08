import { DomainError } from "../../../lib/domain-error";

export const LOBBY_OPEN_GAME_STATUSES = [
  "open",
  "filled",
  "cancelled",
  "expired",
] as const;
export type LobbyOpenGameStatusValue = (typeof LOBBY_OPEN_GAME_STATUSES)[number];

export class LobbyOpenGameStatus {
  static readonly OPEN = new LobbyOpenGameStatus("open");
  static readonly FILLED = new LobbyOpenGameStatus("filled");
  static readonly CANCELLED = new LobbyOpenGameStatus("cancelled");
  static readonly EXPIRED = new LobbyOpenGameStatus("expired");

  private constructor(readonly value: LobbyOpenGameStatusValue) {}

  static from(raw: unknown): LobbyOpenGameStatus {
    if (typeof raw !== "string") {
      throw new DomainError("status must be open, filled, cancelled, or expired");
    }
    const status = raw.trim().toLowerCase();
    if (status === "open") return LobbyOpenGameStatus.OPEN;
    if (status === "filled") return LobbyOpenGameStatus.FILLED;
    if (status === "cancelled") return LobbyOpenGameStatus.CANCELLED;
    if (status === "expired") return LobbyOpenGameStatus.EXPIRED;
    throw new DomainError("status must be open, filled, cancelled, or expired");
  }

  get isOpen(): boolean {
    return this.value === "open";
  }

  get isFilled(): boolean {
    return this.value === "filled";
  }

  equals(other: LobbyOpenGameStatus): boolean {
    return this.value === other.value;
  }
}
