import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const SPORTS = ["padel", "darts", "golf"] as const;
export type LobbyNotificationSport = (typeof SPORTS)[number];

export type LobbyNotificationPayloadSnapshot = {
  source: "lobby";
  sport: LobbyNotificationSport;
  city: string;
  windowStart: string;
  windowEnd: string;
  openGameId: string | null;
  proposalId: string | null;
  organiseGameId: string | null;
};

export class LobbyNotificationPayload {
  private constructor(
    readonly sport: LobbyNotificationSport,
    readonly city: string,
    readonly windowStart: Date,
    readonly windowEnd: Date,
    readonly openGameId: string | null,
    readonly proposalId: string | null,
    readonly organiseGameId: string | null,
  ) {}

  static from(raw: unknown): LobbyNotificationPayload {
    if (!raw || typeof raw !== "object") {
      throw new DomainError("notification payload is required");
    }

    const record = raw as Record<string, unknown>;
    const sport = parseSport(record.sport);
    const city = requiredTrimmed(record.city, "city");
    const windowStart = parseDate(record.windowStart, "windowStart");
    const windowEnd = parseDate(record.windowEnd, "windowEnd");

    return new LobbyNotificationPayload(
      sport,
      city,
      windowStart,
      windowEnd,
      parseOptionalId(record.openGameId, "openGameId"),
      parseOptionalId(record.proposalId, "proposalId"),
      parseOptionalId(record.organiseGameId, "organiseGameId"),
    );
  }

  toSnapshot(): LobbyNotificationPayloadSnapshot {
    return {
      source: "lobby",
      sport: this.sport,
      city: this.city,
      windowStart: this.windowStart.toISOString(),
      windowEnd: this.windowEnd.toISOString(),
      openGameId: this.openGameId,
      proposalId: this.proposalId,
      organiseGameId: this.organiseGameId,
    };
  }
}

function parseSport(raw: unknown): LobbyNotificationSport {
  if (typeof raw !== "string") {
    throw new DomainError("sport must be padel, darts, or golf");
  }
  const sport = raw.trim().toLowerCase();
  if (sport === "padel" || sport === "darts" || sport === "golf") return sport;
  throw new DomainError("sport must be padel, darts, or golf");
}

function parseDate(raw: unknown, field: string): Date {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      throw new DomainError(`${field} must be a valid date`);
    }
    return raw;
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new DomainError(`${field} is required`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError(`${field} must be a valid date`);
  }
  return parsed;
}

function parseOptionalId(raw: unknown, field: string): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError(`${field} must be a string`);
  }
  const value = raw.trim();
  return value.length === 0 ? null : value;
}
