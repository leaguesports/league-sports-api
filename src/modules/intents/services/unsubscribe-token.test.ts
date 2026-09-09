import jwt from "jsonwebtoken";

import {
  parseCoverageUnsubscribeToken,
  signCoverageUnsubscribeToken,
} from "./unsubscribe-token";

describe("coverage unsubscribe token", () => {
  const secret = "jwt-test-secret";

  test("round-trips a normalized email", () => {
    const token = signCoverageUnsubscribeToken(secret, "  Foo@Bar.com ");
    expect(parseCoverageUnsubscribeToken(secret, token)).toBe("foo@bar.com");
  });

  test("rejects a token signed with a different secret", () => {
    const token = signCoverageUnsubscribeToken(secret, "a@b.com");
    expect(() => parseCoverageUnsubscribeToken("other", token)).toThrow();
  });

  test("rejects a roadmap token (different purpose)", () => {
    const token = jwt.sign(
      { purpose: "roadmap_unsub", email: "a@b.com" },
      secret,
    );
    expect(() => parseCoverageUnsubscribeToken(secret, token)).toThrow();
  });
});
