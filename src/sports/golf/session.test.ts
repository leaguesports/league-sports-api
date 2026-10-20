import { golfSessionPlugin, GolfState } from "./session";
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
});

function apply(state: GolfState, type: string, data: unknown): GolfState {
  return golfSessionPlugin.applyEvent(state, { type, data });
}
