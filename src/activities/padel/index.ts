// Padel scoring follows tennis: 0, 15, 30, 40, Deuce, Advantage
export type PointScore = 0 | 15 | 30 | 40;

export type TeamIndex = 0 | 1;

export interface Player {
  id: string;
  name: string;
}

export interface Team {
  players: Player[];
}

export interface GameScore {
  points: [PointScore, PointScore];
  deuce: boolean;
  advantage?: TeamIndex;
}

export interface SetScore {
  games: [number, number];
  tiebreak: boolean;
}

export interface MatchScore {
  sets: SetScore[];
  currentGame: GameScore;
  setsWon: [number, number];
}

export type SessionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export class PadelSession {
  readonly id: string;
  readonly teams: [Team, Team];
  readonly scheduledAt: Date;
  readonly bestOf: 3 | 5;

  private _status: SessionStatus;
  private _score: MatchScore;

  constructor(params: {
    id: string;
    teams: [Team, Team];
    scheduledAt: Date;
    bestOf?: 3 | 5;
  }) {
    this.id = params.id;
    this.teams = params.teams;
    this.scheduledAt = params.scheduledAt;
    this.bestOf = params.bestOf ?? 3;
    this._status = "pending";
    this._score = this.createInitialScore();
  }

  get status(): SessionStatus {
    return this._status;
  }

  get score(): MatchScore {
    return this._score;
  }

  get winner(): TeamIndex | null {
    const setsToWin = Math.ceil(this.bestOf / 2);
    if (this._score.setsWon[0] >= setsToWin) return 0;
    if (this._score.setsWon[1] >= setsToWin) return 1;
    return null;
  }

  start(): void {
    if (this._status !== "pending") {
      throw new Error("Session can only be started from pending status");
    }
    this._status = "in_progress";
  }

  scorePoint(team: TeamIndex): void {
    if (this._status !== "in_progress") {
      throw new Error("Cannot score points when session is not in progress");
    }
    if (this.winner !== null) {
      throw new Error("Match is already complete");
    }

    if (this.currentSet.tiebreak) {
      this.scoreTiebreakPoint(team);
    } else {
      this.scoreRegularPoint(team);
    }
  }

  cancel(): void {
    if (this._status === "completed") {
      throw new Error("Cannot cancel a completed session");
    }
    this._status = "cancelled";
  }

  private get currentSet(): SetScore {
    return this._score.sets[this._score.sets.length - 1];
  }

  private opponent(team: TeamIndex): TeamIndex {
    return team === 0 ? 1 : 0;
  }

  private createInitialScore(): MatchScore {
    return {
      sets: [{ games: [0, 0], tiebreak: false }],
      currentGame: { points: [0, 0], deuce: false },
      setsWon: [0, 0],
    };
  }

  private scoreRegularPoint(team: TeamIndex): void {
    const game = this._score.currentGame;
    const opp = this.opponent(team);

    // Handle advantage/deuce situations
    if (game.deuce) {
      if (game.advantage === team) {
        this.winGame(team);
      } else if (game.advantage === opp) {
        game.advantage = undefined;
      } else {
        game.advantage = team;
      }
      return;
    }

    // Regular scoring progression
    const nextPoint: Record<PointScore, PointScore | "win"> = {
      0: 15,
      15: 30,
      30: 40,
      40: "win",
    };

    const current = game.points[team];
    const next = nextPoint[current];

    if (next === "win") {
      if (game.points[opp] === 40) {
        game.deuce = true;
        game.advantage = team;
      } else {
        this.winGame(team);
      }
    } else {
      game.points[team] = next;
    }
  }

  private scoreTiebreakPoint(team: TeamIndex): void {
    const set = this.currentSet;
    const opp = this.opponent(team);

    // In tiebreak, first to 7 with 2-point lead
    set.games[team]++;

    if (set.games[team] >= 7 && set.games[team] - set.games[opp] >= 2) {
      this.winSet(team);
    }
  }

  private winGame(team: TeamIndex): void {
    const set = this.currentSet;
    set.games[team]++;
    this.resetGame();

    // Check for set win: 6 games with 2-game lead, or 7-6 after tiebreak
    if (set.games[team] >= 6) {
      const opp = this.opponent(team);
      if (set.games[team] - set.games[opp] >= 2) {
        this.winSet(team);
      } else if (set.games[team] === 6 && set.games[opp] === 6) {
        set.tiebreak = true;
        // Reset for tiebreak point counting
        set.games = [0, 0];
      }
    }
  }

  private winSet(team: TeamIndex): void {
    this._score.setsWon[team]++;

    const setsToWin = Math.ceil(this.bestOf / 2);
    if (this._score.setsWon[team] >= setsToWin) {
      this._status = "completed";
    } else {
      // Start new set
      this._score.sets.push({ games: [0, 0], tiebreak: false });
      this.resetGame();
    }
  }

  private resetGame(): void {
    this._score.currentGame = { points: [0, 0], deuce: false };
  }
}
