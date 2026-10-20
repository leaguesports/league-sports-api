import {
  generateParticipantToken,
  hashParticipantToken,
  participantTokensMatch,
} from "./participantToken";

describe("participant tokens", () => {
  test("stores a sha256 hash and compares it in constant time", () => {
    const token = generateParticipantToken();
    const hash = hashParticipantToken(token);

    expect(token).not.toBe(hash);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(participantTokensMatch(token, hash)).toBe(true);
    expect(participantTokensMatch(`${token}x`, hash)).toBe(false);
    expect(participantTokensMatch(token, "ab")).toBe(false);
  });
});
