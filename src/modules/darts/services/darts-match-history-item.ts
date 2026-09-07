import { DartsMatchSnapshot } from "../entities/darts-match";
import { DartsPlayerSnapshot } from "../entities/darts-player";
import { DartsTurnSnapshot } from "../entities/darts-turn";

export type DartsMatchHistoryItem = {
  id: string;
  startsAt: string;
  venueCmsId: string | null;
  venueName: string | null;
  venueSlug: string | null;
  startingScore: number;
  checkoutRule: DartsMatchSnapshot["checkoutRule"];
  players: DartsPlayerSnapshot[];
  turns: DartsTurnSnapshot[];
  winnerSlot: number | null;
  winnerUserId: string | null;
};

export function toHistoryItem(
  snapshot: DartsMatchSnapshot,
  venue: { name: string; slug: string } | null,
): DartsMatchHistoryItem {
  return {
    id: snapshot.id,
    startsAt: snapshot.startsAt,
    venueCmsId: snapshot.venueCmsId,
    venueName: venue?.name ?? null,
    venueSlug: venue?.slug ?? null,
    startingScore: snapshot.startingScore,
    checkoutRule: snapshot.checkoutRule,
    players: snapshot.players,
    turns: snapshot.turns,
    winnerSlot: snapshot.winnerSlot,
    winnerUserId: snapshot.winnerUserId,
  };
}
