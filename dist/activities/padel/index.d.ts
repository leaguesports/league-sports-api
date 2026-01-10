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
export type SessionStatus = "pending" | "in_progress" | "completed" | "cancelled";
export declare class PadelSession {
    readonly id: string;
    readonly teams: [Team, Team];
    readonly scheduledAt: Date;
    readonly bestOf: 3 | 5;
    private _status;
    private _score;
    constructor(params: {
        id: string;
        teams: [Team, Team];
        scheduledAt: Date;
        bestOf?: 3 | 5;
    });
    get status(): SessionStatus;
    get score(): MatchScore;
    get winner(): TeamIndex | null;
    start(): void;
    scorePoint(team: TeamIndex): void;
    cancel(): void;
    private get currentSet();
    private opponent;
    private createInitialScore;
    private scoreRegularPoint;
    private scoreTiebreakPoint;
    private winGame;
    private winSet;
    private resetGame;
}
//# sourceMappingURL=index.d.ts.map