import { MatchSnapshot } from "../entities/match";
import { MatchPlayerSnapshot } from "../entities/match-player";
import { MatchScoreSnapshot } from "../entities/match-score";
import { PairingsSnapshot } from "../entities/pairings";
import { TeamId } from "../entities/team";

export type MatchHistoryItem = {
  id: string;
  startsAt: string;
  venueCmsId: string;
  venueName: string | null;
  venueSlug: string | null;
  pairings: PairingsSnapshot;
  opponents: MatchPlayerSnapshot[] | PairingsSnapshot;
  score: MatchScoreSnapshot | null;
  winner: TeamId | null;
};

export function toHistoryItem(
  snapshot: MatchSnapshot,
  venue: { name: string; slug: string } | null,
  opponents: MatchPlayerSnapshot[] | PairingsSnapshot,
): MatchHistoryItem {
  return {
    id: snapshot.id,
    startsAt: snapshot.startsAt,
    venueCmsId: snapshot.venueCmsId,
    venueName: venue?.name ?? null,
    venueSlug: venue?.slug ?? null,
    pairings: snapshot.pairings,
    opponents,
    score: snapshot.score,
    winner: snapshot.winner,
  };
}
