import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { GolfPlayerInput } from "../../golf-round/entities/golf-player";
import { CreateGolfRound } from "../../golf-round/services/create-golf-round.service";
import { GetGolfRoundById } from "../../golf-round/services/get-golf-round-by-id.service";
import { defaultNineHoleCourse } from "../../organised-games/services/default-golf-course";
import { CmsId } from "../../venue/entities/cms-id";
import { VenueRepository } from "../../venue/repositories/venue.repository";
import { GolfTour } from "../entities/golf-tour";
import { GolfTourCampName } from "../entities/golf-tour-camp-name";
import { GolfTourFormat } from "../entities/golf-tour-format";
import {
  golfRoundPath,
  parseFourballPlayers,
} from "../entities/golf-tour-fourball";
import { GolfTourName } from "../entities/golf-tour-name";
import { GolfTourNotFoundError } from "../entities/golf-tour-not-found-error";
import { GolfTourFourballNotFoundError } from "../entities/golf-tour-fourball-not-found-error";
import { GolfTourVenueNotFoundError } from "../entities/golf-tour-venue-not-found-error";
import { TourDate } from "../entities/tour-date";
import { GolfTourRepository } from "../repositories/golf-tour.repository";
import {
  buildLeaderboard,
  PublicGolfTourLeaderboard,
} from "./leaderboard";

export type PublicGolfTourPlayer = {
  slot: 1 | 2 | 3 | 4;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

export type PublicGolfTourFourball = {
  id: string;
  roundId: string;
  campId: string;
  status: "pending" | "live" | "locked" | "cancelled";
  golfRoundId: string | null;
  path: string | null;
  players: PublicGolfTourPlayer[];
};

export type PublicGolfTourCamp = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
};

export type PublicGolfTourRound = {
  id: string;
  date: string;
  venueCmsId: string;
  label: string | null;
  format: "stroke";
};

export type PublicGolfTour = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "completed";
  hostUserId: string;
  viewer: { role: "host" | "player" };
  camps: PublicGolfTourCamp[];
  rounds: PublicGolfTourRound[];
  fourballs: PublicGolfTourFourball[];
  createdAt: string;
  updatedAt: string;
};

export type PublicGolfTourSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "completed";
  hostUserId: string;
  viewer: { role: "host" | "player" };
  campCount: number;
  roundCount: number;
  fourballCount: number;
  updatedAt: string;
};

function toPublicTour(tour: GolfTour, userId: string): PublicGolfTour {
  const snapshot = tour.toSnapshot();
  return {
    id: snapshot.id,
    name: snapshot.name,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    status: snapshot.status,
    hostUserId: snapshot.hostUserId,
    viewer: { role: tour.isHost(userId) ? "host" : "player" },
    camps: snapshot.camps,
    rounds: snapshot.rounds,
    fourballs: snapshot.fourballs.map((fourball) => ({
      id: fourball.id,
      roundId: fourball.roundId,
      campId: fourball.campId,
      status: fourball.status,
      golfRoundId: fourball.golfRoundId,
      path: fourball.golfRoundId ? golfRoundPath(fourball.golfRoundId) : null,
      players: fourball.players,
    })),
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function toPublicSummary(tour: GolfTour, userId: string): PublicGolfTourSummary {
  const snapshot = tour.toSnapshot();
  return {
    id: snapshot.id,
    name: snapshot.name,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    status: snapshot.status,
    hostUserId: snapshot.hostUserId,
    viewer: { role: tour.isHost(userId) ? "host" : "player" },
    campCount: snapshot.camps.length,
    roundCount: snapshot.rounds.length,
    fourballCount: snapshot.fourballs.length,
    updatedAt: snapshot.updatedAt,
  };
}

async function requireReadableTour(
  tours: GolfTourRepository,
  tourId: string,
  userId: string,
): Promise<GolfTour> {
  const tour = await tours.findById(tourId.trim());
  if (!tour || !tour.canRead(userId)) {
    throw new GolfTourNotFoundError();
  }
  return tour;
}

async function requireHostTour(
  tours: GolfTourRepository,
  tourId: string,
  userId: string,
): Promise<GolfTour> {
  const tour = await tours.findById(tourId.trim());
  if (!tour) throw new GolfTourNotFoundError();
  tour.assertHost(userId);
  return tour;
}

async function assertVenueExists(
  venues: VenueRepository,
  venueCmsId: CmsId,
): Promise<void> {
  const venue = await venues.findByCmsId(venueCmsId);
  if (!venue) throw new GolfTourVenueNotFoundError();
}

function parseOptionalCampNames(raw: unknown): GolfTourCampName[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new DomainError("campNames must be an array of names");
  }
  return raw.map((name) => GolfTourCampName.from(name));
}

export class CreateGolfTour {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: {
    userId: string;
    name: unknown;
    startDate: unknown;
    endDate: unknown;
    campNames?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = GolfTour.create({
      name: GolfTourName.from(input.name),
      startDate: TourDate.from(input.startDate, "startDate"),
      endDate: TourDate.from(input.endDate, "endDate"),
      hostUserId: userId,
      campNames: parseOptionalCampNames(input.campNames),
    });
    const saved = await this.tours.create(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export class GetGolfTour {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: { userId: string; tourId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireReadableTour(this.tours, input.tourId, userId);
    return { tour: toPublicTour(tour, userId) };
  }
}

export class UpdateGolfTour {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: {
    userId: string;
    tourId: string;
    name?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    tour.updateDetails(userId, {
      name: input.name === undefined ? undefined : GolfTourName.from(input.name),
      startDate:
        input.startDate === undefined
          ? undefined
          : TourDate.from(input.startDate, "startDate"),
      endDate:
        input.endDate === undefined
          ? undefined
          : TourDate.from(input.endDate, "endDate"),
    });
    const saved = await this.tours.persist(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export class CompleteGolfTour {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: { userId: string; tourId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    tour.complete(userId);
    const saved = await this.tours.persist(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export class ListMyGolfTours {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: { userId: string }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const [hosting, playing] = await Promise.all([
      this.tours.listForHost(userId),
      this.tours.listForPlayerUserId(userId),
    ]);
    const byId = new Map<string, GolfTour>();
    for (const tour of [...hosting, ...playing]) {
      byId.set(tour.id, tour);
    }
    const tours = [...byId.values()].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
    return { tours: tours.map((tour) => toPublicSummary(tour, userId)) };
  }
}

export class AddGolfTourCamp {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: {
    userId: string;
    tourId: string;
    name: unknown;
    color?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    tour.addCamp(userId, {
      name: GolfTourCampName.from(input.name),
      color: input.color as string | null | undefined,
    });
    const saved = await this.tours.persist(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export class UpdateGolfTourCamp {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: {
    userId: string;
    tourId: string;
    campId: string;
    name?: unknown;
    color?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    const details: { name?: GolfTourCampName; color?: string | null } = {};
    if (input.name !== undefined) details.name = GolfTourCampName.from(input.name);
    if ("color" in input) details.color = input.color as string | null;
    tour.renameCamp(userId, input.campId, details);
    const saved = await this.tours.persist(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export class AddGolfTourRound {
  constructor(
    private readonly tours: GolfTourRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(input: {
    userId: string;
    tourId: string;
    date: unknown;
    venueCmsId: unknown;
    label?: unknown;
    format?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const venueCmsId = CmsId.from(input.venueCmsId);
    await assertVenueExists(this.venues, venueCmsId);
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    tour.addRound(userId, {
      date: TourDate.from(input.date, "date"),
      venueCmsId,
      label: input.label as string | null | undefined,
      format: GolfTourFormat.from(input.format),
    });
    const saved = await this.tours.persist(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export class UpdateGolfTourRound {
  constructor(
    private readonly tours: GolfTourRepository,
    private readonly venues: VenueRepository,
  ) {}

  async execute(input: {
    userId: string;
    tourId: string;
    roundId: string;
    date?: unknown;
    venueCmsId?: unknown;
    label?: unknown;
    format?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    const details: {
      date?: TourDate;
      venueCmsId?: CmsId;
      label?: string | null;
      format?: GolfTourFormat;
    } = {};
    if (input.date !== undefined) {
      details.date = TourDate.from(input.date, "date");
    }
    if (input.venueCmsId !== undefined) {
      const venueCmsId = CmsId.from(input.venueCmsId);
      await assertVenueExists(this.venues, venueCmsId);
      details.venueCmsId = venueCmsId;
    }
    if ("label" in input) details.label = input.label as string | null;
    if (input.format !== undefined) details.format = GolfTourFormat.from(input.format);
    tour.updateRound(userId, input.roundId, details);
    const saved = await this.tours.persist(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export class AddGolfTourFourball {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: {
    userId: string;
    tourId: string;
    roundId: string;
    campId: unknown;
    players?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    const fourball = tour.addFourball(userId, {
      roundId: input.roundId,
      campId: requiredTrimmed(input.campId, "campId"),
      players: parseFourballPlayers(input.players),
    });
    const saved = await this.tours.persist(tour);
    return {
      tour: toPublicTour(saved, userId),
      fourball: toPublicTour(saved, userId).fourballs.find(
        (row) => row.id === fourball.id,
      )!,
    };
  }
}

export class UpdateGolfTourFourball {
  constructor(private readonly tours: GolfTourRepository) {}

  async execute(input: {
    userId: string;
    tourId: string;
    fourballId: string;
    players?: unknown;
    campId?: unknown;
    status?: unknown;
  }) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireHostTour(this.tours, input.tourId, userId);
    if (
      input.players === undefined &&
      input.campId === undefined &&
      input.status === undefined
    ) {
      throw new DomainError("At least one field is required");
    }
    if (input.players !== undefined) {
      tour.assignFourballPlayers(
        userId,
        input.fourballId,
        parseFourballPlayers(input.players),
      );
    }
    if (input.campId !== undefined) {
      tour.moveFourballCamp(
        userId,
        input.fourballId,
        requiredTrimmed(input.campId, "campId"),
      );
    }
    if (input.status !== undefined) {
      const status = requiredTrimmed(input.status, "status");
      if (status !== "cancelled") {
        throw new DomainError("status can only be set to cancelled");
      }
      tour.cancelFourball(userId, input.fourballId);
    }
    const saved = await this.tours.persist(tour);
    return { tour: toPublicTour(saved, userId) };
  }
}

export type StartGolfTourFourballInput = {
  userId: string;
  tourId: string;
  fourballId: string;
  teeName?: unknown;
  holesPlayed?: unknown;
  startingHole?: unknown;
  course?: unknown;
  players?: GolfPlayerInput[];
};

export class StartGolfTourFourball {
  constructor(
    private readonly tours: GolfTourRepository,
    private readonly createGolfRound: CreateGolfRound,
  ) {}

  async execute(input: StartGolfTourFourballInput) {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await this.tours.findById(input.tourId.trim());
    if (!tour || !tour.canRead(userId)) {
      throw new GolfTourNotFoundError();
    }
    const fourball = tour.fourballById(input.fourballId);
    if (!fourball) throw new GolfTourFourballNotFoundError();
    tour.assertCanStartFourball(userId, fourball);

    if (fourball.golfRoundId && (fourball.status.isLive || fourball.status.isLocked)) {
      return {
        tour: toPublicTour(tour, userId),
        fourball: toPublicTour(tour, userId).fourballs.find(
          (row) => row.id === fourball.id,
        )!,
        golfRoundId: fourball.golfRoundId,
        path: golfRoundPath(fourball.golfRoundId),
      };
    }

    const round = tour.roundById(fourball.roundId);
    if (!round) throw new GolfTourFourballNotFoundError();

    const players =
      input.players ??
      fourball.players.map((player) => player.toSnapshot());
    const holesPlayed = input.holesPlayed ?? 9;
    const course =
      input.course ??
      (holesPlayed === 9 ? defaultNineHoleCourse() : undefined);

    const golfRound = await this.createGolfRound.execute({
      venueCmsId: round.venueCmsId.value,
      startsAt: round.date.toStartsAtIso(),
      holesPlayed,
      startingHole: input.startingHole,
      teeName: input.teeName,
      course,
      players,
    });

    tour.startFourball(fourball.id, golfRound.id);
    const saved = await this.tours.persist(tour);
    const publicTour = toPublicTour(saved, userId);
    const publicFourball = publicTour.fourballs.find(
      (row) => row.id === fourball.id,
    )!;
    return {
      tour: publicTour,
      fourball: publicFourball,
      golfRoundId: golfRound.id,
      path: golfRoundPath(golfRound.id),
    };
  }
}

export class GetGolfTourLeaderboard {
  constructor(
    private readonly tours: GolfTourRepository,
    private readonly getGolfRound: GetGolfRoundById,
  ) {}

  async execute(input: {
    userId: string;
    tourId: string;
  }): Promise<{ leaderboard: PublicGolfTourLeaderboard }> {
    const userId = requiredTrimmed(input.userId, "userId");
    const tour = await requireReadableTour(this.tours, input.tourId, userId);
    const lockedRounds = new Map<
      string,
      NonNullable<Awaited<ReturnType<GetGolfRoundById["execute"]>>>
    >();
    for (const fourball of tour.fourballs) {
      if (!fourball.status.isLocked || !fourball.golfRoundId) continue;
      const round = await this.getGolfRound.execute(fourball.golfRoundId);
      if (round) lockedRounds.set(fourball.golfRoundId, round);
    }
    return { leaderboard: buildLeaderboard(tour, lockedRounds) };
  }
}
