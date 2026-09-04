import { bindSessionUserIdToPairings } from "./bind-session-user";

const guest = (displayName: string) => ({
  displayName,
  isGuest: true as const,
  userId: null as string | null,
});

const named = (
  displayName: string,
  userId: string | null,
  isGuest = false,
) => ({
  displayName,
  isGuest,
  userId,
});

describe("bindSessionUserIdToPairings", () => {
  test("assigns session userId to the first non-guest with a missing userId", () => {
    const bound = bindSessionUserIdToPairings(
      {
        teamA: [guest("Alex"), guest("Sam")],
        teamB: [guest("Jordan"), named("Riley", null)],
      },
      "user-riley",
    );

    expect(bound.teamB[1]).toEqual({
      displayName: "Riley",
      isGuest: false,
      userId: "user-riley",
    });
    expect(bound.teamA[0].userId).toBeNull();
  });

  test("keeps a matching userId and clears guest on that slot", () => {
    const bound = bindSessionUserIdToPairings(
      {
        teamA: [guest("Alex"), guest("Sam")],
        teamB: [
          guest("Jordan"),
          named("Riley", "user-riley", true),
        ],
      },
      "user-riley",
    );

    expect(bound.teamB[1]).toEqual({
      displayName: "Riley",
      isGuest: false,
      userId: "user-riley",
    });
  });

  test("does not overwrite a different account userId or force a guest slot", () => {
    const pairings = {
      teamA: [named("Alex", "user-alex"), guest("Sam")] as [
        ReturnType<typeof named>,
        ReturnType<typeof guest>,
      ],
      teamB: [guest("Jordan"), named("Riley", "user-other")] as [
        ReturnType<typeof guest>,
        ReturnType<typeof named>,
      ],
    };

    expect(bindSessionUserIdToPairings(pairings, "user-riley")).toEqual(pairings);
  });

  test("treats blank userId as missing", () => {
    const bound = bindSessionUserIdToPairings(
      {
        teamA: [guest("Alex"), named("Sam", "  ")],
        teamB: [guest("Jordan"), guest("Riley")],
      },
      "user-sam",
    );

    expect(bound.teamA[1]).toEqual({
      displayName: "Sam",
      isGuest: false,
      userId: "user-sam",
    });
  });
});
