import jwt from "jsonwebtoken";

import {
  parseRoadmapUnsubscribeToken,
  signRoadmapUnsubscribeToken,
} from "./unsubscribe-token";

describe("roadmap unsubscribe token", () => {
  const secret = "jwt-test-secret";

  test("round-trips a normalized email", () => {
    const token = signRoadmapUnsubscribeToken(secret, "  Foo@Bar.com ");
    expect(parseRoadmapUnsubscribeToken(secret, token)).toBe("foo@bar.com");
  });

  test("rejects a token signed with a different secret", () => {
    const token = signRoadmapUnsubscribeToken(secret, "a@b.com");
    expect(() => parseRoadmapUnsubscribeToken("other", token)).toThrow();
  });

  test("rejects a token with the wrong purpose", () => {
    const token = jwt.sign({ purpose: "other", email: "a@b.com" }, secret);
    expect(() => parseRoadmapUnsubscribeToken(secret, token)).toThrow();
  });
});
