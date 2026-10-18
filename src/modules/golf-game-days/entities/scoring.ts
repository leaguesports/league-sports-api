import {
  allocateHoleStrokes,
  computeCourseHandicap,
  computePlayingHandicap,
} from "../../golf-round/entities/handicap";

/**
 * Leaderboard maths for a game day.
 *
 * Net and Stableford use the playing handicap already scaled to the holes
 * on the card (see playingHandicapForRound, which calls the shared WHS-style
 * helper, including 9-hole scaling). Strokes are allocated across the full
 * card by stroke index, then only holes that have a gross score are summed.
 * That keeps a short "thru" from absorbing the whole handicap.
 *
 * Countback runs in playing order (the course copy order, which starts at
 * startingHole and wraps past 18). Windows are the last 9, 6, 3 and 1 holes
 * of that sequence. A 9-hole card's "last 9" is the whole card, so it does
 * not split a tie; last 6, 3 and 1 still do. A round that starts on hole 10
 * counts the last 9 as the holes played latest, not holes 10–18.
 *
 * Countback is applied only inside a tie group where every player has
 * finished the card. Live ties stay "T2".
 *
 * No playing handicap → gross only. Net and Stableford are null.
 */

export type ScoringHole = {
  number: number;
  par: number;
  strokeIndex: number;
  gross: number | null;
};

export type ScoringPlayer = {
  id: string;
  displayName: string;
  userId: string | null;
  handicapIndex: number | null;
  playingHandicap: number | null;
  cardId: string;
  cardNumber: number;
  slot: number;
  /** Playing order. */
  holes: ScoringHole[];
};

export type BoardMode = "gross" | "net" | "stableford";

export type BoardRow = {
  position: string | null;
  positionNumber: number | null;
  tied: boolean;
  playerId: string;
  displayName: string;
  userId: string | null;
  cardId: string;
  cardNumber: number;
  handicapIndex: number | null;
  playingHandicap: number | null;
  thru: number;
  gross: number | null;
  toPar: number | null;
  net: number | null;
  stableford: number | null;
  countbackNote: string | null;
};

export type PlayerScore = {
  thru: number;
  gross: number | null;
  toPar: number | null;
  net: number | null;
  stableford: number | null;
  finished: boolean;
  holeGross: Map<number, number>;
  holeNet: Map<number, number>;
  holePoints: Map<number, number>;
};

const COUNTBACK_WINDOWS = [9, 6, 3, 1] as const;

export function playingHandicapForRound(input: {
  handicapIndex: number | null;
  slopeRating: number | null;
  courseRating: number | null;
  par: number | null;
  holesPlayed: 9 | 18;
}): { courseHandicap: number | null; playingHandicap: number | null } {
  if (
    input.handicapIndex == null ||
    input.slopeRating == null ||
    input.courseRating == null ||
    input.par == null
  ) {
    return { courseHandicap: null, playingHandicap: null };
  }

  const courseHandicap = computeCourseHandicap({
    handicapIndex: input.handicapIndex,
    slopeRating: input.slopeRating,
    courseRating: input.courseRating,
    par: input.par,
    holesPlayed: input.holesPlayed,
  });
  return {
    courseHandicap,
    playingHandicap: computePlayingHandicap(courseHandicap),
  };
}

/** Standard Stableford: double bogey or worse is 0, par is 2, birdie is 3. */
export function stablefordPoints(par: number, netStrokes: number): number {
  return Math.max(0, 2 + par - netStrokes);
}

export function grossBetterThanPar(
  strokes: number,
  par: number,
): "birdie" | "eagle" | "albatross" | "better" | null {
  const under = par - strokes;
  if (under === 1) return "birdie";
  if (under === 2) return "eagle";
  if (under === 3) return "albatross";
  if (under > 3) return "better";
  return null;
}

export function scorePlayer(player: ScoringPlayer): PlayerScore {
  const holeGross = new Map<number, number>();
  const holeNet = new Map<number, number>();
  const holePoints = new Map<number, number>();
  let thru = 0;
  let gross = 0;
  let parSum = 0;

  for (const hole of player.holes) {
    if (hole.gross == null) continue;
    thru += 1;
    gross += hole.gross;
    parSum += hole.par;
    holeGross.set(hole.number, hole.gross);
  }

  const finished = player.holes.length > 0 && thru === player.holes.length;
  if (thru === 0) {
    return {
      thru,
      gross: null,
      toPar: null,
      net: null,
      stableford: null,
      finished,
      holeGross,
      holeNet,
      holePoints,
    };
  }

  const toPar = gross - parSum;
  if (player.playingHandicap == null) {
    return {
      thru,
      gross,
      toPar,
      net: null,
      stableford: null,
      finished,
      holeGross,
      holeNet,
      holePoints,
    };
  }

  const allocations = allocateHoleStrokes(
    player.playingHandicap,
    player.holes.map((hole) => ({
      number: hole.number,
      strokeIndex: hole.strokeIndex,
    })),
  );

  let net = 0;
  let points = 0;
  for (const hole of player.holes) {
    if (hole.gross == null) continue;
    const received = allocations.get(hole.number) ?? 0;
    const netStrokes = hole.gross - received;
    const holeStableford = stablefordPoints(hole.par, netStrokes);
    holeNet.set(hole.number, netStrokes);
    holePoints.set(hole.number, holeStableford);
    net += netStrokes;
    points += holeStableford;
  }

  return {
    thru,
    gross,
    toPar,
    net,
    stableford: points,
    finished,
    holeGross,
    holeNet,
    holePoints,
  };
}

export function rankPlayers(players: ScoringPlayer[]): {
  gross: BoardRow[];
  net: BoardRow[];
  stableford: BoardRow[];
  countbackApplied: boolean;
} {
  const scores = new Map(players.map((player) => [player.id, scorePlayer(player)]));
  let countbackApplied = false;
  const gross = rankMode(players, scores, "gross", () => {
    countbackApplied = true;
  });
  const net = rankMode(players, scores, "net", () => {
    countbackApplied = true;
  });
  const stableford = rankMode(players, scores, "stableford", () => {
    countbackApplied = true;
  });
  return { gross, net, stableford, countbackApplied };
}

export function soleLeader(
  rows: BoardRow[],
  mode: "stableford" | "gross",
): { playerId: string; displayName: string; value: number } | null {
  const top = rows[0];
  if (!top || top.tied || top.positionNumber == null) {
    return null;
  }
  const value = mode === "stableford" ? top.stableford : top.gross;
  if (value == null) {
    return null;
  }
  return {
    playerId: top.playerId,
    displayName: top.displayName,
    value,
  };
}

export type WeekendRoundScore = {
  gameDayId: string;
  date: string;
  playerId: string;
  displayName: string;
  userId: string | null;
  gross: number | null;
  net: number | null;
  stableford: number | null;
};

export type WeekendRow = {
  position: string | null;
  positionNumber: number | null;
  tied: boolean;
  displayName: string;
  roundsPlayed: number;
  gross: number | null;
  net: number | null;
  stableford: number | null;
};

/**
 * Sum game days. The same person is userId when both sides have one,
 * otherwise a case-insensitive display name. Net and Stableford are null
 * when any counted round has no handicap. Countback is not applied across days.
 */
export function rankWeekend(rounds: WeekendRoundScore[]): {
  gross: WeekendRow[];
  net: WeekendRow[];
  stableford: WeekendRow[];
} {
  const buckets = new Map<
    string,
    {
      displayName: string;
      grosses: number[];
      nets: Array<number | null>;
      points: Array<number | null>;
    }
  >();

  for (const round of rounds) {
    if (round.gross == null) continue;
    const key = round.userId
      ? `user:${round.userId}`
      : `name:${round.displayName.trim().toLowerCase()}`;
    const bucket = buckets.get(key) ?? {
      displayName: round.displayName,
      grosses: [],
      nets: [],
      points: [],
    };
    bucket.grosses.push(round.gross);
    bucket.nets.push(round.net);
    bucket.points.push(round.stableford);
    buckets.set(key, bucket);
  }

  const rows = [...buckets.values()].map((bucket) => ({
    displayName: bucket.displayName,
    roundsPlayed: bucket.grosses.length,
    gross: bucket.grosses.reduce((sum, value) => sum + value, 0),
    net: bucket.nets.some((value) => value == null)
      ? null
      : bucket.nets.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    stableford: bucket.points.some((value) => value == null)
      ? null
      : bucket.points.reduce<number>((sum, value) => sum + (value ?? 0), 0),
  }));

  return {
    gross: rankWeekendMode(rows, "gross"),
    net: rankWeekendMode(rows, "net"),
    stableford: rankWeekendMode(rows, "stableford"),
  };
}

function rankWeekendMode(
  rows: Array<{
    displayName: string;
    roundsPlayed: number;
    gross: number | null;
    net: number | null;
    stableford: number | null;
  }>,
  mode: BoardMode,
): WeekendRow[] {
  const higherBetter = mode === "stableford";
  const valueOf = (row: (typeof rows)[number]): number | null =>
    mode === "gross" ? row.gross : mode === "net" ? row.net : row.stableford;
  const scored = rows.filter((row) => valueOf(row) != null);
  const unscored = rows.filter((row) => valueOf(row) == null);
  scored.sort((left, right) => {
    const delta = higherBetter
      ? (valueOf(right) as number) - (valueOf(left) as number)
      : (valueOf(left) as number) - (valueOf(right) as number);
    if (delta !== 0) return delta;
    return left.displayName.localeCompare(right.displayName);
  });

  const ranked: WeekendRow[] = [];
  let index = 0;
  while (index < scored.length) {
    const value = valueOf(scored[index]);
    let end = index + 1;
    while (end < scored.length && valueOf(scored[end]) === value) end += 1;
    const tied = end - index > 1;
    const positionNumber = index + 1;
    for (let cursor = index; cursor < end; cursor++) {
      const row = scored[cursor]!;
      ranked.push({
        position: tied ? `T${positionNumber}` : String(positionNumber),
        positionNumber,
        tied,
        displayName: row.displayName,
        roundsPlayed: row.roundsPlayed,
        gross: row.gross,
        net: row.net,
        stableford: row.stableford,
      });
    }
    index = end;
  }

  for (const row of unscored) {
    ranked.push({
      position: null,
      positionNumber: null,
      tied: false,
      displayName: row.displayName,
      roundsPlayed: row.roundsPlayed,
      gross: row.gross,
      net: row.net,
      stableford: row.stableford,
    });
  }
  return ranked;
}

function rankMode(
  players: ScoringPlayer[],
  scores: Map<string, PlayerScore>,
  mode: BoardMode,
  onCountback: () => void,
): BoardRow[] {
  const higherBetter = mode === "stableford";
  const valueOf = (player: ScoringPlayer): number | null => {
    const score = scores.get(player.id);
    if (!score) return null;
    if (mode === "gross") return score.gross;
    if (mode === "net") return score.net;
    return score.stableford;
  };

  const scored = players.filter((player) => valueOf(player) != null);
  const unscored = players.filter((player) => valueOf(player) == null);
  scored.sort((left, right) => {
    const delta = higherBetter
      ? (valueOf(right) as number) - (valueOf(left) as number)
      : (valueOf(left) as number) - (valueOf(right) as number);
    if (delta !== 0) return delta;
    return left.displayName.localeCompare(right.displayName);
  });

  const ordered: ScoringPlayer[] = [];
  const notes = new Map<string, string>();

  for (let index = 0; index < scored.length; ) {
    const value = valueOf(scored[index]);
    let end = index + 1;
    while (end < scored.length && valueOf(scored[end]) === value) end += 1;
    const group = scored.slice(index, end);
    const finished =
      group.length > 1 &&
      group.every((player) => scores.get(player.id)?.finished === true);
    if (!finished) {
      ordered.push(...group);
      index = end;
      continue;
    }

    const keyed = group.map((player) => ({
      player,
      key: countbackKey(player, scores.get(player.id)!, mode),
    }));
    keyed.sort(
      (left, right) =>
        compareKeys(left.key, right.key) ||
        left.player.displayName.localeCompare(right.player.displayName),
    );
    const separated = keyed.some(
      (item) => compareKeys(item.key, keyed[0]!.key) !== 0,
    );
    if (separated) {
      onCountback();
      const best = keyed[0]!.key;
      const splitWindow = keyed
        .map((item) => firstWindow(best, item.key))
        .find((window) => window != null);
      for (const item of keyed) {
        const window = firstWindow(best, item.key);
        if (window == null) {
          notes.set(
            item.player.id,
            `Won countback (last ${splitWindow ?? 9})`,
          );
        } else {
          notes.set(item.player.id, `Lost countback (last ${window})`);
        }
      }
    }
    ordered.push(...keyed.map((item) => item.player));
    index = end;
  }

  const rows: BoardRow[] = [];
  let index = 0;
  while (index < ordered.length) {
    const current = ordered[index]!;
    const value = valueOf(current);
    const currentScore = scores.get(current.id)!;
    const currentKey = countbackKey(current, currentScore, mode);
    let end = index + 1;
    while (end < ordered.length && valueOf(ordered[end]!) === value) {
      const other = ordered[end]!;
      const otherScore = scores.get(other.id)!;
      if (currentScore.finished && otherScore.finished) {
        if (compareKeys(currentKey, countbackKey(other, otherScore, mode)) !== 0) {
          break;
        }
      } else if (currentScore.finished !== otherScore.finished) {
        break;
      }
      end += 1;
    }
    const tied = end - index > 1;
    const positionNumber = index + 1;
    for (let cursor = index; cursor < end; cursor++) {
      const player = ordered[cursor]!;
      rows.push(toRow(player, scores.get(player.id)!, positionNumber, tied, notes.get(player.id) ?? null));
    }
    index = end;
  }

  for (const player of unscored) {
    rows.push(toRow(player, scores.get(player.id)!, null, false, null));
  }
  return rows;
}

function toRow(
  player: ScoringPlayer,
  score: PlayerScore,
  positionNumber: number | null,
  tied: boolean,
  countbackNote: string | null,
): BoardRow {
  return {
    position:
      positionNumber == null
        ? null
        : tied
          ? `T${positionNumber}`
          : String(positionNumber),
    positionNumber,
    tied,
    playerId: player.id,
    displayName: player.displayName,
    userId: player.userId,
    cardId: player.cardId,
    cardNumber: player.cardNumber,
    handicapIndex: player.handicapIndex,
    playingHandicap: player.playingHandicap,
    thru: score.thru,
    gross: score.gross,
    toPar: score.toPar,
    net: score.net,
    stableford: score.stableford,
    countbackNote,
  };
}

function countbackKey(
  player: ScoringPlayer,
  score: PlayerScore,
  mode: BoardMode,
): number[] {
  return COUNTBACK_WINDOWS.map((window) => {
    const slice =
      player.holes.length <= window
        ? player.holes
        : player.holes.slice(player.holes.length - window);
    let sum = 0;
    for (const hole of slice) {
      if (mode === "gross") sum += score.holeGross.get(hole.number) ?? 0;
      else if (mode === "net") sum += score.holeNet.get(hole.number) ?? 0;
      else sum += score.holePoints.get(hole.number) ?? 0;
    }
    return mode === "stableford" ? -sum : sum;
  });
}

function compareKeys(left: number[], right: number[]): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return (left[index] ?? 0) - (right[index] ?? 0);
    }
  }
  return 0;
}

function firstWindow(best: number[], other: number[]): number | null {
  for (let index = 0; index < COUNTBACK_WINDOWS.length; index++) {
    if (best[index] !== other[index]) {
      return COUNTBACK_WINDOWS[index] ?? null;
    }
  }
  return null;
}
