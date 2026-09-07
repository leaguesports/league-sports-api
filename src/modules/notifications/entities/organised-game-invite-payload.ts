import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const SPORTS = ["padel", "golf"] as const;
export type OrganisedGameInviteSport = (typeof SPORTS)[number];

export type OrganisedGameInvitePayloadSnapshot = {
  organisedGameId: string;
  sport: OrganisedGameInviteSport;
  startsAt: string;
  venueCmsId: string | null;
};

export class OrganisedGameInvitePayload {
  private constructor(
    readonly organisedGameId: string,
    readonly sport: OrganisedGameInviteSport,
    readonly startsAt: Date,
    readonly venueCmsId: string | null,
  ) {}

  static from(raw: unknown): OrganisedGameInvitePayload {
    if (!raw || typeof raw !== "object") {
      throw new DomainError("notification payload is required");
    }

    const record = raw as Record<string, unknown>;
    const organisedGameId = requiredTrimmed(
      record.organisedGameId,
      "organisedGameId",
    );
    const sport = parseSport(record.sport);
    const startsAt = parseStartsAt(record.startsAt);
    const venueCmsId = parseOptionalCmsId(record.venueCmsId);

    return new OrganisedGameInvitePayload(
      organisedGameId,
      sport,
      startsAt,
      venueCmsId,
    );
  }

  toSnapshot(): OrganisedGameInvitePayloadSnapshot {
    return {
      organisedGameId: this.organisedGameId,
      sport: this.sport,
      startsAt: this.startsAt.toISOString(),
      venueCmsId: this.venueCmsId,
    };
  }
}

function parseSport(raw: unknown): OrganisedGameInviteSport {
  if (typeof raw !== "string") {
    throw new DomainError("sport must be padel or golf");
  }
  const sport = raw.trim().toLowerCase();
  if (sport === "padel" || sport === "golf") return sport;
  throw new DomainError("sport must be padel or golf");
}

function parseStartsAt(raw: unknown): Date {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      throw new DomainError("startsAt must be a valid date");
    }
    return raw;
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new DomainError("startsAt is required");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError("startsAt must be a valid date");
  }
  return parsed;
}

function parseOptionalCmsId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("venueCmsId must be a string");
  }
  const value = raw.trim();
  return value.length === 0 ? null : value;
}
