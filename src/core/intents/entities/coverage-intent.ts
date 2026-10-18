import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import {
  CoverageSport,
  CoverageSportValue,
} from "./coverage-sport";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CITY_LENGTH = 80;
const MAX_SOURCE_PAGE_LENGTH = 500;

export function normalizeCoverageEmail(raw: unknown): string {
  const email = requiredTrimmed(raw, "email").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new DomainError("email is invalid");
  }
  return email;
}

/** Trim + lowercase. Blank / omitted → null (stored as "" for uniqueness). */
export function normalizeCoverageCity(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("city must be a string");
  }
  const city = raw.trim().toLowerCase();
  if (city.length === 0) return null;
  if (city.length > MAX_CITY_LENGTH) {
    throw new DomainError(`city must be at most ${MAX_CITY_LENGTH} characters`);
  }
  return city;
}

export function normalizeSourcePage(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("sourcePage must be a string");
  }
  const value = raw.trim();
  if (value.length === 0) return null;
  if (value.length > MAX_SOURCE_PAGE_LENGTH) {
    throw new DomainError(
      `sourcePage must be at most ${MAX_SOURCE_PAGE_LENGTH} characters`,
    );
  }
  return value;
}

/** Empty string is the stored form of unspecified sport/city. */
export function coverageUniquenessKey(
  sport: string | null,
  city: string | null,
): { sport: string; city: string } {
  return { sport: sport ?? "", city: city ?? "" };
}

export type CoverageIntentSnapshot = {
  id: string;
  email: string;
  sport: CoverageSportValue | null;
  city: string | null;
  sourcePage: string | null;
  createdAt: string;
  unsubscribedAt: string | null;
};

export class CoverageIntent {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly sport: CoverageSport | null,
    readonly city: string | null,
    readonly sourcePage: string | null,
    readonly createdAt: Date,
    private unsubscribedAtValue: Date | null,
  ) {}

  static create(props: {
    id?: string;
    email: unknown;
    sport?: unknown;
    city?: unknown;
    sourcePage?: unknown;
    createdAt?: Date;
  }): CoverageIntent {
    return new CoverageIntent(
      props.id ?? randomUUID(),
      normalizeCoverageEmail(props.email),
      CoverageSport.from(props.sport),
      normalizeCoverageCity(props.city),
      normalizeSourcePage(props.sourcePage),
      props.createdAt ?? new Date(),
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    email: string;
    sport: string | null;
    city: string | null;
    sourcePage: string | null;
    createdAt: Date;
    unsubscribedAt: Date | null;
  }): CoverageIntent {
    return new CoverageIntent(
      props.id,
      props.email,
      CoverageSport.from(props.sport === "" ? null : props.sport),
      props.city === "" ? null : props.city,
      props.sourcePage,
      props.createdAt,
      props.unsubscribedAt,
    );
  }

  static fromSnapshot(snapshot: CoverageIntentSnapshot): CoverageIntent {
    return CoverageIntent.rehydrate({
      id: snapshot.id,
      email: snapshot.email,
      sport: snapshot.sport,
      city: snapshot.city,
      sourcePage: snapshot.sourcePage,
      createdAt: new Date(snapshot.createdAt),
      unsubscribedAt: snapshot.unsubscribedAt
        ? new Date(snapshot.unsubscribedAt)
        : null,
    });
  }

  get unsubscribedAt(): Date | null {
    return this.unsubscribedAtValue;
  }

  get isActive(): boolean {
    return this.unsubscribedAtValue == null;
  }

  get sportValue(): CoverageSportValue | null {
    return this.sport?.value ?? null;
  }

  uniquenessKey(): { sport: string; city: string } {
    return coverageUniquenessKey(this.sportValue, this.city);
  }

  reactivate(sourcePage?: string | null): CoverageIntent {
    return CoverageIntent.rehydrate({
      id: this.id,
      email: this.email,
      sport: this.sportValue,
      city: this.city,
      sourcePage: sourcePage !== undefined ? sourcePage : this.sourcePage,
      createdAt: this.createdAt,
      unsubscribedAt: null,
    });
  }

  unsubscribe(now = new Date()): CoverageIntent {
    if (this.unsubscribedAtValue) return this;
    return CoverageIntent.rehydrate({
      id: this.id,
      email: this.email,
      sport: this.sportValue,
      city: this.city,
      sourcePage: this.sourcePage,
      createdAt: this.createdAt,
      unsubscribedAt: now,
    });
  }

  toSnapshot(): CoverageIntentSnapshot {
    return {
      id: this.id,
      email: this.email,
      sport: this.sportValue,
      city: this.city,
      sourcePage: this.sourcePage,
      createdAt: this.createdAt.toISOString(),
      unsubscribedAt: this.unsubscribedAtValue?.toISOString() ?? null,
    };
  }
}
