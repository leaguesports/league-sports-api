import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const MAX_ENCRYPTED = 4000;
const MAX_HINT = 8;

export class StoredCredential {
  private constructor(
    readonly encryptedValue: string,
    readonly hint: string,
  ) {}

  static fromEncrypted(encryptedValue: unknown, hint: unknown): StoredCredential {
    const encrypted = requiredTrimmed(encryptedValue, "encryptedToken");
    if (encrypted.length > MAX_ENCRYPTED) {
      throw new DomainError("encryptedToken is too long");
    }

    const tokenHint = requiredTrimmed(hint, "tokenHint");
    if (tokenHint.length > MAX_HINT) {
      throw new DomainError(`tokenHint must be at most ${MAX_HINT} characters`);
    }

    return new StoredCredential(encrypted, tokenHint);
  }

  get masked(): string {
    return `••••${this.hint}`;
  }
}
