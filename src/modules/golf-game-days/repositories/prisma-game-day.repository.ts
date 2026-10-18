import { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { decimalToNumber } from "../../golf-round/repositories/golf-handicap-index.lookup";
import {
  GameDayHttpError,
  GameDayPersistenceError,
  InviteCodeCollisionError,
} from "../entities/errors";
import {
  CardRecord,
  CardStatus,
  CourseCopy,
  FeedRecord,
  FeedType,
  GameDayRecord,
  GameDayStatus,
  HoleRecord,
  PlayerRecord,
  TeeRating,
  WeekendRecord,
} from "../entities/record";
import { GameDayRepository } from "./game-day.repository";

type Db = PrismaClient | Prisma.TransactionClient;

const include = {
  venue: true,
  players: true,
  cards: { include: { holes: true } },
  feed: { orderBy: { createdAt: "asc" as const } },
};

export class PrismaGameDayRepository implements GameDayRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(day: GameDayRecord): Promise<GameDayRecord> {
    try {
      const row = await this.prisma.gameDay.create({
        data: {
          id: day.id,
          organiserUserId: day.organiserUserId,
          venueCmsId: day.venueCmsId,
          date: asDate(day.date),
          defaultTee: day.defaultTee,
          teeOptions: day.teeOptions,
          format: day.format,
          inviteCode: day.inviteCode,
          watchToken: day.watchToken,
          watchTokenHash: day.watchTokenHash,
          status: day.status,
          weekendEventId: day.weekendEventId,
          version: day.version,
          players: { create: day.players.map(playerCreate) },
        },
        include,
      });
      return toRecord(row);
    } catch (error) {
      throw mapWriteError(error);
    }
  }

  async createWeekend(event: WeekendRecord): Promise<WeekendRecord> {
    try {
      const row = await this.prisma.weekendEvent.create({
        data: {
          id: event.id,
          organiserUserId: event.organiserUserId,
          name: event.name,
          createdAt: new Date(event.createdAt),
        },
      });
      return {
        id: row.id,
        organiserUserId: row.organiserUserId,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      throw mapWriteError(error);
    }
  }

  async findWeekend(id: string): Promise<WeekendRecord | null> {
    try {
      const row = await this.prisma.weekendEvent.findUnique({ where: { id } });
      if (!row) return null;
      return {
        id: row.id,
        organiserUserId: row.organiserUserId,
        name: row.name,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error) {
      throw wrap(error);
    }
  }

  async findById(id: string): Promise<GameDayRecord | null> {
    try {
      const row = await this.prisma.gameDay.findUnique({ where: { id }, include });
      return row ? toRecord(row) : null;
    } catch (error) {
      throw wrap(error);
    }
  }

  async findByInviteCode(code: string): Promise<GameDayRecord | null> {
    try {
      const row = await this.prisma.gameDay.findUnique({
        where: { inviteCode: code.trim().toUpperCase() },
        include,
      });
      return row ? toRecord(row) : null;
    } catch (error) {
      throw wrap(error);
    }
  }

  async findByWatchTokenHash(hash: string): Promise<GameDayRecord | null> {
    try {
      const row = await this.prisma.gameDay.findUnique({
        where: { watchTokenHash: hash },
        include,
      });
      return row ? toRecord(row) : null;
    } catch (error) {
      throw wrap(error);
    }
  }

  async listByWeekend(weekendEventId: string): Promise<GameDayRecord[]> {
    try {
      const rows = await this.prisma.gameDay.findMany({
        where: { weekendEventId },
        include,
        orderBy: { date: "asc" },
      });
      return rows.map(toRecord);
    } catch (error) {
      throw wrap(error);
    }
  }

  async update(
    id: string,
    mutate: (day: GameDayRecord) => void,
  ): Promise<GameDayRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "GameDay" WHERE "id" = ${id} FOR UPDATE`;
        const row = await tx.gameDay.findUnique({ where: { id }, include });
        if (!row) return null;
        const draft = toRecord(row);
        mutate(draft);
        await persist(tx, draft);
        return draft;
      });
    } catch (error) {
      if (error instanceof GameDayHttpError) throw error;
      throw mapWriteError(error);
    }
  }
}

async function persist(tx: Prisma.TransactionClient, day: GameDayRecord): Promise<void> {
  await tx.gameDay.update({
    where: { id: day.id },
    data: {
      status: day.status,
      version: day.version,
      defaultTee: day.defaultTee,
      teeOptions: day.teeOptions,
      weekendEventId: day.weekendEventId,
    },
  });

  for (const card of day.cards) {
    await tx.gameDayCard.upsert({
      where: { id: card.id },
      create: cardCreate(day.id, card),
      update: {
        status: card.status,
        scorerPlayerId: card.scorerPlayerId,
        course: card.course as Prisma.InputJsonValue,
        tees: card.tees as unknown as Prisma.InputJsonValue,
      },
    });
    for (const hole of card.holes) {
      await tx.gameDayHoleScore.upsert({
        where: { id: hole.id },
        create: {
          id: hole.id,
          cardId: card.id,
          holeNumber: hole.holeNumber,
          strokes: hole.strokes,
          clientTimestamp: new Date(hole.clientTimestamp),
        },
        update: {
          strokes: hole.strokes,
          clientTimestamp: new Date(hole.clientTimestamp),
        },
      });
    }
  }

  for (const player of day.players) {
    await tx.gameDayPlayer.upsert({
      where: { id: player.id },
      create: { ...playerCreate(player), gameDayId: day.id },
      update: playerUpdate(player),
    });
  }

  const keep = day.feed.map((event) => event.id);
  await tx.gameDayFeedEvent.deleteMany({
    where: { gameDayId: day.id, id: { notIn: keep } },
  });
  const existing = await tx.gameDayFeedEvent.findMany({
    where: { gameDayId: day.id },
    select: { id: true },
  });
  const have = new Set(existing.map((event) => event.id));
  for (const event of day.feed) {
    if (have.has(event.id)) continue;
    await tx.gameDayFeedEvent.create({
      data: {
        id: event.id,
        gameDayId: day.id,
        type: event.type,
        message: event.message,
        payload: event.payload as Prisma.InputJsonValue,
        createdAt: new Date(event.createdAt),
      },
    });
  }
}

function playerCreate(player: PlayerRecord) {
  return {
    id: player.id,
    displayName: player.displayName,
    userId: player.userId,
    handicapIndex: player.handicapIndex,
    teeName: player.teeName,
    cardId: player.cardId,
    slot: player.slot,
    deviceTokenHash: player.deviceTokenHash,
    looksRight: player.looksRight,
    courseRating: player.courseRating,
    slopeRating: player.slopeRating,
    teePar: player.teePar,
    courseHandicap: player.courseHandicap,
    playingHandicap: player.playingHandicap,
  };
}

function playerUpdate(player: PlayerRecord) {
  return {
    displayName: player.displayName,
    userId: player.userId,
    handicapIndex: player.handicapIndex,
    teeName: player.teeName,
    cardId: player.cardId,
    slot: player.slot,
    deviceTokenHash: player.deviceTokenHash,
    looksRight: player.looksRight,
    courseRating: player.courseRating,
    slopeRating: player.slopeRating,
    teePar: player.teePar,
    courseHandicap: player.courseHandicap,
    playingHandicap: player.playingHandicap,
  };
}

function cardCreate(gameDayId: string, card: CardRecord) {
  return {
    id: card.id,
    gameDayId,
    number: card.number,
    golfRoundId: card.golfRoundId,
    scorerPlayerId: card.scorerPlayerId,
    status: card.status,
    holesPlayed: card.holesPlayed,
    startingHole: card.startingHole,
    course: card.course as Prisma.InputJsonValue,
    tees: card.tees as unknown as Prisma.InputJsonValue,
  };
}

type DayRow = Prisma.GameDayGetPayload<{ include: typeof include }>;

function toRecord(row: DayRow): GameDayRecord {
  return {
    id: row.id,
    organiserUserId: row.organiserUserId,
    venueCmsId: row.venueCmsId,
    venueName: row.venue.name,
    date: row.date.toISOString().slice(0, 10),
    defaultTee: row.defaultTee,
    teeOptions: asStringArray(row.teeOptions),
    format: "stroke",
    inviteCode: row.inviteCode,
    watchToken: row.watchToken,
    watchTokenHash: row.watchTokenHash,
    status: row.status as GameDayStatus,
    weekendEventId: row.weekendEventId,
    version: row.version,
    players: row.players.map(toPlayer),
    cards: row.cards
      .map(toCard)
      .sort((left, right) => left.number - right.number),
    feed: row.feed.map(toFeed),
  };
}

function toPlayer(row: DayRow["players"][number]): PlayerRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    userId: row.userId,
    handicapIndex: decimalToNumber(row.handicapIndex),
    teeName: row.teeName,
    cardId: row.cardId,
    slot: row.slot,
    deviceTokenHash: row.deviceTokenHash,
    looksRight: row.looksRight,
    courseRating: decimalToNumber(row.courseRating),
    slopeRating: row.slopeRating,
    teePar: row.teePar,
    courseHandicap: row.courseHandicap,
    playingHandicap: row.playingHandicap,
  };
}

function toCard(row: DayRow["cards"][number]): CardRecord {
  return {
    id: row.id,
    number: row.number,
    golfRoundId: row.golfRoundId,
    scorerPlayerId: row.scorerPlayerId,
    status: row.status as CardStatus,
    holesPlayed: row.holesPlayed === 9 ? 9 : 18,
    startingHole: row.startingHole,
    course: asCourse(row.course),
    tees: asTees(row.tees),
    holes: row.holes
      .map(
        (hole): HoleRecord => ({
          id: hole.id,
          holeNumber: hole.holeNumber,
          strokes: asStrokes(hole.strokes),
          clientTimestamp: hole.clientTimestamp.toISOString(),
        }),
      )
      .sort((left, right) => left.holeNumber - right.holeNumber),
  };
}

function toFeed(row: DayRow["feed"][number]): FeedRecord {
  return {
    id: row.id,
    type: row.type as FeedType,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    payload: asPayload(row.payload),
  };
}

function asDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asCourse(value: Prisma.JsonValue): CourseCopy {
  const raw = asObject(value);
  const holes = Array.isArray(raw.holes) ? raw.holes : [];
  return {
    name: typeof raw.name === "string" ? raw.name : null,
    holes: holes.map((hole) => {
      const item = asObject(hole);
      return {
        number: Number(item.number),
        par: Number(item.par),
        strokeIndex: Number(item.strokeIndex),
      };
    }),
  };
}

function asTees(value: Prisma.JsonValue): TeeRating[] {
  if (!Array.isArray(value)) return [];
  return value.map((tee) => {
    const item = asObject(tee);
    return {
      name: typeof item.name === "string" ? item.name : "",
      courseRating: numberOrNull(item.courseRating),
      slopeRating: numberOrNull(item.slopeRating),
      teePar: numberOrNull(item.teePar),
    };
  });
}

function asStrokes(value: Prisma.JsonValue): Record<string, number> {
  const raw = asObject(value);
  const strokes: Record<string, number> = {};
  for (const [key, stroke] of Object.entries(raw)) {
    if (typeof stroke === "number") strokes[key] = stroke;
  }
  return strokes;
}

function asPayload(value: Prisma.JsonValue): Record<string, unknown> {
  return asObject(value);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapWriteError(error: unknown): Error {
  if (error instanceof GameDayHttpError || error instanceof InviteCodeCollisionError) {
    return error;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = String(error.meta?.target ?? "");
      if (target.includes("inviteCode") || target.includes("watchTokenHash")) {
        return new InviteCodeCollisionError();
      }
    }
    if (error.code === "P2003") {
      return new GameDayHttpError(404, "Venue not found");
    }
  }
  return wrap(error);
}

function wrap(error: unknown): Error {
  if (error instanceof GameDayPersistenceError) return error;
  return new GameDayPersistenceError("Unable to save game day", { cause: error });
}
