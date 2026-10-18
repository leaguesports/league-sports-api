import { allocateHoleStrokes } from "../../golf-round/entities/handicap";
import {
  playingHandicapForRound,
  rankPlayers,
  rankWeekend,
  scorePlayer,
  ScoringPlayer,
  stablefordPoints,
} from "./scoring";

function holes(
  count: number,
  start: number,
  grossFor: (holeNumber: number, index: number) => number | null,
  strokeIndexFor?: (index: number) => number,
): ScoringPlayer["holes"] {
  return Array.from({ length: count }, (_, index) => {
    const number = ((start - 1 + index) % 18) + 1;
    return {
      number,
      par: 4,
      strokeIndex: strokeIndexFor ? strokeIndexFor(index) : index + 1,
      gross: grossFor(number, index),
    };
  });
}

function player(
  id: string,
  name: string,
  playingHandicap: number | null,
  holeList: ScoringPlayer["holes"],
  handicapIndex: number | null = playingHandicap,
): ScoringPlayer {
  return {
    id,
    displayName: name,
    userId: null,
    handicapIndex,
    playingHandicap,
    cardId: "card",
    cardNumber: 1,
    slot: 1,
    holes: holeList,
  };
}

describe("game day scoring", () => {
  test("9-hole ratings scale an 18-hole handicap, and no HI is gross only", () => {
    const scaled = playingHandicapForRound({
      handicapIndex: 20,
      slopeRating: 113,
      courseRating: 72,
      par: 72,
      holesPlayed: 9,
    });
    expect(scaled).toEqual({ courseHandicap: 10, playingHandicap: 10 });

    const full = playingHandicapForRound({
      handicapIndex: 20,
      slopeRating: 113,
      courseRating: 72,
      par: 72,
      holesPlayed: 18,
    });
    expect(full.playingHandicap).toBe(20);

    const nine = holes(9, 1, () => 4);
    const withHandicap = scorePlayer(
      player("a", "A", scaled.playingHandicap, nine, 20),
    );
    const without = scorePlayer(player("b", "B", null, nine, null));

    expect(withHandicap.gross).toBe(36);
    expect(withHandicap.net).toBe(26);
    expect(withHandicap.stableford).not.toBeNull();
    expect(without.gross).toBe(36);
    expect(without.toPar).toBe(0);
    expect(without.net).toBeNull();
    expect(without.stableford).toBeNull();

    const ranked = rankPlayers([
      player("b", "B", null, nine, null),
      player("a", "A", scaled.playingHandicap, nine, 20),
    ]);
    expect(ranked.gross.map((row) => row.position)).toEqual(["T1", "T1"]);
    expect(ranked.net.find((row) => row.playerId === "b")?.net).toBeNull();
    expect(ranked.net.find((row) => row.playerId === "b")?.position).toBeNull();
    expect(ranked.stableford.find((row) => row.playerId === "b")?.stableford).toBeNull();
  });

  test("stableford is 2 for net par and 0 for double bogey or worse", () => {
    expect(stablefordPoints(4, 4)).toBe(2);
    expect(stablefordPoints(4, 3)).toBe(3);
    expect(stablefordPoints(4, 2)).toBe(4);
    expect(stablefordPoints(4, 6)).toBe(0);
    expect(stablefordPoints(4, 8)).toBe(0);
  });

  test("final ties split on countback in playing order, including a start on hole 10", () => {
    const nine = (last: number, earlier: number) =>
      holes(9, 1, (_number, index) => (index === 8 ? last : index === 7 ? earlier : 4));
    const ranked = rankPlayers([
      player("a", "A", 0, nine(3, 5)),
      player("b", "B", 0, nine(4, 4)),
    ]);
    expect(ranked.gross.find((row) => row.playerId === "a")?.gross).toBe(36);
    expect(ranked.gross.find((row) => row.playerId === "b")?.gross).toBe(36);
    expect(ranked.gross.map((row) => row.playerId)).toEqual(["a", "b"]);
    expect(ranked.gross.map((row) => row.position)).toEqual(["1", "2"]);
    expect(ranked.countbackApplied).toBe(true);
    expect(ranked.gross.find((row) => row.playerId === "a")?.countbackNote).toBe(
      "Won countback (last 1)",
    );
    expect(ranked.gross.find((row) => row.playerId === "b")?.countbackNote).toBe(
      "Lost countback (last 1)",
    );

    const stillTied = rankPlayers([
      player("a", "A", 0, holes(9, 1, () => 4)),
      player("b", "B", 0, holes(9, 1, () => 4)),
    ]);
    expect(stillTied.gross.map((row) => row.position)).toEqual(["T1", "T1"]);
    expect(stillTied.countbackApplied).toBe(false);

    const backNine = (hole9: number, hole18: number) =>
      holes(18, 10, (number) => {
        if (number === 9) return hole9;
        if (number === 18) return hole18;
        return 4;
      });
    const startedOnTen = rankPlayers([
      player("a", "A", 0, backNine(3, 5)),
      player("b", "B", 0, backNine(5, 3)),
    ]);
    expect(startedOnTen.gross.every((row) => row.gross === 72)).toBe(true);
    expect(startedOnTen.gross[0]?.playerId).toBe("a");
    expect(startedOnTen.gross[0]?.countbackNote).toContain("last 9");

    const compensated = (hole10: number, hole18: number) =>
      holes(18, 10, (number) => {
        if (number === 10) return hole10;
        if (number === 18) return hole18;
        return 4;
      });
    const onlyHole18 = rankPlayers([
      player("a", "A", 0, compensated(5, 3)),
      player("b", "B", 0, compensated(3, 5)),
    ]);
    expect(onlyHole18.gross.every((row) => row.gross === 72)).toBe(true);
    expect(onlyHole18.gross.map((row) => row.position)).toEqual(["T1", "T1"]);
    expect(onlyHole18.countbackApplied).toBe(false);
  });

  test("net countback uses stroke index, so it can reverse a gross comparison", () => {
    const strokeIndex = (index: number) => (index === 8 ? 1 : index + 2);
    const a = player("a", "A", 10, holes(9, 1, () => 5, strokeIndex), 10);
    const b = player(
      "b",
      "B",
      0,
      holes(9, 1, (_number, index) => (index === 0 ? 3 : 4), strokeIndex),
      0,
    );
    const strokesOnLast = allocateHoleStrokes(
      10,
      a.holes.map((hole) => ({ number: hole.number, strokeIndex: hole.strokeIndex })),
    );
    expect(strokesOnLast.get(9)).toBe(2);

    const ranked = rankPlayers([a, b]);
    expect(ranked.net.every((row) => row.net === 35)).toBe(true);
    expect(ranked.net[0]?.playerId).toBe("a");
    expect(ranked.gross[0]?.playerId).toBe("b");
    expect(ranked.net.find((row) => row.playerId === "a")?.countbackNote).toContain(
      "Won countback",
    );
  });

  test("stableford countback rewards the better finish, and live ties are not split", () => {
    const finished = (last: number, eighth: number) =>
      holes(9, 1, (_number, index) => (index === 8 ? last : index === 7 ? eighth : 4));
    const ranked = rankPlayers([
      player("a", "A", 0, finished(3, 5)),
      player("b", "B", 0, finished(4, 4)),
    ]);
    expect(ranked.stableford.every((row) => row.stableford === 18)).toBe(true);
    expect(ranked.stableford[0]?.playerId).toBe("a");

    const live = (thruGross: number | null) =>
      holes(9, 1, (_number, index) => (index < 5 ? thruGross : null));
    const inProgress = rankPlayers([
      player("a", "A", 0, live(4)),
      player("b", "B", 0, live(4)),
    ]);
    expect(inProgress.gross.map((row) => row.position)).toEqual(["T1", "T1"]);
    expect(inProgress.countbackApplied).toBe(false);
    expect(inProgress.gross[0]?.thru).toBe(5);
  });

  test("a weekend sums gross and drops net when any round has no handicap", () => {
    const rankings = rankWeekend([
      {
        gameDayId: "sat",
        date: "2026-11-01",
        playerId: "p1",
        displayName: "Pieter",
        userId: null,
        gross: 78,
        net: 66,
        stableford: 36,
      },
      {
        gameDayId: "sun",
        date: "2026-11-02",
        playerId: "p2",
        displayName: "pieter",
        userId: null,
        gross: 80,
        net: null,
        stableford: null,
      },
      {
        gameDayId: "sat",
        date: "2026-11-01",
        playerId: "n1",
        displayName: "Nadia",
        userId: "user-nadia",
        gross: 82,
        net: 70,
        stableford: 32,
      },
    ]);

    const pieter = rankings.gross.find((row) => row.displayName === "Pieter");
    expect(pieter).toMatchObject({
      gross: 158,
      net: null,
      stableford: null,
      roundsPlayed: 2,
      position: "2",
    });
    expect(rankings.gross.find((row) => row.displayName === "Nadia")?.position).toBe(
      "1",
    );
  });
});
