import {
  bindSessionUserIdToPlayers,
  sanitizePlayersForCreate,
} from "./bind-session-user";

const guest = (slot: number, displayName: string) => ({
  slot,
  displayName,
  isGuest: true as const,
  userId: null as string | null,
});

const named = (
  slot: number,
  displayName: string,
  userId: string | null,
  isGuest = false,
) => ({
  slot,
  displayName,
  isGuest,
  userId,
});

describe("bindSessionUserIdToPlayers", () => {
  test("assigns session userId to the first non-guest with a missing userId", () => {
    const bound = bindSessionUserIdToPlayers(
      [guest(1, "Alex"), named(2, "Riley", null)],
      "user-riley",
    );

    expect(bound[1]).toEqual({
      slot: 2,
      displayName: "Riley",
      isGuest: false,
      userId: "user-riley",
    });
    expect(bound[0].userId).toBeNull();
  });

  test("does not overwrite a different account or force a guest slot", () => {
    const players = [
      named(1, "Alex", "user-alex"),
      guest(2, "Sam"),
    ];

    expect(bindSessionUserIdToPlayers(players, "user-riley")).toEqual(players);
  });
});

describe("sanitizePlayersForCreate", () => {
  test("strips all userIds when there is no session", () => {
    const sanitized = sanitizePlayersForCreate(
      [named(1, "Alex", "user-alex"), named(2, "Riley", "user-riley")],
      null,
    );

    expect(sanitized).toEqual([
      { slot: 1, displayName: "Alex", isGuest: true, userId: null },
      { slot: 2, displayName: "Riley", isGuest: true, userId: null },
    ]);
  });

  test("keeps only the session userId and binds an empty non-guest seat", () => {
    const sanitized = sanitizePlayersForCreate(
      [named(1, "Alex", "user-alex"), named(2, "Riley", null)],
      "user-riley",
    );

    expect(sanitized[0]).toEqual({
      slot: 1,
      displayName: "Alex",
      isGuest: true,
      userId: null,
    });
    expect(sanitized[1]).toEqual({
      slot: 2,
      displayName: "Riley",
      isGuest: false,
      userId: "user-riley",
    });
  });
});
