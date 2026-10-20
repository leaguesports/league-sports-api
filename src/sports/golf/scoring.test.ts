import {
  allocateStrokes,
  courseHandicap,
  playingHandicap,
  projectCard,
  scorePlayer,
  ScoringHole,
  ScoringSetup,
} from "./scoring";

/**
 * Worked 18-hole card. Every hole is par 4 and SI equals the hole number.
 * Tee par 72, rating 71.2, slope 128, allowance 1. HI 12.4.
 *
 *   courseHcp = roundHalfUp(12.4 * 128/113 + (71.2 - 72))
 *             = roundHalfUp(14.046017... - 0.8)
 *             = roundHalfUp(13.246017...)
 *             = 13
 *   playingHcp = roundHalfUp(13 * 1) = 13
 *   strokes on SI 1–13 (holes 1–13), none on 14–18
 *
 * Scores: 5 on holes 1–13, 4 on holes 14–18.
 *   gross = 13*5 + 5*4 = 85
 *   toPar = 85 - 72 = +13
 *   net = 85 - 13 = 72
 *   stableford = 13 * (2+4+1-5) + 5 * (2+4+0-4) = 13*2 + 5*2 = 36
 *
 * Worked 9-hole card (front). Same tee and HI, so the 18-hole playing
 * handicap is still 13. The card plays off roundHalfUp(13 / 2) = 7.
 * Holes 1–9 are par 4 with SI 1,3,5,7,9,11,13,15,17. The seven hardest
 * (holes 1–7) receive one stroke.
 *
 * All 5s:
 *   gross = 45
 *   toPar = 45 - 36 = +9
 *   net = 45 - 7 = 38
 *   stableford = 7 * (2+4+1-5) + 2 * (2+4+0-5) = 14 + 2 = 16
 *
 * Plus handicap, same 18-hole card, slope 113, rating 72, par 72, HI -2.
 *   courseHcp = playingHcp = -2
 *   one stroke given back on SI 18 and SI 17
 * All pars (4):
 *   gross = 72, toPar = 0, net = 74
 *   stableford = 16*2 + 2*(2+4-1-4) = 32 + 2 = 34
 *
 * No HI on the 9-hole all-5s card: gross 45, toPar +9, net and stableford null.
 */

const eighteen: ScoringHole[] = Array.from({ length: 18 }, (_, index) => ({
  n: index + 1,
  par: 4,
  si: index + 1,
}));

const frontNine: ScoringHole[] = [1, 3, 5, 7, 9, 11, 13, 15, 17].map((si, index) => ({
  n: index + 1,
  par: 4,
  si,
}));

const whiteRatings = { id: "white", name: "White", par: 72, rating: 71.2, slope: 128 };
const scratchTee = { id: "white", par: 72, rating: 72, slope: 113 };

function scores(participantId: string, strokesFor: (hole: number) => number, holes: ScoringHole[]) {
  return holes.map((hole) => ({
    participantId,
    hole: hole.n,
    strokes: strokesFor(hole.n),
  }));
}

describe("golf scoring", () => {
  test("18-hole example: HI 12.4 off slope 128 plays to 13 and scores 36 points", () => {
    expect(
      courseHandicap({ handicapIndex: 12.4, slope: 128, rating: 71.2, par: 72 }),
    ).toBe(13);
    expect(playingHandicap({ courseHcp: 13, allowance: 1, holesPlayed: "18" })).toBe(13);

    const received = allocateStrokes(13, eighteen);
    expect(received.get(1)).toBe(1);
    expect(received.get(13)).toBe(1);
    expect(received.get(14)).toBe(0);
    expect([...received.values()].reduce((sum, shots) => sum + shots, 0)).toBe(13);

    const player = scorePlayer({
      participantId: "pieter",
      handicapIndex: 12.4,
      tee: whiteRatings,
      holes: eighteen,
      holesPlayed: "18",
      allowance: 1,
      scores: scores("pieter", (hole) => (hole <= 13 ? 5 : 4), eighteen),
    });

    expect(player).toMatchObject({
      thru: 18,
      gross: 85,
      net: 72,
      stableford: 36,
      toPar: 13,
      courseHcp: 13,
      playingHcp: 13,
    });
    expect(player.strokesReceived?.find((hole) => hole.n === 1)?.received).toBe(1);
    expect(player.strokesReceived?.find((hole) => hole.n === 18)?.received).toBe(0);
  });

  test("9-hole example halves the 18-hole playing handicap before allocating by relative SI", () => {
    expect(playingHandicap({ courseHcp: 13, allowance: 1, holesPlayed: "front9" })).toBe(7);
    // Allowance is applied before the half, not inside one division.
    // roundHalfUp(13 * 0.5) = 7, then roundHalfUp(7 / 2) = 4.
    expect(playingHandicap({ courseHcp: 13, allowance: 0.5, holesPlayed: "front9" })).toBe(4);

    const received = allocateStrokes(7, frontNine);
    expect(received.get(1)).toBe(1);
    expect(received.get(7)).toBe(1);
    expect(received.get(8)).toBe(0);
    expect([...received.values()].reduce((sum, shots) => sum + shots, 0)).toBe(7);

    const player = scorePlayer({
      participantId: "pieter",
      handicapIndex: 12.4,
      tee: whiteRatings,
      holes: frontNine,
      holesPlayed: "front9",
      allowance: 1,
      scores: scores("pieter", () => 5, frontNine),
    });

    expect(player).toMatchObject({
      thru: 9,
      gross: 45,
      net: 38,
      stableford: 16,
      toPar: 9,
      courseHcp: 13,
      playingHcp: 7,
    });
  });

  test("a plus handicap gives strokes back from the highest stroke index", () => {
    expect(courseHandicap({ handicapIndex: -2, slope: 113, rating: 72, par: 72 })).toBe(-2);
    const received = allocateStrokes(-2, eighteen);
    expect(received.get(18)).toBe(-1);
    expect(received.get(17)).toBe(-1);
    expect(received.get(16)).toBe(0);

    const player = scorePlayer({
      participantId: "plus",
      handicapIndex: -2,
      tee: scratchTee,
      holes: eighteen,
      holesPlayed: "18",
      allowance: 1,
      scores: scores("plus", () => 4, eighteen),
    });

    expect(player).toMatchObject({
      thru: 18,
      gross: 72,
      net: 74,
      stableford: 34,
      toPar: 0,
      courseHcp: -2,
      playingHcp: -2,
    });
  });

  test("9-hole plus handicaps round half up, so -3 plays off -1", () => {
    expect(playingHandicap({ courseHcp: -3, allowance: 1, holesPlayed: "back9" })).toBe(-1);
    const received = allocateStrokes(-1, frontNine);
    expect(received.get(9)).toBe(-1);
    expect([...received.values()].reduce((sum, shots) => sum + shots, 0)).toBe(-1);
  });

  test("more than 18 shots cycles back to the hardest holes", () => {
    const received = allocateStrokes(20, eighteen);
    expect(received.get(1)).toBe(2);
    expect(received.get(2)).toBe(2);
    expect(received.get(3)).toBe(1);
    expect([...received.values()].reduce((sum, shots) => sum + shots, 0)).toBe(20);
  });

  test("a player with no handicap index is gross only, including to-par", () => {
    const player = scorePlayer({
      participantId: "guest",
      handicapIndex: null,
      tee: whiteRatings,
      holes: frontNine,
      holesPlayed: "front9",
      allowance: 1,
      scores: scores("guest", () => 5, frontNine),
    });

    expect(player).toMatchObject({
      thru: 9,
      gross: 45,
      net: null,
      stableford: null,
      toPar: 9,
      courseHcp: null,
      playingHcp: null,
      strokesReceived: null,
    });
  });

  test("a short thru only uses strokes on the holes already played", () => {
    const player = scorePlayer({
      participantId: "pieter",
      handicapIndex: 12.4,
      tee: whiteRatings,
      holes: eighteen,
      holesPlayed: "18",
      allowance: 1,
      scores: [{ participantId: "pieter", hole: 1, strokes: 5 }],
    });

    expect(player).toMatchObject({
      thru: 1,
      gross: 5,
      net: 4,
      stableford: 2,
      toPar: 1,
      playingHcp: 13,
    });
  });

  test("standings share a stableford position and list a no-HI player after them", () => {
    const setup: ScoringSetup = {
      tees: [whiteRatings, scratchTee],
      holes: frontNine,
      holesPlayed: "front9",
      handicapAllowance: 1,
    };
    const pieterScores = scores("pieter", () => 5, frontNine);
    const tiedScores = scores("adel", () => 5, frontNine);
    const guestScores = scores("guest", () => 4, frontNine);
    const { players, standings } = projectCard({
      setup,
      scores: [...pieterScores, ...tiedScores, ...guestScores],
      participants: [
        { id: "pieter", status: "joined", sportData: { teeId: "white", handicapIndex: 12.4 } },
        { id: "adel", status: "joined", sportData: { teeId: "white", handicapIndex: 12.4 } },
        { id: "guest", status: "joined", sportData: { teeId: "white" } },
        { id: "waiting", status: "invited", sportData: { teeId: "white", handicapIndex: 20 } },
        { id: "gone", status: "left", sportData: { teeId: "white", handicapIndex: 4 } },
      ],
    });

    expect(players.map((player) => player.participantId)).toEqual(["pieter", "adel", "guest"]);
    expect(players.find((player) => player.participantId === "pieter")?.stableford).toBe(16);
    expect(standings.map((row) => [row.participantId, row.position, row.tied, row.stableford])).toEqual([
      ["adel", 1, true, 16],
      ["pieter", 1, true, 16],
      ["guest", null, false, null],
    ]);
    expect(standings.find((row) => row.participantId === "guest")).toMatchObject({
      gross: 36,
      net: null,
      toPar: 0,
    });
  });
});
