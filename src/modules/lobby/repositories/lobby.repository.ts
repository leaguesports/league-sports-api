import { LobbyLooking } from "../entities/lobby-looking";
import { LobbyOpenGame } from "../entities/lobby-open-game";
import { LobbyProposal } from "../entities/lobby-proposal";
import { LobbySportValue } from "../entities/lobby-sport";

export type LobbyListFilters = {
  sport?: LobbySportValue;
  city?: string;
  now?: Date;
};

export interface LobbyRepository {
  findLookingByUserId(userId: string): Promise<LobbyLooking | null>;
  findLookingById(id: string): Promise<LobbyLooking | null>;
  upsertLooking(looking: LobbyLooking): Promise<LobbyLooking>;
  deleteLookingByUserId(userId: string): Promise<boolean>;
  listActiveLookings(filters: LobbyListFilters): Promise<LobbyLooking[]>;

  findOpenGameById(id: string): Promise<LobbyOpenGame | null>;
  createOpenGame(game: LobbyOpenGame): Promise<LobbyOpenGame>;
  persistOpenGame(game: LobbyOpenGame): Promise<LobbyOpenGame>;
  listActiveOpenGames(filters: LobbyListFilters): Promise<LobbyOpenGame[]>;
  listOpenGamesForUser(userId: string): Promise<LobbyOpenGame[]>;

  findProposalById(id: string): Promise<LobbyProposal | null>;
  createProposal(proposal: LobbyProposal): Promise<LobbyProposal>;
  persistProposal(proposal: LobbyProposal): Promise<LobbyProposal>;
  listProposalsForUser(userId: string): Promise<LobbyProposal[]>;
  listPendingProposals(filters: LobbyListFilters): Promise<LobbyProposal[]>;
}
