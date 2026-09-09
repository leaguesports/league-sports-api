import { DomainError } from "../../../lib/domain-error";
import { hintFrom, maskHint, TokenCipher } from "./token-cipher";

describe(TokenCipher, () => {
  const cipher = new TokenCipher("test-encryption-secret");

  test("encrypts a token and decrypts the ciphertext", () => {
    const token = "import-token-secret-value";
    const stored = cipher.encrypt(token);

    expect(stored.encryptedValue).not.toContain(token);
    expect(stored.hint).toBe("alue");
    expect(cipher.decrypt(stored.encryptedValue)).toBe(token);
  });

  test("does not persist or hint the full secret", () => {
    const stored = cipher.encrypt("abcd1234");
    expect(stored.hint).toBe("1234");
    expect(maskHint(stored.hint)).toBe("••••1234");
    expect(stored.encryptedValue.includes("abcd1234")).toBe(false);
  });

  test("rejects blank tokens", () => {
    expect(() => cipher.encrypt("   ")).toThrow(DomainError);
  });
});

describe(hintFrom, () => {
  test("uses the last four characters", () => {
    expect(hintFrom("xy")).toBe("xy");
    expect(hintFrom("token-99")).toBe("n-99");
  });
});
