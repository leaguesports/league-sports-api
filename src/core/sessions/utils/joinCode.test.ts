import {
  isJoinCodeConflict,
  JoinCodeAllocationError,
  MAX_JOIN_CODE_ATTEMPTS,
  withJoinCodeRetries,
} from "./joinCode";

describe("join code allocation", () => {
  test("retries a join-code unique conflict and then returns", async () => {
    const codes = ["TAKEN1", "TAKEN1", "FREE11"];
    const seen: string[] = [];

    const result = await withJoinCodeRetries(
      { generate: () => codes.shift() ?? "EXTRA1" },
      async (joinCode) => {
        seen.push(joinCode);
        if (joinCode === "TAKEN1") {
          throw Object.assign(new Error("conflict"), {
            code: "P2002",
            meta: { target: ["Lobby_joinCode_key"] },
          });
        }
        return joinCode;
      },
    );

    expect(result).toBe("FREE11");
    expect(seen).toEqual(["TAKEN1", "TAKEN1", "FREE11"]);
  });

  test("fails clearly when every attempt collides", async () => {
    let attempts = 0;
    await expect(
      withJoinCodeRetries(
        { generate: () => "TAKEN1" },
        async () => {
          attempts += 1;
          throw Object.assign(new Error("conflict"), {
            code: "P2002",
            meta: { target: ["joinCode"] },
          });
        },
      ),
    ).rejects.toBeInstanceOf(JoinCodeAllocationError);

    expect(attempts).toBe(MAX_JOIN_CODE_ATTEMPTS);
  });

  test("does not retry a unique conflict on another field", async () => {
    const error = Object.assign(new Error("email taken"), {
      code: "P2002",
      meta: { target: ["email"] },
    });
    let attempts = 0;

    await expect(
      withJoinCodeRetries(
        { generate: () => "ABC123" },
        async () => {
          attempts += 1;
          throw error;
        },
      ),
    ).rejects.toBe(error);
    expect(attempts).toBe(1);
    expect(isJoinCodeConflict(error)).toBe(false);
  });

  test("does not treat a P2002 without a target as a join-code collision", () => {
    expect(isJoinCodeConflict({ code: "P2002" })).toBe(false);
    expect(isJoinCodeConflict({ code: "P2003" })).toBe(false);
    expect(isJoinCodeConflict(new Error("no"))).toBe(false);
  });
});
