export type GameDayStatus = "setup" | "in_play" | "final";
export type CardStatus = "live" | "locked";
export type FeedType = "birdie" | "lead_change" | "card_locked";

export type TeeRating = {
  name: string;
  courseRating: number | null;
  slopeRating: number | null;
  teePar: number | null;
};

export type CourseHole = {
  number: number;
  par: number;
  strokeIndex: number;
};

export type CourseCopy = {
  name: string | null;
  holes: CourseHole[];
};

export type PlayerRecord = {
  id: string;
  displayName: string;
  userId: string | null;
  handicapIndex: number | null;
  teeName: string;
  cardId: string | null;
  slot: number | null;
  deviceTokenHash: string | null;
  looksRight: boolean;
  courseRating: number | null;
  slopeRating: number | null;
  teePar: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
};

export type HoleRecord = {
  id: string;
  holeNumber: number;
  strokes: Record<string, number>;
  clientTimestamp: string;
};

export type CardRecord = {
  id: string;
  number: number;
  golfRoundId: string;
  scorerPlayerId: string;
  status: CardStatus;
  holesPlayed: 9 | 18;
  startingHole: number;
  course: CourseCopy;
  tees: TeeRating[];
  holes: HoleRecord[];
};

export type FeedRecord = {
  id: string;
  type: FeedType;
  message: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type GameDayRecord = {
  id: string;
  organiserUserId: string;
  venueCmsId: string;
  venueName: string;
  date: string;
  defaultTee: string;
  teeOptions: string[];
  format: "stroke";
  inviteCode: string;
  watchToken: string;
  watchTokenHash: string;
  status: GameDayStatus;
  weekendEventId: string | null;
  version: number;
  players: PlayerRecord[];
  cards: CardRecord[];
  feed: FeedRecord[];
};

export type WeekendRecord = {
  id: string;
  organiserUserId: string;
  name: string | null;
  createdAt: string;
};

export const MAX_PLAYERS = 16;
export const FEED_LIMIT = 40;

export function deriveStatus(day: GameDayRecord): GameDayStatus {
  if (day.cards.length === 0) {
    return "setup";
  }
  if (day.cards.every((card) => card.status === "locked")) {
    return "final";
  }
  return "in_play";
}

export function sameLabel(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function dateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    date.getUTCDay()
  ];
  const monthName = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][(month ?? 1) - 1];
  return `${weekday} ${day} ${monthName}`;
}

export function headline(venueName: string, isoDate: string): string {
  const first = venueName.trim().split(/\s+/)[0] ?? venueName;
  return `${first.toUpperCase()} · ${dateLabel(isoDate).toUpperCase()}`;
}

export function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}
