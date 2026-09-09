import { DomainError } from "../../../lib/domain-error";

export const NOTIFICATION_TYPES = [
  "organised_game_invite",
  "lobby_open_game_compatible",
  "lobby_proposal_ready",
  "lobby_open_game_joined",
  "lobby_open_game_filled",
] as const;
export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number];

export class NotificationType {
  static readonly ORGANISED_GAME_INVITE = new NotificationType(
    "organised_game_invite",
  );
  static readonly LOBBY_OPEN_GAME_COMPATIBLE = new NotificationType(
    "lobby_open_game_compatible",
  );
  static readonly LOBBY_PROPOSAL_READY = new NotificationType(
    "lobby_proposal_ready",
  );
  static readonly LOBBY_OPEN_GAME_JOINED = new NotificationType(
    "lobby_open_game_joined",
  );
  static readonly LOBBY_OPEN_GAME_FILLED = new NotificationType(
    "lobby_open_game_filled",
  );

  private constructor(readonly value: NotificationTypeValue) {}

  static from(raw: unknown): NotificationType {
    if (typeof raw !== "string") {
      throw new DomainError("notification type is required");
    }

    const type = raw.trim().toLowerCase();
    switch (type) {
      case "organised_game_invite":
        return NotificationType.ORGANISED_GAME_INVITE;
      case "lobby_open_game_compatible":
        return NotificationType.LOBBY_OPEN_GAME_COMPATIBLE;
      case "lobby_proposal_ready":
        return NotificationType.LOBBY_PROPOSAL_READY;
      case "lobby_open_game_joined":
        return NotificationType.LOBBY_OPEN_GAME_JOINED;
      case "lobby_open_game_filled":
        return NotificationType.LOBBY_OPEN_GAME_FILLED;
      default:
        throw new DomainError("Unknown notification type");
    }
  }

  get isOrganisedGameInvite(): boolean {
    return this.value === "organised_game_invite";
  }

  get isLobby(): boolean {
    return this.value.startsWith("lobby_");
  }

  equals(other: NotificationType): boolean {
    return this.value === other.value;
  }
}
