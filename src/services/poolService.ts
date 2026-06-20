import {
  FixtureStatus,
  PoolScoringRule,
  PrismaClient,
} from "../generated/prisma/client";
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
  userId: string;
  name: string;
  scoringRule?: PoolScoringRule;
  fixtureId?: string;
  fixture?: CreateFixtureParams;
};

type JoinPoolParams = {
  inviteCode: string;
  displayName: string;
  userId?: string;
};

type SubmitPredictionParams = {
  inviteCode: string;
  poolMemberId?: string;
  userId?: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
};

type SubmitFinalResultParams = {
  inviteCode: string;
  userId: string;
  homeScore: number;
  awayScore: number;
};

export class PoolNotFoundError extends Error {
  constructor() {
    super("Pool not found");
  }
}

export class PoolForbiddenError extends Error {
  constructor(message = "Only the pool creator can submit the final score") {
    super(message);
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

    const profile = await this.prisma.profile.findUnique({
      where: { userId: params.userId },
    });

    const hostDisplayName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim() || "Host"
      : "Host";

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
          createdByUserId: params.userId,
          scoringRule:
            params.scoringRule ??
            PoolScoringRule.EXACT_SCORE_THREE_CORRECT_RESULT_ONE,
        },
      });

      await tx.poolMember.create({
        data: {
          poolId: createdPool.id,
          userId: params.userId,
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

    const member = await this.resolvePoolMember(pool.id, params);
    if (!member) {
      throw new PoolMemberNotFoundError();
    }

    if (
      member.userId &&
      params.userId &&
      member.userId !== params.userId
    ) {
      throw new PoolForbiddenError(
        "You cannot submit a prediction for another member",
      );
    }

    return this.prisma.prediction.upsert({
      where: { poolMemberId: member.id },
      create: {
        poolId: pool.id,
        poolMemberId: member.id,
        predictedHomeScore: params.predictedHomeScore,
        predictedAwayScore: params.predictedAwayScore,
      },
      update: {
        predictedHomeScore: params.predictedHomeScore,
        predictedAwayScore: params.predictedAwayScore,
      },
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

    return {
      pool: {
        id: pool.id,
        name: pool.name,
        inviteCode: pool.inviteCode,
        scoringRule: pool.scoringRule,
      },
      fixture: pool.fixture,
      members: pool.members.map((member, index) => ({
        rank: index + 1,
        id: member.id,
        displayName: member.displayName,
        totalPoints: member.totalPoints,
        prediction: member.predictions[0]
          ? {
              predictedHomeScore: revealPredictions
                ? member.predictions[0].predictedHomeScore
                : null,
              predictedAwayScore: revealPredictions
                ? member.predictions[0].predictedAwayScore
                : null,
              pointsEarned: hasResults
                ? member.predictions[0].pointsEarned
                : null,
            }
          : null,
      })),
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

    if (pool.createdByUserId !== params.userId) {
      throw new PoolForbiddenError();
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
          resultSubmittedByUserId: params.userId,
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
            prediction.predictedHomeScore,
            prediction.predictedAwayScore,
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

  private async resolvePoolMember(
    poolId: string,
    params: SubmitPredictionParams,
  ) {
    if (params.poolMemberId) {
      return this.prisma.poolMember.findFirst({
        where: { id: params.poolMemberId, poolId },
      });
    }

    if (params.userId) {
      return this.prisma.poolMember.findUnique({
        where: {
          poolId_userId: { poolId, userId: params.userId },
        },
      });
    }

    return null;
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
      createdByUserId: string;
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
          predictedHomeScore: number;
          predictedAwayScore: number;
          pointsEarned: number | null;
        }>;
      }>;
    },
  ) {
    const revealPredictions = this.shouldRevealPredictions(pool.fixture);

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
        prediction: member.predictions[0]
          ? {
              predictedHomeScore: revealPredictions
                ? member.predictions[0].predictedHomeScore
                : null,
              predictedAwayScore: revealPredictions
                ? member.predictions[0].predictedAwayScore
                : null,
              pointsEarned: revealPredictions
                ? member.predictions[0].pointsEarned
                : null,
            }
          : null,
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
