import { golfSessionPlugin, GolfState, layoutHoles } from "./session";
import { SessionValidationError } from "../session-plugin";

const config = golfSessionPlugin.validateSetup({
  tees: [{ id: "white", name: "White" }],
});
const empty = golfSessionPlugin.buildStartingState(config);
const joined = [{ id: "p1", status: "joined" }, { id: "p2", status: "invited" }];

describe("golf hole events", () => {
  test("keeps the latest score per player and hole, recording who wrote it", () => {
    const first = apply(empty, "hole.scored", {
      participantId: "p1",
      hole: 1,
      strokes: 4,
      scoredBy: "p2",
      seq: 3,
    });
    const again = apply(first, "hole.scored", {
      participantId: "p1",
      hole: 1,
      strokes: 5,
      scoredBy: "p1",
      seq: 4,
      clientEventId: "retry-1",
    });
    const otherHole = apply(again, "hole.scored", {
      participantId: "p1",
      hole: 2,
      strokes: 3,
      scoredBy: "p1",
      seq: 5,
    });

    expect(first.scores).toEqual([
      { participantId: "p1", hole: 1, strokes: 4, scoredBy: "p2", seq: 3 },
    ]);
    expect(again.scores).toEqual([
      { participantId: "p1", hole: 1, strokes: 5, scoredBy: "p1", seq: 4 },
    ]);
    expect(otherHole.scores).toEqual([
      { participantId: "p1", hole: 1, strokes: 5, scoredBy: "p1", seq: 4 },
      { participantId: "p1", hole: 2, strokes: 3, scoredBy: "p1", seq: 5 },
    ]);
    expect(again.scores).not.toBe(first.scores);
    expect(first.scores).toHaveLength(1);
  });

  test("clears one hole and leaves the rest of the card", () => {
    const scored = apply(empty, "hole.scored", {
      participantId: "p1",
      hole: 1,
      strokes: 4,
      scoredBy: "p1",
      seq: 2,
    });
    const both = apply(scored, "hole.scored", {
      participantId: "p1",
      hole: 2,
      strokes: 6,
      scoredBy: "p1",
      seq: 3,
    });
    const cleared = apply(both, "hole.cleared", {
      participantId: "p1",
      hole: 1,
      scoredBy: "p1",
      seq: 4,
    });

    expect(cleared.scores).toEqual([
      { participantId: "p1", hole: 2, strokes: 6, scoredBy: "p1", seq: 3 },
    ]);
    expect(both.scores).toHaveLength(2);
  });

  test("rejects a target who is not joined, a hole off the card, and a bad stroke count", () => {
    expect(() =>
      golfSessionPlugin.validateEvent(
        empty,
        config,
        { type: "hole.scored", data: { participantId: "p2", hole: 1, strokes: 4 } },
        { participants: joined },
      ),
    ).toThrow(SessionValidationError);

    try {
      golfSessionPlugin.validateEvent(
        empty,
        config,
        { type: "hole.scored", data: { participantId: "missing", hole: 1, strokes: 4 } },
        { participants: joined },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(SessionValidationError);
      expect((error as SessionValidationError).message).toBe(
        "Score target is not a joined participant",
      );
    }

    expect(() =>
      golfSessionPlugin.validateEvent(
        empty,
        config,
        { type: "hole.scored", data: { participantId: "p1", hole: 19, strokes: 4 } },
        { participants: joined },
      ),
    ).toThrow(SessionValidationError);

    expect(() =>
      golfSessionPlugin.validateEvent(
        empty,
        config,
        { type: "hole.scored", data: { participantId: "p1", hole: 1, strokes: 16 } },
        { participants: joined },
      ),
    ).toThrow(/Invalid golf score/);

    expect(() =>
      golfSessionPlugin.validateEvent(
        empty,
        config,
        {
          type: "hole.scored",
          data: { participantId: "p1", hole: 1, strokes: 4, scoredBy: "p2" },
        },
        { participants: joined },
      ),
    ).toThrow(SessionValidationError);

    expect(() =>
      golfSessionPlugin.validateEvent(
        empty,
        config,
        { type: "hole.cleared", data: { participantId: "p1", hole: 1 } },
        { participants: joined },
      ),
    ).not.toThrow();
  });

  test("keeps a tees-only setup and narrows a front-nine card", () => {
    const legacy = golfSessionPlugin.validateSetup({
      tees: [{ id: "white", name: "White" }],
    });
    expect(legacy).toMatchObject({
      holesPlayed: "18",
      startHole: 1,
      handicapAllowance: 1,
    });
    expect(legacy.holes).toBeUndefined();
    expect(golfSessionPlugin.validateSetup(legacy)).toEqual(legacy);

    const front = golfSessionPlugin.validateSetup({
      tees: [{ id: "white", par: 72, rating: 71.2, slope: 128 }],
      holesPlayed: "front9",
      holes: layoutHoles("front9").map((n) => ({ n, par: 4, si: n })),
    });
    expect(front.startHole).toBe(1);
    expect(() =>
      golfSessionPlugin.validateEvent(
        empty,
        front,
        { type: "hole.scored", data: { participantId: "p1", hole: 10, strokes: 4 } },
        { participants: joined },
      ),
    ).toThrow(/Hole is not in this round/);

    expect(() =>
      golfSessionPlugin.validateSetup({
        tees: [{ id: "white", par: 72 }],
      }),
    ).toThrow(/Tee ratings need par, rating, and slope/);
  });

  test("applyEvent publishes the worked 18-hole total for the joined seats", () => {
    const setup = golfSessionPlugin.validateSetup({
      tees: [{ id: "white", par: 72, rating: 71.2, slope: 128 }],
      holes: layoutHoles("18").map((n) => ({ n, par: 4, si: n })),
      handicapAllowance: 1,
    });
    const start = golfSessionPlugin.buildStartingState(setup);
    let state = start;
    for (let hole = 1; hole <= 18; hole += 1) {
      state = golfSessionPlugin.applyEvent(
        state,
        {
          type: "hole.scored",
          data: {
            participantId: "p1",
            hole,
            strokes: hole <= 13 ? 5 : 4,
            scoredBy: "p1",
            seq: hole,
          },
        },
        {
          config: setup,
          participants: [
            { id: "p1", status: "joined", sportData: { teeId: "white", handicapIndex: 12.4 } },
          ],
        },
      );
    }

    expect(state.players[0]).toMatchObject({
      participantId: "p1",
      thru: 18,
      gross: 85,
      net: 72,
      stableford: 36,
      toPar: 13,
      courseHcp: 13,
      playingHcp: 13,
    });
    expect(state.standings).toEqual([
      expect.objectContaining({ participantId: "p1", position: 1, tied: false, stableford: 36 }),
    ]);
    expect(start.players).toEqual([]);
  });
});

function apply(state: GolfState, type: string, data: unknown): GolfState {
  return golfSessionPlugin.applyEvent(state, { type, data });
}
