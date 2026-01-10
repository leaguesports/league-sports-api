"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PadelSession = void 0;
class PadelSession {
    id;
    teams;
    scheduledAt;
    bestOf;
    _status;
    _score;
    constructor(params) {
        this.id = params.id;
        this.teams = params.teams;
        this.scheduledAt = params.scheduledAt;
        this.bestOf = params.bestOf ?? 3;
        this._status = "pending";
        this._score = this.createInitialScore();
    }
    get status() {
        return this._status;
    }
    get score() {
        return this._score;
    }
    get winner() {
        const setsToWin = Math.ceil(this.bestOf / 2);
        if (this._score.setsWon[0] >= setsToWin)
            return 0;
        if (this._score.setsWon[1] >= setsToWin)
            return 1;
        return null;
    }
    start() {
        if (this._status !== "pending") {
            throw new Error("Session can only be started from pending status");
        }
        this._status = "in_progress";
    }
    scorePoint(team) {
        if (this._status !== "in_progress") {
            throw new Error("Cannot score points when session is not in progress");
        }
        if (this.winner !== null) {
            throw new Error("Match is already complete");
        }
        if (this.currentSet.tiebreak) {
            this.scoreTiebreakPoint(team);
        }
        else {
            this.scoreRegularPoint(team);
        }
    }
    cancel() {
        if (this._status === "completed") {
            throw new Error("Cannot cancel a completed session");
        }
        this._status = "cancelled";
    }
    get currentSet() {
        return this._score.sets[this._score.sets.length - 1];
    }
    opponent(team) {
        return team === 0 ? 1 : 0;
    }
    createInitialScore() {
        return {
            sets: [{ games: [0, 0], tiebreak: false }],
            currentGame: { points: [0, 0], deuce: false },
            setsWon: [0, 0],
        };
    }
    scoreRegularPoint(team) {
        const game = this._score.currentGame;
        const opp = this.opponent(team);
        // Handle advantage/deuce situations
        if (game.deuce) {
            if (game.advantage === team) {
                this.winGame(team);
            }
            else if (game.advantage === opp) {
                game.advantage = undefined;
            }
            else {
                game.advantage = team;
            }
            return;
        }
        // Regular scoring progression
        const nextPoint = {
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
            }
            else {
                this.winGame(team);
            }
        }
        else {
            game.points[team] = next;
        }
    }
    scoreTiebreakPoint(team) {
        const set = this.currentSet;
        const opp = this.opponent(team);
        // In tiebreak, first to 7 with 2-point lead
        set.games[team]++;
        if (set.games[team] >= 7 && set.games[team] - set.games[opp] >= 2) {
            this.winSet(team);
        }
    }
    winGame(team) {
        const set = this.currentSet;
        set.games[team]++;
        this.resetGame();
        // Check for set win: 6 games with 2-game lead, or 7-6 after tiebreak
        if (set.games[team] >= 6) {
            const opp = this.opponent(team);
            if (set.games[team] - set.games[opp] >= 2) {
                this.winSet(team);
            }
            else if (set.games[team] === 6 && set.games[opp] === 6) {
                set.tiebreak = true;
                // Reset for tiebreak point counting
                set.games = [0, 0];
            }
        }
    }
    winSet(team) {
        this._score.setsWon[team]++;
        const setsToWin = Math.ceil(this.bestOf / 2);
        if (this._score.setsWon[team] >= setsToWin) {
            this._status = "completed";
        }
        else {
            // Start new set
            this._score.sets.push({ games: [0, 0], tiebreak: false });
            this.resetGame();
        }
    }
    resetGame() {
        this._score.currentGame = { points: [0, 0], deuce: false };
    }
}
exports.PadelSession = PadelSession;
//# sourceMappingURL=index.js.map