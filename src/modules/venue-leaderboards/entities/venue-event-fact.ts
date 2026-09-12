import { randomUUID } from "node:crypto";

import { DartsMatch } from "../../darts/entities/darts-match";
import { GolfRound } from "../../golf-round/entities/golf-round";
import { Match } from "../../match/entities/match";

export const LEADERBOARD_SPORTS = ["padel", "golf", "darts"] as const;

export type LeaderboardSport = (typeof LEADERBOARD_SPORTS)[number];

export type VenueEventFactSnapshot = {
  id: string;
  venueCmsId: string;
  sport: LeaderboardSport;
  eventId: string;
  userId: string;
  lockedAt: string;
  won: boolean | null;
  golfGross: number | null;
  golfNet: number | null;
  golfTeeId: string | null;
  golfTeeName: string | null;
  golfHolesPlayed: number | null;
};

export type VenueEventFactProps = {
  id?: string;
  venueCmsId: string;
  sport: LeaderboardSport;
  eventId: string;
  userId: string;
  lockedAt: Date;
  won?: boolean | null;
  golfGross?: number | null;
  golfNet?: number | null;
  golfTeeId?: string | null;
  golfTeeName?: string | null;
  golfHolesPlayed?: number | null;
};

export class VenueEventFact {
  private constructor(
    readonly id: string,
    readonly venueCmsId: string,
    readonly sport: LeaderboardSport,
    readonly eventId: string,
    readonly userId: string,
    readonly lockedAt: Date,
    readonly won: boolean | null,
    readonly golfGross: number | null,
    readonly golfNet: number | null,
    readonly golfTeeId: string | null,
    readonly golfTeeName: string | null,
    readonly golfHolesPlayed: number | null,
  ) {}

  static create(props: VenueEventFactProps): VenueEventFact {
    return new VenueEventFact(
      props.id ?? randomUUID(),
      props.venueCmsId,
      props.sport,
      props.eventId,
      props.userId,
      props.lockedAt,
      props.won ?? null,
      props.golfGross ?? null,
      props.golfNet ?? null,
      props.golfTeeId ?? null,
      props.golfTeeName ?? null,
      props.golfHolesPlayed ?? null,
    );
  }

  static fromPadelMatch(match: Match): VenueEventFact[] {
    if (!match.isLocked) return [];
    const winner = match.winner;
    const lockedAt = match.lockedAt ?? match.startsAt.value;
    const facts: VenueEventFact[] = [];

    for (const player of match.pairings.players) {
      if (!player.userId || player.isGuest) continue;
      facts.push(
        VenueEventFact.create({
          venueCmsId: match.venueCmsId.value,
          sport: "padel",
          eventId: match.id,
          userId: player.userId,
          lockedAt,
          won: winner ? player.slot.team.equals(winner) : null,
        }),
      );
    }

    return facts;
  }

  static fromGolfRound(round: GolfRound): VenueEventFact[] {
    if (!round.isLocked) return [];
    const lockedAt = round.lockedAt ?? round.startsAt.value;
    const facts: VenueEventFact[] = [];

    for (const player of round.players) {
      if (!player.userId || player.isGuest) continue;
      const snapshot = player.toSnapshot();
      facts.push(
        VenueEventFact.create({
          venueCmsId: round.venueCmsId.value,
          sport: "golf",
          eventId: round.id,
          userId: player.userId,
          lockedAt,
          golfGross: snapshot.grossTotal,
          golfNet: snapshot.netTotal,
          golfTeeId: round.teeId,
          golfTeeName: round.teeName,
          golfHolesPlayed: round.holesPlayed,
        }),
      );
    }

    return facts;
  }

  static fromDartsMatch(match: DartsMatch): VenueEventFact[] {
    if (!match.isLocked || !match.venueCmsId) return [];
    const snapshot = match.toSnapshot();
    const lockedAt = match.lockedAt ?? match.startsAt.value;
    const facts: VenueEventFact[] = [];

    for (const player of match.players) {
      if (!player.userId || player.isGuest) continue;
      facts.push(
        VenueEventFact.create({
          venueCmsId: match.venueCmsId.value,
          sport: "darts",
          eventId: match.id,
          userId: player.userId,
          lockedAt,
          won: snapshot.winnerUserId
            ? player.userId === snapshot.winnerUserId
            : player.slot === snapshot.winnerSlot,
        }),
      );
    }

    return facts;
  }

  get isEighteenHoleGolf(): boolean {
    return this.sport === "golf" && this.golfHolesPlayed === 18;
  }

  get teeKey(): string {
    return this.golfTeeId?.trim() || this.golfTeeName?.trim() || "unknown";
  }

  toSnapshot(): VenueEventFactSnapshot {
    return {
      id: this.id,
      venueCmsId: this.venueCmsId,
      sport: this.sport,
      eventId: this.eventId,
      userId: this.userId,
      lockedAt: this.lockedAt.toISOString(),
      won: this.won,
      golfGross: this.golfGross,
      golfNet: this.golfNet,
      golfTeeId: this.golfTeeId,
      golfTeeName: this.golfTeeName,
      golfHolesPlayed: this.golfHolesPlayed,
    };
  }
}
