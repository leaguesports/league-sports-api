import { DomainError } from "../../../lib/domain-error";

export const PARTY_SIZE_MIN = 1;
export const PARTY_SIZE_MAX = 3;

export class PartySize {
  private constructor(readonly value: number) {}

  static from(raw: unknown, fallback = 1): PartySize {
    if (raw == null) return new PartySize(fallback);
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      throw new DomainError(
        `partySize must be an integer between ${PARTY_SIZE_MIN} and ${PARTY_SIZE_MAX}`,
      );
    }
    if (raw < PARTY_SIZE_MIN || raw > PARTY_SIZE_MAX) {
      throw new DomainError(
        `partySize must be an integer between ${PARTY_SIZE_MIN} and ${PARTY_SIZE_MAX}`,
      );
    }
    return new PartySize(raw);
  }
}
