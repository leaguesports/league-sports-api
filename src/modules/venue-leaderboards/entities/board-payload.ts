export type PublicBoardStats = Record<string, number | string | null>;

export type PublicBoardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  stats: PublicBoardStats;
};

export type GolfTeeRecord = {
  teeId: string | null;
  teeName: string | null;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  stats: PublicBoardStats;
};

export type RecordsPayload = {
  golf: {
    bestGrossByTee: GolfTeeRecord[];
    bestNetByTee: GolfTeeRecord[];
  };
  padel: {
    mostWins: PublicBoardEntry[];
    bestWinStreak: PublicBoardEntry[];
  };
  darts: {
    mostWins: PublicBoardEntry[];
    bestWinStreak: PublicBoardEntry[];
  };
};

export type SnapshotPayload = {
  first: PublicBoardEntry | null;
  entries: PublicBoardEntry[];
  records?: RecordsPayload;
};

export type VenueLeaderboardResponse = {
  venue: { id: string; cmsId: string; name: string };
  board: "records" | "potm" | "grinder" | "streak";
  window: "month" | "all";
  windowKey: string;
  timezone: string;
  computedAt: string;
  first: PublicBoardEntry | null;
  entries: PublicBoardEntry[];
  records?: RecordsPayload;
};
