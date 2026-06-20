import {
  FixtureStatus,
  PoolScoringRule,
  PredictionType,
  PredictionWinnerSide,
  PrismaClient,
} from "../generated/prisma/client";
import { formatPredictionForApi } from "../util/formatPrediction";
import { generateBookingCode } from "../util/generateBookingCode";
import { scorePrediction } from "../util/scorePrediction";

type CreateFixtureParams = {
  title: string;
  sport: string;
  homeTeamName: string;
  awayTeamName: string;
  matchDate: Date;
};

type CreatePoolParams = {
  hostDisplayName: string;
  name: string;
  scoringRule?: PoolScoringRule;
  fixtureId?: string;
  fixture?: CreateFixtureParams;
  userId?: string;
};

type JoinPoolParams = {
  inviteCode: string;
  displayName: string;
  userId?: string;
};

type SubmitExactScorePredictionParams = {
  inviteCode: string;
  poolMemberId: string;
  predictionType: "EXACT_SCORE";
  predictedHomeScore: number;
  predictedAwayScore: number;
};

type SubmitTotalScorePredictionParams = {
  inviteCode: string;
  poolMemberId: string;
  predictionType: "TOTAL_SCORE";
  predictedTotalScore: number;
};

type SubmitMarginPredictionParams = {
  inviteCode: string;
  poolMemberId: string;
  predictionType: "MARGIN";
  predictedWinnerSide: PredictionWinnerSide;
  predictedMargin?: number;
};

export type SubmitPredictionParams =
  | SubmitExactScorePredictionParams
  | SubmitTotalScorePredictionParams
  | SubmitMarginPredictionParams;

type SubmitFinalResultParams = {
  inviteCode: string;
  homeScore: number;
  awayScore: number;
};

export class PoolNotFoundError extends Error {
  constructor() {
    super("Pool not found");
  }
}

export class FixtureNotFoundError extends Error {
  constructor() {
    super("Fixture not found");
  }
}

export class PoolMemberNotFoundError extends Error {
  constructor() {
    super("Pool member not found");
  }
}

export class PoolPredictionClosedError extends Error {
  constructor() {
    super("Predictions are closed for this match");
  }
}

export class PoolInvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class PoolService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createPool(params: CreatePoolParams) {
    if (!params.fixtureId && !params.fixture) {
      throw new PoolInvalidRequestError("fixtureId or fixture is required");
    }

    if (params.fixtureId && params.fixture) {
      throw new PoolInvalidRequestError(
        "Provide either fixtureId or fixture, not both",
      );
    }

    const profile = params.userId
      ? await this.prisma.profile.findUnique({
          where: { userId: params.userId },
        })
      : null;

    const hostDisplayName =
      params.hostDisplayName.trim() ||
      (profile
        ? `${profile.firstName} ${profile.lastName}`.trim() || "Host"
        : "Host");

    const inviteCode = await this.generateUniqueInviteCode();

    const pool = await this.prisma.$transaction(async (tx) => {
      let fixtureId = params.fixtureId;

      if (params.fixture) {
        const fixture = await tx.fixture.create({
          data: params.fixture,
        });
        fixtureId = fixture.id;
      } else if (fixtureId) {
        const fixture = await tx.fixture.findUnique({
          where: { id: fixtureId },
        });
        if (!fixture) {
          throw new FixtureNotFoundError();
        }
      }

      const createdPool = await tx.pool.create({
        data: {
          name: params.name,
          inviteCode,
          fixtureId: fixtureId!,
          createdByUserId: params.userId ?? null,
          scoringRule:
            params.scoringRule ??
            PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE,
        },
      });

      await tx.poolMember.create({
        data: {
          poolId: createdPool.id,
          userId: params.userId ?? null,
          displayName: hostDisplayName,
        },
      });

      return createdPool;
    });

    return this.getPoolByInviteCode(pool.inviteCode);
  }

  async getPoolByInviteCode(inviteCode: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { inviteCode },
      include: {
        fixture: true,
        members: {
          orderBy: { joinedAt: "asc" },
          include: { predictions: true },
        },
      },
    });

    if (!pool) {
      throw new PoolNotFoundError();
    }

    return this.formatPoolResponse(pool);
  }

  async joinPool(params: JoinPoolParams) {
    const pool = await this.prisma.pool.findUnique({
      where: { inviteCode: params.inviteCode },
    });

    if (!pool) {
      throw new PoolNotFoundError();
    }

    if (params.userId) {
      const existingMember = await this.prisma.poolMember.findUnique({
        where: {
          poolId_userId: { poolId: pool.id, userId: params.userId },
        },
        include: { predictions: true },
      });

      if (existingMember) {
        return existingMember;
      }
    }

    return this.prisma.poolMember.create({
      data: {
        poolId: pool.id,
        userId: params.userId,
        displayName: params.displayName,
      },
      include: { predictions: true },
    });
  }

  async submitPrediction(params: SubmitPredictionParams) {
    const pool = await this.prisma.pool.findUnique({
      where: { inviteCode: params.inviteCode },
      include: { fixture: true },
    });

    if (!pool) {
      throw new PoolNotFoundError();
    }

    if (!this.isPredictionOpen(pool.fixture)) {
      throw new PoolPredictionClosedError();
    }

    const member = await this.prisma.poolMember.findFirst({
      where: { id: params.poolMemberId, poolId: pool.id },
    });
    if (!member) {
      throw new PoolMemberNotFoundError();
    }

    const predictionData = this.buildPredictionData(params);

    return this.prisma.prediction.upsert({
      where: { poolMemberId: member.id },
      create: {
        poolId: pool.id,
        poolMemberId: member.id,
        ...predictionData,
      },
      update: predictionData,
    });
  }

  async getLeaderboard(inviteCode: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { inviteCode },
      include: {
        fixture: true,
        members: {
          orderBy: [{ totalPoints: "desc" }, { joinedAt: "asc" }],
          include: { predictions: true },
        },
      },
    });

    if (!pool) {
      throw new PoolNotFoundError();
    }

    const revealPredictions = this.shouldRevealPredictions(pool.fixture);
    const hasResults = pool.fixture.status === FixtureStatus.FINISHED;
    const fixtureTeams = {
      homeTeamName: pool.fixture.homeTeamName,
      awayTeamName: pool.fixture.awayTeamName,
    };

    return {
      pool: {
        id: pool.id,
        name: pool.name,
        inviteCode: pool.inviteCode,
        scoringRule: pool.scoringRule,
      },
      fixture: pool.fixture,
      members: pool.members.map((member, index) => {
        const prediction = member.predictions[0];
        const formatted = formatPredictionForApi(
          prediction,
          fixtureTeams,
          revealPredictions,
        );

        return {
          rank: index + 1,
          id: member.id,
          displayName: member.displayName,
          totalPoints: member.totalPoints,
          prediction: formatted
            ? {
                ...formatted,
                pointsEarned: hasResults ? formatted.pointsEarned : null,
              }
            : null,
        };
      }),
      winner: hasResults ? this.getWinners(pool.members) : [],
    };
  }

  async submitFinalResult(params: SubmitFinalResultParams) {
    const pool = await this.prisma.pool.findUnique({
      where: { inviteCode: params.inviteCode },
      include: { fixture: true },
    });

    if (!pool) {
      throw new PoolNotFoundError();
    }

    const fixtureId = pool.fixtureId;
    const { homeScore, awayScore } = params;

    await this.prisma.$transaction(async (tx) => {
      await tx.fixture.update({
        where: { id: fixtureId },
        data: {
          homeScore,
          awayScore,
          status: FixtureStatus.FINISHED,
          resultSubmittedAt: new Date(),
        },
      });

      const poolsOnFixture = await tx.pool.findMany({
        where: { fixtureId },
        include: { predictions: true },
      });

      for (const poolOnFixture of poolsOnFixture) {
        await tx.poolMember.updateMany({
          where: { poolId: poolOnFixture.id },
          data: { totalPoints: 0 },
        });

        for (const prediction of poolOnFixture.predictions) {
          const points = scorePrediction(
            prediction,
            homeScore,
            awayScore,
            poolOnFixture.scoringRule,
          );

          await tx.prediction.update({
            where: { id: prediction.id },
            data: { pointsEarned: points },
          });

          await tx.poolMember.update({
            where: { id: prediction.poolMemberId },
            data: { totalPoints: { increment: points } },
          });
        }
      }
    });

    return this.getLeaderboard(params.inviteCode);
  }

  private buildPredictionData(params: SubmitPredictionParams) {
    switch (params.predictionType) {
      case PredictionType.EXACT_SCORE:
        return {
          predictionType: PredictionType.EXACT_SCORE,
          predictedHomeScore: params.predictedHomeScore,
          predictedAwayScore: params.predictedAwayScore,
          predictedTotalScore: null,
          predictedWinnerSide: null,
          predictedMargin: null,
        };
      case PredictionType.TOTAL_SCORE:
        return {
          predictionType: PredictionType.TOTAL_SCORE,
          predictedHomeScore: null,
          predictedAwayScore: null,
          predictedTotalScore: params.predictedTotalScore,
          predictedWinnerSide: null,
          predictedMargin: null,
        };
      case PredictionType.MARGIN:
        if (params.predictedWinnerSide === PredictionWinnerSide.DRAW) {
          return {
            predictionType: PredictionType.MARGIN,
            predictedHomeScore: null,
            predictedAwayScore: null,
            predictedTotalScore: null,
            predictedWinnerSide: PredictionWinnerSide.DRAW,
            predictedMargin: 0,
          };
        }

        if (params.predictedMargin === undefined) {
          throw new PoolInvalidRequestError(
            "predictedMargin is required for home or away margin predictions",
          );
        }

        return {
          predictionType: PredictionType.MARGIN,
          predictedHomeScore: null,
          predictedAwayScore: null,
          predictedTotalScore: null,
          predictedWinnerSide: params.predictedWinnerSide,
          predictedMargin: params.predictedMargin,
        };
      default:
        throw new PoolInvalidRequestError("Invalid prediction type");
    }
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const inviteCode = generateBookingCode();
      const existing = await this.prisma.pool.findUnique({
        where: { inviteCode },
      });
      if (!existing) {
        return inviteCode;
      }
    }

    throw new Error("Failed to generate a unique invite code");
  }

  private isPredictionOpen(fixture: {
    status: FixtureStatus;
    matchDate: Date;
  }): boolean {
    return (
      fixture.status === FixtureStatus.SCHEDULED &&
      fixture.matchDate > new Date()
    );
  }

  private shouldRevealPredictions(fixture: {
    status: FixtureStatus;
    matchDate: Date;
  }): boolean {
    return (
      fixture.status !== FixtureStatus.SCHEDULED ||
      fixture.matchDate <= new Date()
    );
  }

  private formatPoolResponse(
    pool: {
      id: string;
      name: string;
      inviteCode: string;
      scoringRule: PoolScoringRule;
      createdAt: Date;
      createdByUserId: string | null;
      fixture: {
        id: string;
        title: string;
        sport: string;
        homeTeamName: string;
        awayTeamName: string;
        homeScore: number | null;
        awayScore: number | null;
        matchDate: Date;
        status: FixtureStatus;
        resultSubmittedAt: Date | null;
      };
      members: Array<{
        id: string;
        displayName: string;
        totalPoints: number;
        joinedAt: Date;
        userId: string | null;
        predictions: Array<{
          predictionType: PredictionType;
          predictedHomeScore: number | null;
          predictedAwayScore: number | null;
          predictedTotalScore: number | null;
          predictedWinnerSide: PredictionWinnerSide | null;
          predictedMargin: number | null;
          pointsEarned: number | null;
        }>;
      }>;
    },
  ) {
    const revealPredictions = this.shouldRevealPredictions(pool.fixture);
    const fixtureTeams = {
      homeTeamName: pool.fixture.homeTeamName,
      awayTeamName: pool.fixture.awayTeamName,
    };

    return {
      id: pool.id,
      name: pool.name,
      inviteCode: pool.inviteCode,
      scoringRule: pool.scoringRule,
      createdAt: pool.createdAt,
      createdByUserId: pool.createdByUserId,
      fixture: pool.fixture,
      memberCount: pool.members.length,
      members: pool.members.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        totalPoints: member.totalPoints,
        joinedAt: member.joinedAt,
        isGuest: member.userId === null,
        prediction: formatPredictionForApi(
          member.predictions[0],
          fixtureTeams,
          revealPredictions,
        ),
      })),
      predictionsOpen: this.isPredictionOpen(pool.fixture),
    };
  }

  private getWinners(
    members: Array<{
      id: string;
      displayName: string;
      totalPoints: number;
    }>,
  ) {
    if (members.length === 0) {
      return [];
    }

    const topScore = members[0].totalPoints;
    return members
      .filter((member) => member.totalPoints === topScore)
      .map((member) => ({
        id: member.id,
        displayName: member.displayName,
        totalPoints: member.totalPoints,
      }));
  }
}
