import { DomainError } from "../../../lib/domain-error";

export const CAPACITY_MIN = 2;
export const CAPACITY_MAX = 8;

export class OrganisedGameCapacity {
  private constructor(readonly value: number) {}

  static from(raw: unknown, fallback: number): OrganisedGameCapacity {
    if (raw == null) {
      return OrganisedGameCapacity.fromNumber(fallback);
    }

    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      throw new DomainError(
        `capacity must be an integer between ${CAPACITY_MIN} and ${CAPACITY_MAX}`,
      );
    }

    return OrganisedGameCapacity.fromNumber(raw);
  }

  private static fromNumber(value: number): OrganisedGameCapacity {
    if (value < CAPACITY_MIN || value > CAPACITY_MAX) {
      throw new DomainError(
        `capacity must be an integer between ${CAPACITY_MIN} and ${CAPACITY_MAX}`,
      );
    }
    return new OrganisedGameCapacity(value);
  }
}
