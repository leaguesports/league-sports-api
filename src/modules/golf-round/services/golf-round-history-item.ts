import { GolfRoundSnapshot } from "../entities/golf-round";
import { GolfPlayerSnapshot } from "../entities/golf-player";
import { CourseSnapshotData } from "../entities/course-snapshot";
import { GolfScoreSnapshot } from "../entities/golf-score";

export type GolfRoundHistoryItem = {
  id: string;
  startsAt: string;
  venueCmsId: string;
  venueName: string | null;
  venueSlug: string | null;
  holesPlayed: number;
  startingHole: number;
  teeName: string | null;
  course: CourseSnapshotData;
  players: GolfPlayerSnapshot[];
  score: GolfScoreSnapshot | null;
};

export function toHistoryItem(
  snapshot: GolfRoundSnapshot,
  venue: { name: string; slug: string } | null,
): GolfRoundHistoryItem {
  return {
    id: snapshot.id,
    startsAt: snapshot.startsAt,
    venueCmsId: snapshot.venueCmsId,
    venueName: venue?.name ?? null,
    venueSlug: venue?.slug ?? null,
    holesPlayed: snapshot.holesPlayed,
    startingHole: snapshot.startingHole,
    teeName: snapshot.teeName,
    course: snapshot.course,
    players: snapshot.players,
    score: snapshot.score,
  };
}
