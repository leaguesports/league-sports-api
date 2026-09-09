import { DomainError } from "../../../lib/domain-error";

export const NOTES_MAX_LENGTH = 280;

export class OrganisedGameNotes {
  private constructor(readonly value: string) {}

  static from(raw: unknown): OrganisedGameNotes | null {
    if (raw == null) return null;
    if (typeof raw !== "string") {
      throw new DomainError("notes must be a string");
    }

    const notes = raw.trim();
    if (notes.length === 0) return null;
    if (notes.length > NOTES_MAX_LENGTH) {
      throw new DomainError(
        `notes must be at most ${NOTES_MAX_LENGTH} characters`,
      );
    }
    return new OrganisedGameNotes(notes);
  }
}
