import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { DartsMatch, DARTS_STARTING_SCORE } from "./darts-match";
import { DartsMatchLockConflictError } from "./darts-match-lock-conflict-error";
import { DartsPlayer } from "./darts-player";
import { StartsAt } from "./starts-at";

const twoPlayers = [
  { slot: 1, displayName: "Alex", isGuest: false, userId: "user-alex" },
  { slot: 2, displayName: "Sam", isGuest: true, userId: null },
];

function createLive(venueCmsId: CmsId | null = CmsId.from("sanity-pub-1")) {
  return DartsMatch.create({
    venueCmsId,
    startsAt: StartsAt.from("2026-09-07T18:00:00.000Z"),
    players: twoPlayers,
  });
}

describe("darts players", () => {
  test("requires two to eight unique slots", () => {
    expect(() => DartsPlayer.fromPlayers([twoPlayers[0]])).toThrow(DomainError);
    expect(() =>
      DartsPlayer.fromPlayers([
        twoPlayers[0],
        { ...twoPlayers[1], slot: 1 },
      ]),
    ).toThrow(DomainError);
  });

  test("named players require a userId and guests cannot carry one", () => {
    expect(() =>
      DartsPlayer.from({
        slot: 1,
        displayName: "Alex",
        isGuest: false,
        userId: null,
      }),
    ).toThrow(DomainError);
    expect(() =>
      DartsPlayer.from({
        slot: 1,
        displayName: "Alex",
        isGuest: true,
        userId: "user-1",
      }),
    ).toThrow(DomainError);
  });
});

describe(DartsMatch, () => {
  test("create starts live at 501 with optional venue", () => {
    const match = createLive(null);

    expect(match.toSnapshot()).toMatchObject({
      venueCmsId: null,
      startingScore: DARTS_STARTING_SCORE,
      checkoutRule: "double_out",
      status: "live",
      winnerSlot: null,
      nextSuggestedSlot: 1,
      players: [
        { slot: 1, remaining: 501, userId: "user-alex", isGuest: false },
        { slot: 2, remaining: 501, userId: null, isGuest: true },
      ],
      turns: [],
    });
  });

  test("a scoring visit reduces remaining and records the turn", () => {
    const match = createLive();
    const turn = match.submitTurn({ playerSlot: 1, score: 60 });

    expect(turn.toSnapshot()).toEqual({
      turnNumber: 1,
      playerSlot: 1,
      score: 60,
      bust: false,
      checkout: false,
      remainingAfter: 441,
    });
    expect(match.remainingFor(1)).toBe(441);
    expect(match.toSnapshot().nextSuggestedSlot).toBe(2);
  });

  test("identifies the thrower by userId", () => {
    const match = createLive();
    match.submitTurn({ userId: "user-alex", score: 26 });
    expect(match.remainingFor(1)).toBe(475);
  });

  test("busts when the visit exceeds remaining and leaves the score unchanged", () => {
    const match = createLive();
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 101 });
    expect(match.remainingFor(1)).toBe(40);

    const bust = match.submitTurn({ playerSlot: 1, score: 60 });
    expect(bust.bust).toBe(true);
    expect(bust.remainingAfter).toBe(40);
    expect(match.remainingFor(1)).toBe(40);
    expect(match.status).toBe("live");
  });

  test("busts when remaining minus score is 1 and never stores remaining 1", () => {
    const match = createLive();
    match.submitTurn({ playerSlot: 2, score: 180 });
    match.submitTurn({ playerSlot: 2, score: 180 });
    expect(match.remainingFor(2)).toBe(141);

    const bust = match.submitTurn({ playerSlot: 2, score: 140 });
    expect(bust.bust).toBe(true);
    expect(bust.remainingAfter).toBe(141);
    expect(match.remainingFor(2)).toBe(141);
  });

  test("finishing on 0 without checkout is rejected", () => {
    const match = createLive();
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 101 });
    expect(match.remainingFor(1)).toBe(40);

    expect(() => match.submitTurn({ playerSlot: 1, score: 40 })).toThrow(
      DomainError,
    );
    expect(match.remainingFor(1)).toBe(40);
    expect(match.status).toBe("live");
  });

  test("checkout true on a visit that reaches 0 locks the match", () => {
    const match = createLive();
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 101 });
    const finish = match.submitTurn({
      playerSlot: 1,
      score: 40,
      checkout: true,
      lockedByUserId: "user-alex",
    });

    expect(finish.checkout).toBe(true);
    expect(finish.remainingAfter).toBe(0);
    expect(match.toSnapshot()).toMatchObject({
      status: "locked",
      winnerSlot: 1,
      winnerUserId: "user-alex",
      nextSuggestedSlot: null,
    });
    expect(match.lockedByUserId).toBe("user-alex");
  });

  test("checkout is rejected unless the visit reaches 0", () => {
    const match = createLive();
    expect(() =>
      match.submitTurn({ playerSlot: 1, score: 60, checkout: true }),
    ).toThrow(DomainError);
    expect(() =>
      match.submitTurn({ playerSlot: 1, score: 180, checkout: true }),
    ).toThrow(DomainError);
  });

  test("rejects turns after lock", () => {
    const match = createLive();
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 180 });
    match.submitTurn({ playerSlot: 1, score: 101 });
    match.submitTurn({ playerSlot: 1, score: 40, checkout: true });

    expect(() => match.submitTurn({ playerSlot: 2, score: 20 })).toThrow(
      DartsMatchLockConflictError,
    );
  });

  test("rejects illegal visit scores", () => {
    const match = createLive();
    expect(() => match.submitTurn({ playerSlot: 1, score: 181 })).toThrow(
      DomainError,
    );
    expect(() => match.submitTurn({ playerSlot: 1, score: -1 })).toThrow(
      DomainError,
    );
    expect(() => match.submitTurn({ playerSlot: 1, score: 20.5 })).toThrow(
      DomainError,
    );
  });

  test("captureFinished replays turns and locks with a winner", () => {
    const lockedAt = new Date("2026-09-07T19:00:00.000Z");
    const match = DartsMatch.captureFinished({
      venueCmsId: null,
      startsAt: StartsAt.from("2026-09-07T18:00:00.000Z"),
      players: twoPlayers,
      turns: [
        { playerSlot: 1, score: 180 },
        { playerSlot: 2, score: 26 },
        { playerSlot: 1, score: 180 },
        { playerSlot: 1, score: 141, checkout: true },
      ],
      winnerSlot: 1,
      lockedByUserId: "user-alex",
      lockedAt,
    });

    expect(match.toSnapshot()).toMatchObject({
      status: "locked",
      venueCmsId: null,
      winnerSlot: 1,
      lockedAt: "2026-09-07T19:00:00.000Z",
      players: [
        { slot: 1, remaining: 0 },
        { slot: 2, remaining: 475 },
      ],
    });
    expect(match.turns).toHaveLength(4);
  });

  test("captureFinished accepts remaining + winner without a turn log", () => {
    const match = DartsMatch.captureFinished({
      venueCmsId: CmsId.from("sanity-pub-1"),
      startsAt: StartsAt.from("2026-09-07T18:00:00.000Z"),
      players: twoPlayers,
      remaining: { "1": 0, "2": 140 },
      winnerSlot: 1,
      lockedByUserId: "user-alex",
    });

    expect(match.status).toBe("locked");
    expect(match.remainingFor(1)).toBe(0);
    expect(match.remainingFor(2)).toBe(140);
    expect(match.turns).toHaveLength(0);
  });

  test("captureFinished rejects leftover 1 and a winner who has not checked out", () => {
    expect(() =>
      DartsMatch.captureFinished({
        venueCmsId: null,
        startsAt: StartsAt.from("2026-09-07T18:00:00.000Z"),
        players: twoPlayers,
        remaining: { "1": 0, "2": 1 },
        winnerSlot: 1,
        lockedByUserId: "user-alex",
      }),
    ).toThrow(DomainError);

    expect(() =>
      DartsMatch.captureFinished({
        venueCmsId: null,
        startsAt: StartsAt.from("2026-09-07T18:00:00.000Z"),
        players: twoPlayers,
        remaining: { "1": 40, "2": 80 },
        winnerSlot: 1,
        lockedByUserId: "user-alex",
      }),
    ).toThrow(DomainError);
  });
});
