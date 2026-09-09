import { PrismaClient } from "../../../generated/prisma/client";
import { Area } from "../entities/area";
import { City } from "../entities/city";
import { LobbyLooking } from "../entities/lobby-looking";
import { LobbyOpenGame } from "../entities/lobby-open-game";
import { LobbyOpenGameMember } from "../entities/lobby-open-game-member";
import { LobbyOpenGameStatus } from "../entities/lobby-open-game-status";
import { LobbyPersistenceError } from "../entities/lobby-persistence-error";
import { LobbyProposal } from "../entities/lobby-proposal";
import { LobbyProposalMember } from "../entities/lobby-proposal-member";
import { LobbyProposalResponse } from "../entities/lobby-proposal-response";
import { LobbyProposalStatus } from "../entities/lobby-proposal-status";
import { LobbySkill } from "../entities/lobby-skill";
import { LobbySport } from "../entities/lobby-sport";
import { PartySize } from "../entities/party-size";
import { TimeWindow } from "../entities/time-window";
import { LobbyListFilters, LobbyRepository } from "./lobby.repository";

type LookingRow = {
  id: string;
  userId: string;
  sport: "padel" | "darts" | "golf";
  windowStart: Date;
  windowEnd: Date;
  city: string;
  area: string | null;
  venueCmsId: string | null;
  partySize: number;
  skill: "casual" | "intermediate" | "competitive" | null;
  expiresAt: Date;
  createdAt: Date;
};

type OpenGameMemberRow = {
  id: string;
  userId: string;
  partySize: number;
  createdAt: Date;
};

type OpenGameRow = {
  id: string;
  hostUserId: string;
  sport: "padel" | "darts" | "golf";
  windowStart: Date;
  windowEnd: Date;
  city: string;
  area: string | null;
  venueCmsId: string | null;
  slotsNeeded: number;
  slotsFilled: number;
  skill: "casual" | "intermediate" | "competitive" | null;
  status: "open" | "filled" | "cancelled" | "expired";
  organiseGameId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: OpenGameMemberRow[];
};

type ProposalMemberRow = {
  id: string;
  userId: string;
  partySize: number;
  response: "pending" | "accept" | "pass";
  lookingId: string | null;
  createdAt: Date;
  respondedAt: Date | null;
};

type ProposalRow = {
  id: string;
  sport: "padel" | "darts" | "golf";
  city: string;
  area: string | null;
  windowStart: Date;
  windowEnd: Date;
  venueCmsId: string | null;
  skill: "casual" | "intermediate" | "competitive" | null;
  status: "pending" | "accepted" | "expired" | "cancelled";
  organiseGameId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: ProposalMemberRow[];
};

export class PrismaLobbyRepository implements LobbyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findLookingByUserId(userId: string): Promise<LobbyLooking | null> {
    try {
      const row = await this.prisma.lobbyLooking.findUnique({
        where: { userId: userId.trim() },
      });
      return row ? toLooking(row) : null;
    } catch (error) {
      throw new LobbyPersistenceError("Failed to load looking", { cause: error });
    }
  }

  async findLookingById(id: string): Promise<LobbyLooking | null> {
    try {
      const row = await this.prisma.lobbyLooking.findUnique({ where: { id } });
      return row ? toLooking(row) : null;
    } catch (error) {
      throw new LobbyPersistenceError("Failed to load looking", { cause: error });
    }
  }

  async upsertLooking(looking: LobbyLooking): Promise<LobbyLooking> {
    const snapshot = looking.toSnapshot();
    try {
      const row = await this.prisma.lobbyLooking.upsert({
        where: { userId: snapshot.userId },
        create: lookingWrite(looking),
        update: {
          id: snapshot.id,
          sport: snapshot.sport,
          windowStart: looking.window.start,
          windowEnd: looking.window.end,
          city: snapshot.city,
          area: snapshot.area,
          venueCmsId: snapshot.venueCmsId,
          partySize: snapshot.partySize,
          skill: snapshot.skill,
          expiresAt: looking.expiresAt,
          createdAt: looking.createdAt,
        },
      });
      return toLooking(row);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to save looking", { cause: error });
    }
  }

  async deleteLookingByUserId(userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.lobbyLooking.deleteMany({
        where: { userId: userId.trim() },
      });
      return result.count > 0;
    } catch (error) {
      throw new LobbyPersistenceError("Failed to delete looking", {
        cause: error,
      });
    }
  }

  async listActiveLookings(filters: LobbyListFilters): Promise<LobbyLooking[]> {
    const now = filters.now ?? new Date();
    try {
      const rows = await this.prisma.lobbyLooking.findMany({
        where: {
          expiresAt: { gt: now },
          ...(filters.sport ? { sport: filters.sport } : {}),
          ...(filters.city
            ? { city: { equals: filters.city.trim(), mode: "insensitive" } }
            : {}),
        },
        orderBy: { windowStart: "asc" },
      });
      return rows.map(toLooking);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to list lookings", {
        cause: error,
      });
    }
  }

  async findOpenGameById(id: string): Promise<LobbyOpenGame | null> {
    try {
      const row = await this.prisma.lobbyOpenGame.findUnique({
        where: { id },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return row ? toOpenGame(row) : null;
    } catch (error) {
      throw new LobbyPersistenceError("Failed to load open game", {
        cause: error,
      });
    }
  }

  async createOpenGame(game: LobbyOpenGame): Promise<LobbyOpenGame> {
    const snapshot = game.toSnapshot();
    try {
      const row = await this.prisma.lobbyOpenGame.create({
        data: {
          id: snapshot.id,
          hostUserId: snapshot.hostUserId,
          sport: snapshot.sport,
          windowStart: game.window.start,
          windowEnd: game.window.end,
          city: snapshot.city,
          area: snapshot.area,
          venueCmsId: snapshot.venueCmsId,
          slotsNeeded: snapshot.slotsNeeded,
          slotsFilled: snapshot.slotsFilled,
          skill: snapshot.skill,
          status: snapshot.status,
          organiseGameId: snapshot.organiseGameId,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
          members: {
            create: snapshot.members.map((member) => ({
              id: member.id,
              userId: member.userId,
              partySize: member.partySize,
              createdAt: new Date(member.createdAt),
            })),
          },
        },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return toOpenGame(row);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to create open game", {
        cause: error,
      });
    }
  }

  async persistOpenGame(game: LobbyOpenGame): Promise<LobbyOpenGame> {
    const snapshot = game.toSnapshot();
    try {
      const row = await this.prisma.lobbyOpenGame.update({
        where: { id: snapshot.id },
        data: {
          slotsFilled: snapshot.slotsFilled,
          status: snapshot.status,
          organiseGameId: snapshot.organiseGameId,
          updatedAt: game.updatedAt,
          members: {
            deleteMany: {},
            create: snapshot.members.map((member) => ({
              id: member.id,
              userId: member.userId,
              partySize: member.partySize,
              createdAt: new Date(member.createdAt),
            })),
          },
        },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return toOpenGame(row);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to save open game", {
        cause: error,
      });
    }
  }

  async listActiveOpenGames(filters: LobbyListFilters): Promise<LobbyOpenGame[]> {
    const now = filters.now ?? new Date();
    try {
      const rows = await this.prisma.lobbyOpenGame.findMany({
        where: {
          status: "open",
          windowEnd: { gt: now },
          ...(filters.sport ? { sport: filters.sport } : {}),
          ...(filters.city
            ? { city: { equals: filters.city.trim(), mode: "insensitive" } }
            : {}),
        },
        include: { members: { orderBy: { createdAt: "asc" } } },
        orderBy: { windowStart: "asc" },
      });
      return rows.map(toOpenGame);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to list open games", {
        cause: error,
      });
    }
  }

  async listOpenGamesForUser(userId: string): Promise<LobbyOpenGame[]> {
    try {
      const rows = await this.prisma.lobbyOpenGame.findMany({
        where: { members: { some: { userId: userId.trim() } } },
        include: { members: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toOpenGame);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to list open games", {
        cause: error,
      });
    }
  }

  async findProposalById(id: string): Promise<LobbyProposal | null> {
    try {
      const row = await this.prisma.lobbyProposal.findUnique({
        where: { id },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return row ? toProposal(row) : null;
    } catch (error) {
      throw new LobbyPersistenceError("Failed to load proposal", {
        cause: error,
      });
    }
  }

  async createProposal(proposal: LobbyProposal): Promise<LobbyProposal> {
    const snapshot = proposal.toSnapshot();
    try {
      const row = await this.prisma.lobbyProposal.create({
        data: {
          id: snapshot.id,
          sport: snapshot.sport,
          city: snapshot.city,
          area: snapshot.area,
          windowStart: proposal.window.start,
          windowEnd: proposal.window.end,
          venueCmsId: snapshot.venueCmsId,
          skill: snapshot.skill,
          status: snapshot.status,
          organiseGameId: snapshot.organiseGameId,
          createdAt: proposal.createdAt,
          updatedAt: proposal.updatedAt,
          members: {
            create: snapshot.members.map((member) => ({
              id: member.id,
              userId: member.userId,
              partySize: member.partySize,
              response: member.response,
              lookingId: member.lookingId,
              createdAt: new Date(member.createdAt),
              respondedAt: member.respondedAt
                ? new Date(member.respondedAt)
                : null,
            })),
          },
        },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return toProposal(row);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to create proposal", {
        cause: error,
      });
    }
  }

  async persistProposal(proposal: LobbyProposal): Promise<LobbyProposal> {
    const snapshot = proposal.toSnapshot();
    try {
      const row = await this.prisma.lobbyProposal.update({
        where: { id: snapshot.id },
        data: {
          status: snapshot.status,
          organiseGameId: snapshot.organiseGameId,
          updatedAt: proposal.updatedAt,
          members: {
            deleteMany: {},
            create: snapshot.members.map((member) => ({
              id: member.id,
              userId: member.userId,
              partySize: member.partySize,
              response: member.response,
              lookingId: member.lookingId,
              createdAt: new Date(member.createdAt),
              respondedAt: member.respondedAt
                ? new Date(member.respondedAt)
                : null,
            })),
          },
        },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return toProposal(row);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to save proposal", {
        cause: error,
      });
    }
  }

  async listProposalsForUser(userId: string): Promise<LobbyProposal[]> {
    try {
      const rows = await this.prisma.lobbyProposal.findMany({
        where: { members: { some: { userId: userId.trim() } } },
        include: { members: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toProposal);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to list proposals", {
        cause: error,
      });
    }
  }

  async listPendingProposals(filters: LobbyListFilters): Promise<LobbyProposal[]> {
    const now = filters.now ?? new Date();
    try {
      const rows = await this.prisma.lobbyProposal.findMany({
        where: {
          status: "pending",
          windowEnd: { gt: now },
          ...(filters.sport ? { sport: filters.sport } : {}),
          ...(filters.city
            ? { city: { equals: filters.city.trim(), mode: "insensitive" } }
            : {}),
        },
        include: { members: { orderBy: { createdAt: "asc" } } },
      });
      return rows.map(toProposal);
    } catch (error) {
      throw new LobbyPersistenceError("Failed to list proposals", {
        cause: error,
      });
    }
  }
}

function lookingWrite(looking: LobbyLooking) {
  const snapshot = looking.toSnapshot();
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    sport: snapshot.sport,
    windowStart: looking.window.start,
    windowEnd: looking.window.end,
    city: snapshot.city,
    area: snapshot.area,
    venueCmsId: snapshot.venueCmsId,
    partySize: snapshot.partySize,
    skill: snapshot.skill,
    expiresAt: looking.expiresAt,
    createdAt: looking.createdAt,
  };
}

function toLooking(row: LookingRow): LobbyLooking {
  return LobbyLooking.rehydrate({
    id: row.id,
    userId: row.userId,
    sport: LobbySport.from(row.sport),
    window: TimeWindow.from(row.windowStart, row.windowEnd),
    city: City.from(row.city),
    area: Area.from(row.area),
    venueCmsId: row.venueCmsId,
    partySize: PartySize.from(row.partySize),
    skill: LobbySkill.from(row.skill),
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  });
}

function toOpenGame(row: OpenGameRow): LobbyOpenGame {
  return LobbyOpenGame.rehydrate({
    id: row.id,
    hostUserId: row.hostUserId,
    sport: LobbySport.from(row.sport),
    window: TimeWindow.from(row.windowStart, row.windowEnd),
    city: City.from(row.city),
    area: Area.from(row.area),
    venueCmsId: row.venueCmsId,
    slotsNeeded: row.slotsNeeded,
    skill: LobbySkill.from(row.skill),
    status: LobbyOpenGameStatus.from(row.status),
    organiseGameId: row.organiseGameId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    members: row.members.map((member) =>
      LobbyOpenGameMember.rehydrate({
        id: member.id,
        userId: member.userId,
        partySize: PartySize.from(member.partySize),
        createdAt: member.createdAt,
      }),
    ),
  });
}

function toProposal(row: ProposalRow): LobbyProposal {
  return LobbyProposal.rehydrate({
    id: row.id,
    sport: LobbySport.from(row.sport),
    city: City.from(row.city),
    area: Area.from(row.area),
    window: TimeWindow.from(row.windowStart, row.windowEnd),
    venueCmsId: row.venueCmsId,
    skill: LobbySkill.from(row.skill),
    status: LobbyProposalStatus.from(row.status),
    organiseGameId: row.organiseGameId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    members: row.members.map((member) =>
      LobbyProposalMember.rehydrate({
        id: member.id,
        userId: member.userId,
        partySize: PartySize.from(member.partySize),
        response: LobbyProposalResponse.from(member.response),
        lookingId: member.lookingId,
        createdAt: member.createdAt,
        respondedAt: member.respondedAt,
      }),
    ),
  });
}
