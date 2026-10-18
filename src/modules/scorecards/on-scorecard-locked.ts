export type ScorecardLockedEvent = {
  sport: "padel" | "golf" | "darts";
  scorecardId: string;
  padelWinner?: "A" | "B";
  dartsWinnerUserId?: string | null;
  golf?: {
    players: Array<{ slot: number; userId: string | null }>;
    holes: Array<{ strokes: Record<string, number> }>;
  };
};

export type OnScorecardLocked = (event: ScorecardLockedEvent) => Promise<void>;

/** A locked scorecard was opened again. Venue facts for this event should go. */
export type ScorecardUnlockedEvent = {
  sport: "padel" | "golf" | "darts";
  scorecardId: string;
  venueCmsId: string;
};

export type OnScorecardUnlocked = (
  event: ScorecardUnlockedEvent,
) => Promise<void>;
