import { SessionValidationError } from "../session-plugin";
import {
  PADEL_MATCH_RECORDED,
  PadelState,
  padelSessionPlugin,
} from "./session";

const config = padelSessionPlugin.validateSetup({});
const empty = padelSessionPlugin.buildStartingState(config);

const doubles = {
  teams: {
    A: { players: [{ name: "Ada" }, { name: "Bea" }] },
    B: { players: [{ name: "Cal" }, { name: "Dee" }] },
  },
  sets: [
    { a: 6, b: 4 },
    { a: 3, b: 6 },
    { a: 7, b: 5 },
  ],
};

describe("padel session plug-in", () => {
  test("defaults setup and exposes format and scoring on the public card", () => {
    expect(config).toEqual({ format: "best_of_3", scoring: "advantage" });
    expect(padelSessionPlugin.publicSetup(config)).toEqual({
      format: "best_of_3",
      scoring: "advantage",
    });
    expect(padelSessionPlugin.acceptedEventTypes).toEqual([PADEL_MATCH_RECORDED]);
    expect(empty).toEqual({
      teams: null,
      sets: [],
      winner: null,
      setsWon: null,
    });

    const five = padelSessionPlugin.validateSetup({
      format: "best_of_5",
      scoring: "golden_point",
    });
    expect(five).toEqual({ format: "best_of_5", scoring: "golden_point" });
  });

  test("rejects null or array setup without coercing them", () => {
    expect(() => padelSessionPlugin.validateSetup(null)).toThrow(SessionValidationError);
    expect(() => padelSessionPlugin.validateSetup([])).toThrow(SessionValidationError);
  });

  test("match.recorded folds a finished scoreline into state.result", () => {
    const next = apply(empty, doubles, 2);

    expect(next).toMatchObject({
      teams: doubles.teams,
      sets: doubles.sets,
      winner: "A",
      setsWon: { A: 2, B: 1 },
      result: {
        seq: 2,
        winner: "A",
        setsWon: { A: 2, B: 1 },
      },
    });
    expect(empty.teams).toBeNull();
  });

  test("validateEvent and applyEvent reject unfinished and invalid payloads", () => {
    expect(() =>
      padelSessionPlugin.validateEvent(
        empty,
        config,
        {
          type: PADEL_MATCH_RECORDED,
          data: {
            teams: doubles.teams,
            sets: [{ a: 6, b: 4 }],
          },
        },
        { participants: [], writerId: "p1" },
      ),
    ).toThrow(/Match is unfinished/);

    expect(() =>
      apply(empty, {
        teams: doubles.teams,
        sets: [{ a: 6, b: 4 }, { a: 6, b: 5 }],
      }),
    ).toThrow(SessionValidationError);

    expect(() =>
      apply(empty, {
        teams: {
          A: { players: [] },
          B: { players: [{ name: "Solo" }] },
        },
        sets: [
          { a: 6, b: 4 },
          { a: 6, b: 3 },
        ],
      }),
    ).toThrow(/Invalid padel match/);
  });

  test("round.finished freezes result only when match.recorded has not", () => {
    const finishedEmpty = padelSessionPlugin.applyEvent(
      empty,
      { type: "round.finished", seq: 1, participantId: "p1" },
      { config, participants: [] },
    );
    expect(finishedEmpty.result).toEqual({
      seq: 1,
      winner: null,
      setsWon: null,
    });

    const recorded = apply(empty, doubles, 1);
    const finishedAgain = padelSessionPlugin.applyEvent(
      recorded,
      { type: "round.finished", seq: 2, participantId: "p1" },
      { config, participants: [] },
    );
    expect(finishedAgain.result).toEqual(recorded.result);
    expect(finishedAgain.result?.seq).toBe(1);
  });

  test("join still accepts an empty object and capacity stays at four", () => {
    expect(padelSessionPlugin.participants).toEqual({ max: 4 });
    expect(padelSessionPlugin.validateJoin(empty, config, {})).toEqual({});
    expect(padelSessionPlugin.validateJoin(empty, config, undefined)).toEqual({});
    expect(() =>
      padelSessionPlugin.validateJoin(empty, config, { side: "A" }),
    ).toThrow(SessionValidationError);
  });
});

function apply(state: PadelState, data: unknown, seq = 1): PadelState {
  return padelSessionPlugin.applyEvent(
    state,
    { type: PADEL_MATCH_RECORDED, data, seq, participantId: null },
    { config, participants: [] },
  );
}
