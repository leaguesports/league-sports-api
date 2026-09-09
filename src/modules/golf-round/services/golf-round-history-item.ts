import { GolfRoundSnapshot } from "../entities/golf-round";
import { GolfPlayerSnapshot } from "../entities/golf-player";
import { CourseSnapshotData } from "../entities/course-snapshot";
import { ApiGolfScoreSnapshot } from "../entities/golf-round";

export type GolfRoundHistoryItem = {
  id: string;
  startsAt: string;
  venueCmsId: string;
  venueName: string | null;
  venueSlug: string | null;
  holesPlayed: number;
  startingHole: number;
  teeName: string | null;
  teeId: string | null;
  courseRating: number | null;
  slopeRating: number | null;
  teePar: number | null;
  course: CourseSnapshotData;
  players: GolfPlayerSnapshot[];
  score: ApiGolfScoreSnapshot | null;
  handicapDisclaimer: string;
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
    teeId: snapshot.teeId,
    courseRating: snapshot.courseRating,
    slopeRating: snapshot.slopeRating,
    teePar: snapshot.teePar,
    course: snapshot.course,
    players: snapshot.players,
    score: snapshot.score,
    handicapDisclaimer: snapshot.handicapDisclaimer,
  };
}
