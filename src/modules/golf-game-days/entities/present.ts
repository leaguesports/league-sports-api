import {
  BoardRow,
  rankPlayers,
  rankWeekend,
  ScoringPlayer,
  WeekendRoundScore,
} from "./scoring";
import {
  CardRecord,
  dateLabel,
  GameDayRecord,
  headline,
  HoleRecord,
  PlayerRecord,
  strokesBySlot,
} from "./record";

export type Access = "organiser" | "player" | "watch";

export function toScoringPlayers(day: GameDayRecord): ScoringPlayer[] {
  const players: ScoringPlayer[] = [];
  for (const card of day.cards) {
    for (const player of seated(day, card.id)) {
      const holes = card.course.holes.map((hole) => {
        const saved = card.holes.find((entry) => entry.holeNumber === hole.number);
        const gross = saved ? strokesBySlot(saved)[String(player.slot)] : undefined;
        return {
          number: hole.number,
          par: hole.par,
          strokeIndex: hole.strokeIndex,
          gross: typeof gross === "number" ? gross : null,
        };
      });
      players.push({
        id: player.id,
        displayName: player.displayName,
        userId: player.userId,
        handicapIndex: player.handicapIndex,
        playingHandicap: player.playingHandicap,
        cardId: card.id,
        cardNumber: card.number,
        slot: player.slot ?? 0,
        holes,
      });
    }
  }
  return players;
}

export function presentOrganiser(day: GameDayRecord) {
  return {
    id: day.id,
    inviteCode: day.inviteCode,
    watchToken: day.watchToken,
    watchPath: `/api/golf-game-days/watch/${day.watchToken}/leaderboard`,
    venueCmsId: day.venueCmsId,
    venueName: day.venueName,
    date: day.date,
    dateLabel: dateLabel(day.date),
    headline: headline(day.venueName, day.date),
    defaultTee: day.defaultTee,
    teeOptions: day.teeOptions,
    format: day.format,
    status: day.status,
    version: day.version,
    weekendEventId: day.weekendEventId,
    claimed: day.organiserUserId != null,
    organiserPlayerId: organiserPlayerId(day),
    players: day.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      handicapIndex: player.handicapIndex,
      teeName: player.teeName,
      joined: player.deviceTokenHash != null,
      isOrganiser: isOrganiserPlayer(day, player),
      cardId: player.cardId,
      cardNumber: cardNumber(day, player.cardId),
      slot: player.slot,
    })),
  };
}

export function presentPreview(day: GameDayRecord) {
  return {
    id: day.id,
    venueName: day.venueName,
    venueCmsId: day.venueCmsId,
    date: day.date,
    dateLabel: dateLabel(day.date),
    headline: headline(day.venueName, day.date),
    defaultTee: day.defaultTee,
    teeOptions: day.teeOptions,
    format: day.format,
    status: day.status,
    players: day.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      taken: player.deviceTokenHash != null,
      cardId: player.cardId,
      cardNumber: cardNumber(day, player.cardId),
    })),
    cards: day.cards.map((card) => presentPreviewCard(day, card)),
  };
}

export function presentCard(
  day: GameDayRecord,
  card: CardRecord,
  viewerPlayerId: string | null,
) {
  const players = seated(day, card.id);
  return {
    id: card.id,
    gameDayId: day.id,
    number: card.number,
    status: card.status,
    golfRoundId: card.golfRoundId,
    holesPlayed: card.holesPlayed,
    startingHole: card.startingHole,
    scoring: viewerPlayerId != null && players.some((player) => player.id === viewerPlayerId),
    scorer: scorerView(day, card),
    players: players.map((player) => ({
      playerId: player.id,
      slot: player.slot,
      displayName: player.displayName,
      handicapIndex: player.handicapIndex,
      playingHandicap: player.playingHandicap,
      courseHandicap: player.courseHandicap,
      teeName: player.teeName,
      looksRight: player.looksRight,
      isScorer: true,
      you: viewerPlayerId != null && player.id === viewerPlayerId,
    })),
    course: card.course,
    tees: card.tees,
    holes: presentHoles(card),
    missingHoles: card.course.holes
      .map((hole) => hole.number)
      .filter((number) => {
        const saved = card.holes.find((hole) => hole.holeNumber === number);
        if (!saved) return true;
        return players.some(
          (player) => !saved.scores.some((score) => score.slot === player.slot),
        );
      }),
  };
}

export function presentLeaderboard(
  day: GameDayRecord,
  viewerPlayerId: string | null,
  access: Access,
) {
  const ranked = rankPlayers(toScoringPlayers(day));
  const mapRow = (row: BoardRow) => ({
    position: row.position,
    positionNumber: row.positionNumber,
    tied: row.tied,
    playerId: row.playerId,
    displayName: row.displayName,
    you: viewerPlayerId != null && row.playerId === viewerPlayerId,
    cardId: row.cardId,
    cardNumber: row.cardNumber,
    handicapIndex: row.handicapIndex,
    playingHandicap: row.playingHandicap,
    thru: row.thru,
    gross: row.gross,
    toPar: row.toPar,
    net: row.net,
    stableford: row.stableford,
    countbackNote: row.countbackNote,
  });
  const rankings = {
    gross: ranked.gross.map(mapRow),
    net: ranked.net.map(mapRow),
    stableford: ranked.stableford.map(mapRow),
  };
  const cardsConfirmed = day.cards.filter((card) => card.status === "locked").length;
  return {
    gameDayId: day.id,
    version: day.version,
    access,
    status: day.status,
    format: day.format,
    venueName: day.venueName,
    venueCmsId: day.venueCmsId,
    date: day.date,
    dateLabel: dateLabel(day.date),
    headline: headline(day.venueName, day.date),
    cardsConfirmed,
    cardsTotal: day.cards.length,
    countback: "last 9, 6, 3, 1",
    countbackApplied: ranked.countbackApplied,
    rankings,
    podium:
      day.status === "final"
        ? {
            gross: rankings.gross.filter(
              (row) => row.positionNumber != null && row.positionNumber <= 3,
            ),
            net: rankings.net.filter(
              (row) => row.positionNumber != null && row.positionNumber <= 3,
            ),
            stableford: rankings.stableford.filter(
              (row) => row.positionNumber != null && row.positionNumber <= 3,
            ),
          }
        : null,
    feed: [...day.feed].reverse().map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      at: event.createdAt,
      ...event.payload,
    })),
    cards: day.cards.map((card) => ({
      id: card.id,
      number: card.number,
      status: card.status,
      thru: card.holes.length,
      playerCount: seated(day, card.id).length,
      syncedAt: latestTimestamp(card),
      holes: presentHoles(card),
    })),
  };
}

export function presentWeekend(
  weekend: { id: string; name: string | null },
  days: GameDayRecord[],
) {
  const rounds: WeekendRoundScore[] = [];
  for (const day of days) {
    const ranked = rankPlayers(toScoringPlayers(day));
    for (const row of ranked.gross) {
      rounds.push({
        gameDayId: day.id,
        date: day.date,
        playerId: row.playerId,
        displayName: row.displayName,
        userId: row.userId,
        gross: row.gross,
        net: row.net,
        stableford: row.stableford,
      });
    }
    for (const row of ranked.net) {
      if (row.gross != null) continue;
      rounds.push({
        gameDayId: day.id,
        date: day.date,
        playerId: row.playerId,
        displayName: row.displayName,
        userId: row.userId,
        gross: null,
        net: row.net,
        stableford: row.stableford,
      });
    }
  }
  const rankings = rankWeekend(rounds);
  return {
    weekendEventId: weekend.id,
    name: weekend.name,
    gameDays: [...days]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((day) => ({
        id: day.id,
        date: day.date,
        dateLabel: dateLabel(day.date),
        venueName: day.venueName,
        status: day.status,
      })),
    countback: null,
    rankings,
  };
}

function presentPreviewCard(day: GameDayRecord, card: CardRecord) {
  const players = seated(day, card.id);
  return {
    id: card.id,
    number: card.number,
    status: card.status,
    openSlots: Math.max(0, 4 - players.length),
    full: players.length >= 4,
    players: players.map((player) => ({
      displayName: player.displayName,
      slot: player.slot,
      scoring: true,
    })),
  };
}

function seated(day: GameDayRecord, cardId: string): PlayerRecord[] {
  return day.players
    .filter((player) => player.cardId === cardId && player.slot != null)
    .sort((left, right) => (left.slot ?? 0) - (right.slot ?? 0));
}

function cardNumber(day: GameDayRecord, cardId: string | null): number | null {
  if (!cardId) return null;
  return day.cards.find((card) => card.id === cardId)?.number ?? null;
}

function scorerView(day: GameDayRecord, card: CardRecord) {
  const player = day.players.find((item) => item.id === card.scorerPlayerId);
  return {
    playerId: card.scorerPlayerId,
    displayName: player?.displayName ?? "",
  };
}

function presentHoles(card: CardRecord) {
  return [...card.holes]
    .sort((left, right) => left.holeNumber - right.holeNumber)
    .map((hole) => presentHole(hole));
}

function presentHole(hole: HoleRecord) {
  const latestClient = hole.scores.reduce<string | null>((latest, score) => {
    if (latest == null || score.clientTimestamp > latest) return score.clientTimestamp;
    return latest;
  }, null);
  return {
    number: hole.holeNumber,
    strokes: strokesBySlot(hole),
    clientTimestamp: latestClient,
    synced: true,
    scores: [...hole.scores]
      .sort((left, right) => left.slot - right.slot)
      .map((score) => ({
        slot: score.slot,
        strokes: score.strokes,
        updatedByPlayerId: score.updatedByPlayerId,
        updatedByName: score.updatedByName,
        updatedAt: score.updatedAt,
      })),
  };
}

function latestTimestamp(card: CardRecord): string | null {
  let latest: string | null = null;
  for (const hole of card.holes) {
    for (const score of hole.scores) {
      if (latest == null || score.updatedAt > latest) latest = score.updatedAt;
    }
  }
  return latest;
}

function organiserPlayerId(day: GameDayRecord): string | null {
  const player = day.players.find((item) => isOrganiserPlayer(day, item));
  return player?.id ?? null;
}

function isOrganiserPlayer(day: GameDayRecord, player: PlayerRecord): boolean {
  return (
    day.organiserTokenHash != null &&
    player.deviceTokenHash != null &&
    player.deviceTokenHash === day.organiserTokenHash
  );
}
