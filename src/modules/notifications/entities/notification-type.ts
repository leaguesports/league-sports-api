import { DomainError } from "../../../lib/domain-error";

export const NOTIFICATION_TYPES = ["organised_game_invite"] as const;
export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number];

export class NotificationType {
  static readonly ORGANISED_GAME_INVITE = new NotificationType(
    "organised_game_invite",
  );

  private constructor(readonly value: NotificationTypeValue) {}

  static from(raw: unknown): NotificationType {
    if (typeof raw !== "string") {
      throw new DomainError("notification type is required");
    }

    const type = raw.trim().toLowerCase();
    if (type === "organised_game_invite") {
      return NotificationType.ORGANISED_GAME_INVITE;
    }

    throw new DomainError("Unknown notification type");
  }

  get isOrganisedGameInvite(): boolean {
    return this.value === "organised_game_invite";
  }

  equals(other: NotificationType): boolean {
    return this.value === other.value;
  }
}
