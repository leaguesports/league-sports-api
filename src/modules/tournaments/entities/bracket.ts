import { TournamentSize } from "./tournament-size";
import { TournamentSlot } from "./tournament-slot";

export type SeededTeam = {
  teamId: string;
  seed: number;
};

/**
 * Standard single-elim seed order so #1 and #2 meet in the final.
 * 4:  [1, 4, 2, 3]
 * 8:  [1, 8, 4, 5, 2, 7, 3, 6]
 * 16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
 */
export function seedPositions(size: TournamentSize): number[] {
  let positions = [1, 2];
  while (positions.length < size.value) {
    const next: number[] = [];
    const n = positions.length * 2;
    for (const seed of positions) {
      next.push(seed, n + 1 - seed);
    }
    positions = next;
  }
  return positions;
}

export function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildSingleElimSlots(
  size: TournamentSize,
  seeded: SeededTeam[],
): TournamentSlot[] {
  if (seeded.length !== size.value) {
    throw new Error("Seeded field must equal tournament size");
  }

  const bySeed = new Map(seeded.map((entry) => [entry.seed, entry.teamId]));
  const rounds = size.rounds;
  const byRound: TournamentSlot[][] = [];

  for (let round = 1; round <= rounds; round++) {
    const count = size.value / 2 ** round;
    const slots: TournamentSlot[] = [];
    for (let position = 0; position < count; position++) {
      slots.push(TournamentSlot.create({ round, position }));
    }
    byRound.push(slots);
  }

  for (let r = 0; r < byRound.length - 1; r++) {
    for (let i = 0; i < byRound[r].length; i++) {
      const next = byRound[r + 1][Math.floor(i / 2)];
      byRound[r][i].setNext(next.id, i % 2 === 0 ? "home" : "away");
    }
  }

  const order = seedPositions(size);
  const first = byRound[0];
  for (let i = 0; i < first.length; i++) {
    const homeSeed = order[i * 2];
    const awaySeed = order[i * 2 + 1];
    const homeTeamId = bySeed.get(homeSeed);
    const awayTeamId = bySeed.get(awaySeed);
    if (!homeTeamId || !awayTeamId) {
      throw new Error("Missing seeded team for first-round pair");
    }
    first[i].placeTeams(homeTeamId, awayTeamId, homeSeed, awaySeed);
  }

  return byRound.flat();
}
