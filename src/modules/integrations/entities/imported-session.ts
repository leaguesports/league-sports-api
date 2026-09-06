import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export const IMPORTED_SESSION_SPORTS = ["padel", "golf", "other"] as const;
export type ImportedSessionSport = (typeof IMPORTED_SESSION_SPORTS)[number];

export type ImportedSessionSnapshot = {
  id: string;
  sport: ImportedSessionSport;
  playedAt: string;
  title: string | null;
  notes: string | null;
  metrics: Record<string, string | number>;
};

const MAX_TITLE = 80;
const MAX_NOTES = 500;
const MAX_METRIC_KEYS = 20;
const MAX_METRIC_KEY = 40;

export class ImportedSession {
  private constructor(
    readonly id: string,
    readonly sport: ImportedSessionSport,
    readonly playedAt: Date,
    readonly title: string | null,
    readonly notes: string | null,
    readonly metrics: Readonly<Record<string, string | number>>,
  ) {}

  static from(raw: unknown): ImportedSession {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new DomainError("session must be an object");
    }

    const body = raw as Record<string, unknown>;
    return new ImportedSession(
      typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : randomUUID(),
      parseSport(body.sport),
      parsePlayedAt(body.playedAt),
      parseOptionalText(body.title, "title", MAX_TITLE),
      parseOptionalText(body.notes, "notes", MAX_NOTES),
      parseMetrics(body.metrics),
    );
  }

  static fromSnapshot(snapshot: ImportedSessionSnapshot): ImportedSession {
    return ImportedSession.from(snapshot);
  }

  toSnapshot(): ImportedSessionSnapshot {
    return {
      id: this.id,
      sport: this.sport,
      playedAt: this.playedAt.toISOString(),
      title: this.title,
      notes: this.notes,
      metrics: { ...this.metrics },
    };
  }
}

function parseSport(raw: unknown): ImportedSessionSport {
  const sport = requiredTrimmed(raw, "sport").toLowerCase();
  if ((IMPORTED_SESSION_SPORTS as readonly string[]).includes(sport)) {
    return sport as ImportedSessionSport;
  }
  throw new DomainError("sport must be padel, golf, or other");
}

function parsePlayedAt(raw: unknown): Date {
  const value = requiredTrimmed(raw, "playedAt");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("playedAt must be a valid ISO date");
  }
  return date;
}

function parseOptionalText(
  raw: unknown,
  field: string,
  max: number,
): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError(`${field} must be a string`);
  }
  const value = raw.trim();
  if (value.length === 0) return null;
  if (value.length > max) {
    throw new DomainError(`${field} must be at most ${max} characters`);
  }
  return value;
}

function parseMetrics(raw: unknown): Record<string, string | number> {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new DomainError("metrics must be an object");
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_METRIC_KEYS) {
    throw new DomainError(`metrics may have at most ${MAX_METRIC_KEYS} keys`);
  }

  const metrics: Record<string, string | number> = {};
  for (const [key, value] of entries) {
    const name = key.trim();
    if (!name || name.length > MAX_METRIC_KEY) {
      throw new DomainError(
        `metric keys must be 1-${MAX_METRIC_KEY} characters`,
      );
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      metrics[name] = value;
      continue;
    }
    if (typeof value === "string") {
      const text = value.trim();
      if (text.length === 0) {
        throw new DomainError("metric values must not be blank");
      }
      metrics[name] = text;
      continue;
    }
    throw new DomainError("metric values must be strings or numbers");
  }
  return metrics;
}
