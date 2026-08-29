import { MatchSnapshot } from "../domain/match";
import { MatchPlayerSnapshot } from "../domain/matchPlayer";
import { MatchScoreSnapshot } from "../domain/matchScore";
import { PairingsSnapshot } from "../domain/pairings";
import { TeamId } from "../domain/team";

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
