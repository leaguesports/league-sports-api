import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Unambiguous alphabet: no 0/O/1/I. 32 symbols, so a random byte maps evenly. */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let code = "";
  for (let index = 0; index < 4; index++) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

export function generateSecretToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    const dummy = Buffer.alloc(rightBuffer.length);
    timingSafeEqual(dummy, rightBuffer);
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/** Compare a stored sha256 hex digest to the hash of a presented token. */
export function hashEquals(storedHex: string, presentedToken: string): boolean {
  const stored = Buffer.from(storedHex, "hex");
  const presented = Buffer.from(hashToken(presentedToken), "hex");
  if (stored.length !== presented.length || stored.length === 0) {
    return false;
  }
  return timingSafeEqual(stored, presented);
}
