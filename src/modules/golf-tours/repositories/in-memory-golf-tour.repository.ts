import { GolfTour } from "../entities/golf-tour";
import { GolfTourPersistenceError } from "../entities/golf-tour-persistence-error";
import { GolfTourRepository } from "./golf-tour.repository";

export class InMemoryGolfTourRepository implements GolfTourRepository {
  private readonly byId = new Map<string, GolfTour>();

  async findById(id: string): Promise<GolfTour | null> {
    return clone(this.byId.get(id) ?? null);
  }

  async findByGolfRoundId(golfRoundId: string): Promise<GolfTour | null> {
    const id = golfRoundId.trim();
    for (const tour of this.byId.values()) {
      if (tour.fourballByGolfRoundId(id)) {
        return clone(tour);
      }
    }
    return null;
  }

  async create(tour: GolfTour): Promise<GolfTour> {
    const stored = clone(tour)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async persist(tour: GolfTour): Promise<GolfTour> {
    if (!this.byId.has(tour.id)) {
      throw new GolfTourPersistenceError("Unable to save golf tour");
    }
    const stored = clone(tour)!;
    this.byId.set(stored.id, stored);
    return clone(stored)!;
  }

  async listForHost(userId: string): Promise<GolfTour[]> {
    return [...this.byId.values()]
      .filter((tour) => tour.isHost(userId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((tour) => clone(tour)!);
  }

  async listForPlayerUserId(userId: string): Promise<GolfTour[]> {
    return [...this.byId.values()]
      .filter((tour) => tour.isPlayer(userId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((tour) => clone(tour)!);
  }
}

function clone(tour: GolfTour | null): GolfTour | null {
  if (!tour) return null;
  return GolfTour.fromSnapshot(tour.toSnapshot());
}
