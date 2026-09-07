import { PrismaClient } from "../../../generated/prisma/client";
import { TeamSport } from "../../teams/entities/team-sport";
import { OptionalStartsAt } from "../entities/optional-starts-at";
import { OptionalVenueCmsId } from "../entities/optional-venue-cms-id";
import { TeamMatch } from "../entities/team-match";
import { TeamMatchChallengeToken } from "../entities/team-match-challenge-token";
import { TeamMatchLineup } from "../entities/team-match-lineup";
import { TeamMatchPersistenceError } from "../entities/team-match-persistence-error";
import { TeamMatchScorecard } from "../entities/team-match-scorecard";
import { TeamMatchStatus } from "../entities/team-match-status";
import { TeamMatchRepository } from "./team-match.repository";

type LineupRow = {
  teamId: string;
  userId: string;
  slot: number;
};

type TeamMatchRow = {
  id: string;
  homeTeamId: string;
  awayTeamId: string | null;
  sport: "padel" | "golf" | "darts";
  status:
    | "pending"
    | "scheduled"
    | "live"
    | "completed"
    | "declined"
    | "cancelled";
  venueCmsId: string | null;
  startsAt: Date | null;
  challengeToken: string | null;
  createdBy: string;
  winnerTeamId: string | null;
  scorecardSport: string | null;
  scorecardId: string | null;
  scorecardPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineups: LineupRow[];
};

function toDomain(row: TeamMatchRow): TeamMatch {
  const byTeam = new Map<string, string[]>();
  const ordered = [...row.lineups].sort((a, b) => a.slot - b.slot);
  for (const lineup of ordered) {
    const ids = byTeam.get(lineup.teamId) ?? [];
    ids.push(lineup.userId);
    byTeam.set(lineup.teamId, ids);
  }

  return TeamMatch.rehydrate({
    id: row.id,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    sport: TeamSport.from(row.sport),
    status: TeamMatchStatus.from(row.status),
    venueCmsId: OptionalVenueCmsId.from(row.venueCmsId),
    startsAt: OptionalStartsAt.from(row.startsAt),
    challengeToken: row.challengeToken
      ? TeamMatchChallengeToken.from(row.challengeToken)
      : null,
    createdBy: row.createdBy,
    winnerTeamId: row.winnerTeamId,
    scorecard:
      row.scorecardId && row.scorecardSport && row.scorecardPath
        ? TeamMatchScorecard.rehydrate({
            sport: row.scorecardSport as "padel" | "golf" | "darts",
            id: row.scorecardId,
            path: row.scorecardPath,
          })
        : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lineups: [...byTeam.entries()].map(([teamId, userIds]) =>
      TeamMatchLineup.rehydrate(teamId, userIds),
    ),
  });
}

const includeRelations = {
  lineups: { orderBy: { slot: "asc" as const } },
};

export class PrismaTeamMatchRepository implements TeamMatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<TeamMatch | null> {
    try {
      const row = await this.prisma.teamMatch.findUnique({
        where: { id },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new TeamMatchPersistenceError("Failed to load team match", {
        cause: error,
      });
    }
  }

  async findByChallengeToken(token: string): Promise<TeamMatch | null> {
    try {
      const row = await this.prisma.teamMatch.findUnique({
        where: { challengeToken: token.trim().toLowerCase() },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new TeamMatchPersistenceError("Failed to load team match", {
        cause: error,
      });
    }
  }

  async findByScorecardId(scorecardId: string): Promise<TeamMatch | null> {
    try {
      const row = await this.prisma.teamMatch.findFirst({
        where: { scorecardId: scorecardId.trim() },
        include: includeRelations,
      });
      return row ? toDomain(row) : null;
    } catch (error) {
      throw new TeamMatchPersistenceError("Failed to load team match", {
        cause: error,
      });
    }
  }

  async create(match: TeamMatch): Promise<TeamMatch> {
    const snapshot = match.toSnapshot();
    try {
      const row = await this.prisma.teamMatch.create({
        data: {
          id: snapshot.id,
          homeTeamId: snapshot.homeTeamId,
          awayTeamId: snapshot.awayTeamId,
          sport: snapshot.sport,
          status: snapshot.status,
          venueCmsId: snapshot.venueCmsId,
          startsAt: match.startsAt,
          challengeToken: snapshot.challengeToken,
          createdBy: snapshot.createdBy,
          winnerTeamId: snapshot.winnerTeamId,
          scorecardSport: snapshot.scorecard?.sport ?? null,
          scorecardId: snapshot.scorecard?.id ?? null,
          scorecardPath: snapshot.scorecard?.path ?? null,
          createdAt: match.createdAt,
          updatedAt: match.updatedAt,
          lineups: { create: lineupRows(snapshot) },
        },
        include: includeRelations,
      });
      return toDomain(row);
    } catch (error) {
      throw new TeamMatchPersistenceError("Failed to create team match", {
        cause: error,
      });
    }
  }

  async persist(match: TeamMatch): Promise<TeamMatch> {
    const snapshot = match.toSnapshot();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.teamMatch.update({
          where: { id: snapshot.id },
          data: {
            awayTeamId: snapshot.awayTeamId,
            status: snapshot.status,
            venueCmsId: snapshot.venueCmsId,
            startsAt: match.startsAt,
            challengeToken: snapshot.challengeToken,
            winnerTeamId: snapshot.winnerTeamId,
            scorecardSport: snapshot.scorecard?.sport ?? null,
            scorecardId: snapshot.scorecard?.id ?? null,
            scorecardPath: snapshot.scorecard?.path ?? null,
            updatedAt: match.updatedAt,
          },
        });
        await tx.teamMatchLineup.deleteMany({
          where: { teamMatchId: snapshot.id },
        });
        if (snapshot.lineups.some((lineup) => lineup.userIds.length > 0)) {
          await tx.teamMatchLineup.createMany({
            data: lineupRows(snapshot),
          });
        }
      });

      const reloaded = await this.findById(snapshot.id);
      if (!reloaded) {
        throw new TeamMatchPersistenceError("Failed to load team match");
      }
      return reloaded;
    } catch (error) {
      if (error instanceof TeamMatchPersistenceError) throw error;
      throw new TeamMatchPersistenceError("Failed to save team match", {
        cause: error,
      });
    }
  }

  async listForTeams(teamIds: string[]): Promise<TeamMatch[]> {
    if (teamIds.length === 0) return [];
    try {
      const rows = await this.prisma.teamMatch.findMany({
        where: {
          OR: [
            { homeTeamId: { in: teamIds } },
            { awayTeamId: { in: teamIds } },
          ],
        },
        include: includeRelations,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(toDomain);
    } catch (error) {
      throw new TeamMatchPersistenceError("Failed to list team matches", {
        cause: error,
      });
    }
  }
}

function lineupRows(snapshot: ReturnType<TeamMatch["toSnapshot"]>) {
  const rows: Array<{
    teamMatchId: string;
    teamId: string;
    userId: string;
    slot: number;
  }> = [];
  for (const lineup of snapshot.lineups) {
    lineup.userIds.forEach((userId, index) => {
      rows.push({
        teamMatchId: snapshot.id,
        teamId: lineup.teamId,
        userId,
        slot: index + 1,
      });
    });
  }
  return rows;
}
