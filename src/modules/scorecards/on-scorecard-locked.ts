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
