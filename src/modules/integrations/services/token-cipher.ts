import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const MAX_TOKEN_LENGTH = 512;

export type EncryptedToken = {
  encryptedValue: string;
  hint: string;
};

export class TokenCipher {
  constructor(private readonly secret: string) {
    if (!secret.trim()) {
      throw new DomainError("token encryption secret is required");
    }
  }

  encrypt(rawToken: unknown): EncryptedToken {
    const token = requiredTrimmed(rawToken, "token");
    if (token.length > MAX_TOKEN_LENGTH) {
      throw new DomainError(`token must be at most ${MAX_TOKEN_LENGTH} characters`);
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(token, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      encryptedValue: [
        iv.toString("base64url"),
        tag.toString("base64url"),
        encrypted.toString("base64url"),
      ].join("."),
      hint: hintFrom(token),
    };
  }

  decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(".");
    if (parts.length !== 3) {
      throw new DomainError("encryptedToken is malformed");
    }

    const [ivPart, tagPart, dataPart] = parts;
    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const data = Buffer.from(dataPart, "base64url");

    const decipher = createDecipheriv(ALGORITHM, this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  }

  private key(): Buffer {
    return createHash("sha256").update(this.secret).digest();
  }
}

export function hintFrom(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}

export function maskHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  return `••••${hint}`;
}
