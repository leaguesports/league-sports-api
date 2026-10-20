/**
 * Golf card maths. Pure: no clock, no I/O, no plug-in state.
 *
 * Course handicap (18-hole tee figures):
 *   courseHcp = roundHalfUp(HI * slope / 113 + (rating - par))
 * Playing handicap:
 *   eighteen = roundHalfUp(courseHcp * allowance)
 *   18-hole card: playingHcp = eighteen
 *   9-hole card:  playingHcp = roundHalfUp(eighteen / 2)
 * The 9-hole step always halves the 18-hole playing handicap. It does not
 * assume the tee rating itself is a 9-hole rating.
 *
 * roundHalfUp is half away from -infinity (10.5 → 11, -1.5 → -1), the same
 * rounding the previous WHS-style helper used.
 *
 * Strokes are dealt by stroke index across the holes on the card. Positive
 * handicaps start at the lowest SI and cycle, so 20 shots on 18 holes gives
 * two strokes to SI 1 and SI 2. Plus handicaps give strokes back from the
 * highest SI. A 9-hole card uses the SI values on those holes (relative
 * order), not a renumbering to 1–9.
 *
 * Totals sum only holes that already have a gross score, so a short thru
 * does not absorb the rest of the handicap. Stableford for one hole is
 * max(0, 2 + par + received - strokes). No handicap index, or a tee with no
 * par/rating/slope, or a round with no hole card: gross only, and net,
 * stableford, and strokes-received are null.
 *
 * Standings use stableford, higher first. Ties share a position (1, 1, 3)
 * and are not split. Players without a stableford score are listed after
 * them with position null: those with a gross, lower gross first, then the
 * rest. Id order breaks display ties only.
 */

export type ScoringHole = {
  n: number;
  par: number;
  si: number;
};

export type ScoringTee = {
  id: string;
  par?: number;
  rating?: number;
  slope?: number;
};

export type HolesPlayed = "18" | "front9" | "back9";

export type ScoringSetup = {
  tees: readonly ScoringTee[];
  holes?: readonly ScoringHole[];
  holesPlayed: HolesPlayed;
  handicapAllowance: number;
};

export type GrossScore = {
  participantId: string;
  hole: number;
  strokes: number;
};

export type ScoringSeat = {
  id: string;
  status: string;
  sportData?: unknown;
};

export type HoleStrokes = {
  n: number;
  received: number;
};

export type PlayerTotal = {
  participantId: string;
  thru: number;
  gross: number | null;
  net: number | null;
  stableford: number | null;
  toPar: number | null;
  courseHcp: number | null;
  playingHcp: number | null;
  strokesReceived: HoleStrokes[] | null;
};

export type StandingRow = {
  position: number | null;
  tied: boolean;
  participantId: string;
  thru: number;
  gross: number | null;
  net: number | null;
  stableford: number | null;
  toPar: number | null;
};

export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot round a non-finite handicap");
  }
  return Math.floor(value + 0.5);
}

export function courseHandicap(input: {
  handicapIndex: number;
  slope: number;
  rating: number;
  par: number;
}): number {
  return roundHalfUp(
    input.handicapIndex * (input.slope / 113) + (input.rating - input.par),
  );
}

/** Playing handicap actually used to allocate strokes on this card. */
export function playingHandicap(input: {
  courseHcp: number;
  allowance: number;
  holesPlayed: HolesPlayed;
}): number {
  const eighteen = roundHalfUp(input.courseHcp * input.allowance);
  if (input.holesPlayed === "18") {
    return eighteen;
  }
  return roundHalfUp(eighteen / 2);
}

export function allocateStrokes(
  playingHcp: number,
  holes: readonly { n: number; si: number }[],
): Map<number, number> {
  const received = new Map<number, number>();
  for (const hole of holes) {
    received.set(hole.n, 0);
  }
  if (playingHcp === 0 || holes.length === 0) {
    return received;
  }

  const ordered = [...holes].sort((left, right) => {
    if (playingHcp > 0) {
      return left.si - right.si || left.n - right.n;
    }
    return right.si - left.si || left.n - right.n;
  });
  const delta = playingHcp > 0 ? 1 : -1;
  const count = Math.abs(playingHcp);
  for (let index = 0; index < count; index += 1) {
    const hole = ordered[index % ordered.length];
    if (!hole) {
      break;
    }
    received.set(hole.n, (received.get(hole.n) ?? 0) + delta);
  }
  return received;
}

export function stablefordPoints(par: number, strokes: number, received: number): number {
  return Math.max(0, 2 + par + received - strokes);
}

export function scorePlayer(input: {
  participantId: string;
  handicapIndex: number | null;
  tee: ScoringTee | undefined;
  holes: readonly ScoringHole[];
  holesPlayed: HolesPlayed;
  allowance: number;
  scores: readonly GrossScore[];
}): PlayerTotal {
  const mine = input.scores.filter((score) => score.participantId === input.participantId);
  const byHole = new Map(mine.map((score) => [score.hole, score.strokes]));
  const thru = byHole.size;
  const gross = thru === 0 ? null : [...byHole.values()].reduce((sum, strokes) => sum + strokes, 0);

  const rated = teeRatings(input.tee);
  const canAllocate = input.handicapIndex !== null && rated !== null && input.holes.length > 0;
  if (!canAllocate || input.handicapIndex === null || rated === null) {
    const toPar = thru === 0 || input.holes.length === 0 ? null : toParOf(input.holes, byHole, gross);
    return {
      participantId: input.participantId,
      thru,
      gross,
      net: null,
      stableford: null,
      toPar,
      courseHcp: null,
      playingHcp: null,
      strokesReceived: null,
    };
  }

  const courseHcp = courseHandicap({
    handicapIndex: input.handicapIndex,
    slope: rated.slope,
    rating: rated.rating,
    par: rated.par,
  });
  const playing = playingHandicap({
    courseHcp,
    allowance: input.allowance,
    holesPlayed: input.holesPlayed,
  });
  const received = allocateStrokes(playing, input.holes);
  const strokesReceived = [...input.holes]
    .map((hole) => ({ n: hole.n, received: received.get(hole.n) ?? 0 }))
    .sort((left, right) => left.n - right.n);

  if (thru === 0) {
    return {
      participantId: input.participantId,
      thru,
      gross: null,
      net: null,
      stableford: null,
      toPar: null,
      courseHcp,
      playingHcp: playing,
      strokesReceived,
    };
  }

  let net = 0;
  let points = 0;
  for (const hole of input.holes) {
    const strokes = byHole.get(hole.n);
    if (strokes === undefined) {
      continue;
    }
    const shots = received.get(hole.n) ?? 0;
    net += strokes - shots;
    points += stablefordPoints(hole.par, strokes, shots);
  }

  return {
    participantId: input.participantId,
    thru,
    gross,
    net,
    stableford: points,
    toPar: toParOf(input.holes, byHole, gross),
    courseHcp,
    playingHcp: playing,
    strokesReceived,
  };
}

export function rankStandings(players: readonly PlayerTotal[]): StandingRow[] {
  const scored = players.filter((player) => player.stableford !== null);
  const grossOnly = players.filter(
    (player) => player.stableford === null && player.gross !== null,
  );
  const waiting = players.filter((player) => player.stableford === null && player.gross === null);

  scored.sort(compareStableford);
  grossOnly.sort(compareGross);
  waiting.sort(compareId);

  const rows: StandingRow[] = [];
  let index = 0;
  while (index < scored.length) {
    const value = scored[index]?.stableford;
    let end = index + 1;
    while (end < scored.length && scored[end]?.stableford === value) {
      end += 1;
    }
    const tied = end - index > 1;
    const position = index + 1;
    for (let cursor = index; cursor < end; cursor += 1) {
      const player = scored[cursor];
      if (player) {
        rows.push(toRow(player, position, tied));
      }
    }
    index = end;
  }

  for (const player of [...grossOnly, ...waiting]) {
    rows.push(toRow(player, null, false));
  }
  return rows;
}

export function projectCard(input: {
  setup: ScoringSetup;
  scores: readonly GrossScore[];
  participants: readonly ScoringSeat[];
}): { players: PlayerTotal[]; standings: StandingRow[] } {
  const holes = input.setup.holes ?? [];
  const players = input.participants
    .filter((participant) => participant.status === "joined")
    .map((participant) => {
      const sport = readSportData(participant.sportData);
      const tee = input.setup.tees.find((candidate) => candidate.id === sport.teeId);
      return scorePlayer({
        participantId: participant.id,
        handicapIndex: sport.handicapIndex,
        tee,
        holes,
        holesPlayed: input.setup.holesPlayed,
        allowance: input.setup.handicapAllowance,
        scores: input.scores,
      });
    });
  return { players, standings: rankStandings(players) };
}

function teeRatings(
  tee: ScoringTee | undefined,
): { par: number; rating: number; slope: number } | null {
  if (!tee) {
    return null;
  }
  if (typeof tee.par !== "number" || typeof tee.rating !== "number" || typeof tee.slope !== "number") {
    return null;
  }
  return { par: tee.par, rating: tee.rating, slope: tee.slope };
}

function toParOf(
  holes: readonly ScoringHole[],
  byHole: ReadonlyMap<number, number>,
  gross: number | null,
): number | null {
  if (gross === null) {
    return null;
  }
  let par = 0;
  for (const hole of holes) {
    if (byHole.has(hole.n)) {
      par += hole.par;
    }
  }
  return gross - par;
}

function readSportData(sportData: unknown): { teeId?: string; handicapIndex: number | null } {
  if (!sportData || typeof sportData !== "object" || Array.isArray(sportData)) {
    return { handicapIndex: null };
  }
  const record = sportData as { teeId?: unknown; handicapIndex?: unknown };
  return {
    teeId: typeof record.teeId === "string" ? record.teeId : undefined,
    handicapIndex: typeof record.handicapIndex === "number" ? record.handicapIndex : null,
  };
}

function compareStableford(left: PlayerTotal, right: PlayerTotal): number {
  const delta = (right.stableford ?? 0) - (left.stableford ?? 0);
  if (delta !== 0) {
    return delta;
  }
  return left.participantId.localeCompare(right.participantId);
}

function compareGross(left: PlayerTotal, right: PlayerTotal): number {
  const delta = (left.gross ?? 0) - (right.gross ?? 0);
  if (delta !== 0) {
    return delta;
  }
  return left.participantId.localeCompare(right.participantId);
}

function compareId(left: PlayerTotal, right: PlayerTotal): number {
  return left.participantId.localeCompare(right.participantId);
}

function toRow(player: PlayerTotal, position: number | null, tied: boolean): StandingRow {
  return {
    position,
    tied,
    participantId: player.participantId,
    thru: player.thru,
    gross: player.gross,
    net: player.net,
    stableford: player.stableford,
    toPar: player.toPar,
  };
}
