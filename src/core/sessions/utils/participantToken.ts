import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generateParticipantToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashParticipantToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function participantTokensMatch(token: string, tokenHash: string): boolean {
  const actual = Buffer.from(hashParticipantToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
