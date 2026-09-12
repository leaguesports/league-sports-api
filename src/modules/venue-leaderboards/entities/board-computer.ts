import { isInJohannesburgMonth } from "./johannesburg-calendar";
import {
  PublicBoardEntry,
  RecordsPayload,
  SnapshotPayload,
} from "./board-payload";
import { LeaderboardBoard } from "./leaderboard-board";
import { LeaderboardWindow } from "./leaderboard-window";
import {
  BoardProfile,
  toPublicBoardIdentity,
} from "./public-display-name";
import { LeaderboardSport, VenueEventFact } from "./venue-event-fact";

export const POTM_LIMIT = 5;
export const GRINDER_MIN_EVENTS = 3;
export const HOT_STREAK_MIN = 2;
export const GOLF_NET_AVG_MIN_ROUNDS = 3;

type Rankable = {
  userId: string;
  sort: number[];
  stats: PublicBoardEntry["stats"];
};

function compareLockedAt(a: VenueEventFact, b: VenueEventFact): number {
  const delta = a.lockedAt.getTime() - b.lockedAt.getTime();
  if (delta !== 0) return delta;
  return a.eventId.localeCompare(b.eventId);
}

function excludeOptedOut(
  facts: VenueEventFact[],
  optedOut: ReadonlySet<string>,
): VenueEventFact[] {
  return facts.filter((fact) => !optedOut.has(fact.userId));
}

function inWindow(facts: VenueEventFact[], window: LeaderboardWindow): VenueEventFact[] {
  if (window.value === "all") return facts;
  return facts.filter((fact) => isInJohannesburgMonth(fact.lockedAt, window.key));
}

function identity(
  profiles: ReadonlyMap<string, BoardProfile>,
  userId: string,
) {
  return toPublicBoardIdentity(profiles.get(userId), userId);
}

function rankEntries(
  rows: Rankable[],
  profiles: ReadonlyMap<string, BoardProfile>,
  limit?: number,
): PublicBoardEntry[] {
  const sorted = [...rows].sort((a, b) => {
    for (let i = 0; i < Math.max(a.sort.length, b.sort.length); i += 1) {
      const left = a.sort[i] ?? 0;
      const right = b.sort[i] ?? 0;
      if (left !== right) return left - right;
    }
    return a.userId.localeCompare(b.userId);
  });
  const sliced = limit === undefined ? sorted : sorted.slice(0, limit);
  return sliced.map((row, index) => ({
    rank: index + 1,
    ...identity(profiles, row.userId),
    stats: row.stats,
  }));
}

function groupByUser(facts: VenueEventFact[]): Map<string, VenueEventFact[]> {
  const groups = new Map<string, VenueEventFact[]>();
  for (const fact of facts) {
    const list = groups.get(fact.userId) ?? [];
    list.push(fact);
    groups.set(fact.userId, list);
  }
  for (const list of groups.values()) {
    list.sort(compareLockedAt);
  }
  return groups;
}

export function currentWinStreak(facts: VenueEventFact[]): number {
  const newestFirst = [...facts].sort((a, b) => compareLockedAt(b, a));
  let streak = 0;
  for (const fact of newestFirst) {
    if (fact.won === true) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

export function bestWinStreak(facts: VenueEventFact[]): number {
  const oldestFirst = [...facts].sort(compareLockedAt);
  let current = 0;
  let best = 0;
  for (const fact of oldestFirst) {
    if (fact.won === true) {
      current += 1;
      if (current > best) best = current;
      continue;
    }
    current = 0;
  }
  return best;
}

function mostWinsRows(facts: VenueEventFact[]): Rankable[] {
  const rows: Rankable[] = [];
  for (const [userId, userFacts] of groupByUser(facts)) {
    const wins = userFacts.filter((fact) => fact.won === true);
    if (wins.length === 0) continue;
    const firstWinAt = wins[0]!.lockedAt.getTime();
    rows.push({
      userId,
      sort: [-wins.length, -userFacts.length, firstWinAt],
      stats: { wins: wins.length, events: userFacts.length },
    });
  }
  return rows;
}

function bestStreakRows(facts: VenueEventFact[], minStreak: number): Rankable[] {
  const rows: Rankable[] = [];
  for (const [userId, userFacts] of groupByUser(facts)) {
    const streak = bestWinStreak(userFacts);
    if (streak < minStreak) continue;
    rows.push({
      userId,
      sort: [-streak, userFacts[0]!.lockedAt.getTime()],
      stats: { streak },
    });
  }
  return rows;
}

function currentStreakRows(facts: VenueEventFact[], minStreak: number): Rankable[] {
  const rows: Rankable[] = [];
  for (const [userId, userFacts] of groupByUser(facts)) {
    const streak = currentWinStreak(userFacts);
    if (streak < minStreak) continue;
    rows.push({
      userId,
      sort: [-streak, userFacts[userFacts.length - 1]!.lockedAt.getTime()],
      stats: { streak },
    });
  }
  return rows;
}

function golfTeeRecords(
  facts: VenueEventFact[],
  profiles: ReadonlyMap<string, BoardProfile>,
  kind: "gross" | "net",
): RecordsPayload["golf"]["bestGrossByTee"] {
  const byTee = new Map<string, VenueEventFact>();
  for (const fact of facts) {
    if (!fact.isEighteenHoleGolf) continue;
    const score = kind === "gross" ? fact.golfGross : fact.golfNet;
    if (score === null) continue;
    const existing = byTee.get(fact.teeKey);
    if (!existing) {
      byTee.set(fact.teeKey, fact);
      continue;
    }
    const existingScore =
      kind === "gross" ? existing.golfGross : existing.golfNet;
    if (existingScore === null || score < existingScore) {
      byTee.set(fact.teeKey, fact);
      continue;
    }
    if (
      existingScore === score &&
      compareLockedAt(fact, existing) < 0
    ) {
      byTee.set(fact.teeKey, fact);
    }
  }

  return [...byTee.values()]
    .sort((a, b) => a.teeKey.localeCompare(b.teeKey))
    .map((fact) => ({
      teeId: fact.golfTeeId,
      teeName: fact.golfTeeName,
      ...identity(profiles, fact.userId),
      stats: {
        score: kind === "gross" ? fact.golfGross : fact.golfNet,
        eventId: fact.eventId,
        lockedAt: fact.lockedAt.toISOString(),
      },
    }));
}

function computeRecords(
  facts: VenueEventFact[],
  profiles: ReadonlyMap<string, BoardProfile>,
): RecordsPayload {
  const padel = facts.filter((fact) => fact.sport === "padel");
  const darts = facts.filter((fact) => fact.sport === "darts");
  return {
    golf: {
      bestGrossByTee: golfTeeRecords(facts, profiles, "gross"),
      bestNetByTee: golfTeeRecords(facts, profiles, "net"),
    },
    padel: {
      mostWins: rankEntries(mostWinsRows(padel), profiles, POTM_LIMIT),
      bestWinStreak: rankEntries(bestStreakRows(padel, HOT_STREAK_MIN), profiles, POTM_LIMIT),
    },
    darts: {
      mostWins: rankEntries(mostWinsRows(darts), profiles, POTM_LIMIT),
      bestWinStreak: rankEntries(bestStreakRows(darts, HOT_STREAK_MIN), profiles, POTM_LIMIT),
    },
  };
}

export function computePotm(
  facts: VenueEventFact[],
  profiles: ReadonlyMap<string, BoardProfile>,
): PublicBoardEntry[] {
  const winSports = facts.filter(
    (fact) => fact.sport === "padel" || fact.sport === "darts",
  );
  const golf = facts.filter((fact) => fact.sport === "golf");

  if (winSports.length > 0 && golf.length === 0) {
    return rankEntries(mostWinsRows(winSports), profiles, POTM_LIMIT);
  }

  if (golf.length > 0 && winSports.length === 0) {
    return rankEntries(golfPotmRows(golf), profiles, POTM_LIMIT);
  }

  // Mixed-sport venue: padel/darts compete on wins; golf uses its own rule.
  // Combined list is unusual — prefer wins board when any racquet/darts facts
  // exist, otherwise golf. Product is per-venue sport in practice.
  if (winSports.length > 0) {
    return rankEntries(mostWinsRows(winSports), profiles, POTM_LIMIT);
  }
  return [];
}

function golfPotmRows(facts: VenueEventFact[]): Rankable[] {
  const rows: Rankable[] = [];
  const byUser = groupByUser(facts);
  const netQualified: Rankable[] = [];

  for (const [userId, userFacts] of byUser) {
    const netRounds = userFacts.filter(
      (fact) => fact.isEighteenHoleGolf && fact.golfNet !== null,
    );
    const firstEventAt = userFacts[0]!.lockedAt.getTime();
    if (netRounds.length >= GOLF_NET_AVG_MIN_ROUNDS) {
      const netAverage =
        netRounds.reduce((sum, fact) => sum + (fact.golfNet ?? 0), 0) /
        netRounds.length;
      netQualified.push({
        userId,
        sort: [netAverage, -userFacts.length, firstEventAt],
        stats: {
          netAverage: Number(netAverage.toFixed(2)),
          events: userFacts.length,
          netRounds: netRounds.length,
        },
      });
    }
    rows.push({
      userId,
      sort: [-userFacts.length, firstEventAt],
      stats: { events: userFacts.length },
    });
  }

  return netQualified.length > 0 ? netQualified : rows;
}

export function computeGrinder(
  facts: VenueEventFact[],
  profiles: ReadonlyMap<string, BoardProfile>,
): PublicBoardEntry[] {
  const rows: Rankable[] = [];
  for (const [userId, userFacts] of groupByUser(facts)) {
    if (userFacts.length < GRINDER_MIN_EVENTS) continue;
    rows.push({
      userId,
      sort: [-userFacts.length, userFacts[0]!.lockedAt.getTime()],
      stats: { events: userFacts.length },
    });
  }
  return rankEntries(rows, profiles);
}

export function computeHotStreak(
  facts: VenueEventFact[],
  profiles: ReadonlyMap<string, BoardProfile>,
): PublicBoardEntry[] {
  const eligible = facts.filter(
    (fact) => fact.sport === "padel" || fact.sport === "darts",
  );
  return rankEntries(currentStreakRows(eligible, HOT_STREAK_MIN), profiles);
}

export class VenueLeaderboardComputer {
  static compute(input: {
    board: LeaderboardBoard;
    window: LeaderboardWindow;
    facts: VenueEventFact[];
    profiles: ReadonlyMap<string, BoardProfile>;
    optedOutUserIds: ReadonlySet<string>;
  }): SnapshotPayload {
    const facts = inWindow(
      excludeOptedOut(input.facts, input.optedOutUserIds),
      input.window,
    );

    if (input.board.value === "records") {
      const records = computeRecords(facts, input.profiles);
      return { first: null, entries: [], records };
    }

    const entries =
      input.board.value === "potm"
        ? computePotm(facts, input.profiles)
        : input.board.value === "grinder"
          ? computeGrinder(facts, input.profiles)
          : computeHotStreak(facts, input.profiles);

    return {
      first: entries[0] ?? null,
      entries,
    };
  }
}

export function sportFacts(
  facts: VenueEventFact[],
  sport: LeaderboardSport,
): VenueEventFact[] {
  return facts.filter((fact) => fact.sport === sport);
}
