import { PrismaClient } from "../../../generated/prisma/client";
import { CmsId } from "../../venue/entities/cms-id";
import { Match } from "../entities/match";
import { MatchLockConflictError } from "../entities/match-lock-conflict-error";
import { MatchScore } from "../entities/match-score";
import { Ruleset } from "../entities/ruleset";
import { StartsAt } from "../entities/starts-at";
import { Team } from "../entities/team";
import { PrismaMatchRepository } from "./prisma-match.repository";

type StoredMatch = {
  id: string;
  venueCmsId: string;
  startsAt: Date;
  ruleset: "golden_point" | "advantage";
  status: "live" | "locked";
  servingTeam: "A" | "B" | null;
  winnerTeam: "A" | "B" | null;
  lockedAt: Date | null;
  score: unknown;
  createdAt: Date;
};

type StoredPlayer = {
  id: string;
  matchId: string;
  slot: "A1" | "A2" | "B1" | "B2";
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

function createPrismaMap() {
  const matches = new Map<string, StoredMatch>();
  const players = new Map<string, StoredPlayer[]>();

  return {
    matches,
    players,
    match: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = matches.get(where.id);
        if (!row) {
          return null;
        }
        return { ...row, players: players.get(where.id) ?? [] };
      }),
      findMany: jest.fn(
        async ({
          where,
          orderBy,
        }: {
          where: {
            status: string;
            venueCmsId?: string;
            players?: { some: { userId: string } };
          };
          orderBy: { startsAt: "asc" | "desc" };
        }) => {
          let rows = [...matches.values()].filter((row) => row.status === where.status);
          if (where.venueCmsId) {
            rows = rows.filter((row) => row.venueCmsId === where.venueCmsId);
          }
          if (where.players?.some.userId) {
            const userId = where.players.some.userId;
            rows = rows.filter((row) =>
              (players.get(row.id) ?? []).some((player) => player.userId === userId),
            );
          }
          rows.sort((a, b) =>
            orderBy.startsAt === "desc"
              ? b.startsAt.getTime() - a.startsAt.getTime()
              : a.startsAt.getTime() - b.startsAt.getTime(),
          );
          return rows.map((row) => ({
            ...row,
            players: players.get(row.id) ?? [],
          }));
        },
      ),
      create: jest.fn(
        async ({
          data,
        }: {
          data: StoredMatch & {
            players: { create: Omit<StoredPlayer, "id" | "matchId">[] };
          };
        }) => {
          const { players: createPlayers, ...match } = data;
          matches.set(match.id, {
            ...match,
            createdAt: match.createdAt ?? new Date(),
          });
          players.set(
            match.id,
            createPlayers.create.map((player, index) => ({
              id: `p-${index}`,
              matchId: match.id,
              ...player,
            })),
          );
          return {
            ...matches.get(match.id)!,
            players: players.get(match.id) ?? [],
          };
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; status: string };
          data: Partial<StoredMatch>;
        }) => {
          const existing = matches.get(where.id);
          if (!existing || existing.status !== where.status) {
            return { count: 0 };
          }
          matches.set(where.id, { ...existing, ...data });
          return { count: 1 };
        },
      ),
    },
  };
}

function liveMatch(startsAt: string, userId?: string) {
  return Match.create({
    venueCmsId: CmsId.from("sanity-court-1"),
    startsAt: StartsAt.from(startsAt),
    ruleset: Ruleset.from("golden_point"),
    pairings: {
      teamA: [
        { displayName: "Alex", isGuest: true, userId: null },
        { displayName: "Sam", isGuest: true, userId: null },
      ],
      teamB: [
        { displayName: "Jordan", isGuest: true, userId: null },
        {
          displayName: "Riley",
          isGuest: !userId,
          userId: userId ?? null,
        },
      ],
    },
    servingTeam: Team.A,
  });
}

describe(PrismaMatchRepository, () => {
  test("create stores distinct rows by id and persistLock is idempotent", async () => {
    const prisma = createPrismaMap();
    const repository = new PrismaMatchRepository(
      prisma as unknown as PrismaClient,
    );

    const first = await repository.create(liveMatch("2026-08-01T10:00:00.000Z", "user-1"));
    const second = await repository.create(liveMatch("2026-08-20T10:00:00.000Z", "user-1"));

    expect(prisma.matches.size).toBe(2);
    expect(second.id).not.toBe(first.id);
    expect((await repository.findById(first.id))?.id).toBe(first.id);

    first.lock(
      MatchScore.from({
        sets: [{ gamesA: 6, gamesB: 4, winner: "A" }],
      }),
      Team.A,
    );
    const locked = await repository.persistLock(first);
    const again = await repository.persistLock(first);

    expect(locked.status).toBe("locked");
    expect(again.id).toBe(first.id);
    expect(prisma.matches.get(first.id)?.status).toBe("locked");

    const listed = await repository.listLockedByPlayerUserId("user-1");
    expect(listed.map((match) => match.id)).toEqual([first.id]);
  });

  test("persistLock conflicts when another result already won the race", async () => {
    const prisma = createPrismaMap();
    const repository = new PrismaMatchRepository(
      prisma as unknown as PrismaClient,
    );
    const match = await repository.create(liveMatch("2026-08-01T10:00:00.000Z"));
    const first = (await repository.findById(match.id))!;
    const second = (await repository.findById(match.id))!;

    first.lock(
      MatchScore.from({ sets: [{ gamesA: 6, gamesB: 4, winner: "A" }] }),
      Team.A,
    );
    second.lock(
      MatchScore.from({ sets: [{ gamesA: 4, gamesB: 6, winner: "B" }] }),
      Team.B,
    );

    await repository.persistLock(first);
    await expect(repository.persistLock(second)).rejects.toBeInstanceOf(
      MatchLockConflictError,
    );
  });
});
