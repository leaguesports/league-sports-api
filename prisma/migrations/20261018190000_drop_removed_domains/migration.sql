-- Hub-only schema. Drops sport, organise, competition, and parked-tool tables.
-- Rows in those tables are deleted.

-- DropForeignKey
ALTER TABLE "PredictionPoolEntry" DROP CONSTRAINT "PredictionPoolEntry_poolId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_venueCmsId_fkey";

-- DropForeignKey
ALTER TABLE "MatchPlayer" DROP CONSTRAINT "MatchPlayer_matchId_fkey";

-- DropForeignKey
ALTER TABLE "OrganisedGame" DROP CONSTRAINT "OrganisedGame_venueCmsId_fkey";

-- DropForeignKey
ALTER TABLE "OrganisedGameInvite" DROP CONSTRAINT "OrganisedGameInvite_gameId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMembership" DROP CONSTRAINT "TeamMembership_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamInviteLink" DROP CONSTRAINT "TeamInviteLink_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMatch" DROP CONSTRAINT "TeamMatch_homeTeamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMatch" DROP CONSTRAINT "TeamMatch_awayTeamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMatchLineup" DROP CONSTRAINT "TeamMatchLineup_teamMatchId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentRegistration" DROP CONSTRAINT "TournamentRegistration_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentRegistration" DROP CONSTRAINT "TournamentRegistration_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentSlot" DROP CONSTRAINT "TournamentSlot_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentSlot" DROP CONSTRAINT "TournamentSlot_teamMatchId_fkey";

-- DropForeignKey
ALTER TABLE "GolfRound" DROP CONSTRAINT "GolfRound_venueCmsId_fkey";

-- DropForeignKey
ALTER TABLE "GolfRound" DROP CONSTRAINT "GolfRound_gameDayId_fkey";

-- DropForeignKey
ALTER TABLE "GolfRoundPlayer" DROP CONSTRAINT "GolfRoundPlayer_roundId_fkey";

-- DropForeignKey
ALTER TABLE "WeekendEvent" DROP CONSTRAINT "WeekendEvent_organiserUserId_fkey";

-- DropForeignKey
ALTER TABLE "GameDay" DROP CONSTRAINT "GameDay_organiserUserId_fkey";

-- DropForeignKey
ALTER TABLE "GameDay" DROP CONSTRAINT "GameDay_venueCmsId_fkey";

-- DropForeignKey
ALTER TABLE "GameDay" DROP CONSTRAINT "GameDay_weekendEventId_fkey";

-- DropForeignKey
ALTER TABLE "GameDayCard" DROP CONSTRAINT "GameDayCard_gameDayId_fkey";

-- DropForeignKey
ALTER TABLE "GameDayCard" DROP CONSTRAINT "GameDayCard_golfRoundId_fkey";

-- DropForeignKey
ALTER TABLE "GameDayPlayer" DROP CONSTRAINT "GameDayPlayer_gameDayId_fkey";

-- DropForeignKey
ALTER TABLE "GameDayPlayer" DROP CONSTRAINT "GameDayPlayer_cardId_fkey";

-- DropForeignKey
ALTER TABLE "GameDayHoleScore" DROP CONSTRAINT "GameDayHoleScore_cardId_fkey";

-- DropForeignKey
ALTER TABLE "GameDayFeedEvent" DROP CONSTRAINT "GameDayFeedEvent_gameDayId_fkey";

-- DropForeignKey
ALTER TABLE "DartsMatch" DROP CONSTRAINT "DartsMatch_venueCmsId_fkey";

-- DropForeignKey
ALTER TABLE "DartsMatchPlayer" DROP CONSTRAINT "DartsMatchPlayer_matchId_fkey";

-- DropForeignKey
ALTER TABLE "DartsTurn" DROP CONSTRAINT "DartsTurn_matchId_fkey";

-- DropForeignKey
ALTER TABLE "LobbyOpenGameMember" DROP CONSTRAINT "LobbyOpenGameMember_openGameId_fkey";

-- DropForeignKey
ALTER TABLE "LobbyProposalMember" DROP CONSTRAINT "LobbyProposalMember_proposalId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourCamp" DROP CONSTRAINT "GolfTourCamp_tourId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourCampMember" DROP CONSTRAINT "GolfTourCampMember_campId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourStandingFourball" DROP CONSTRAINT "GolfTourStandingFourball_tourId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourStandingFourball" DROP CONSTRAINT "GolfTourStandingFourball_campId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourStandingFourballPlayer" DROP CONSTRAINT "GolfTourStandingFourballPlayer_templateId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourRound" DROP CONSTRAINT "GolfTourRound_venueCmsId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourRound" DROP CONSTRAINT "GolfTourRound_tourId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourFourball" DROP CONSTRAINT "GolfTourFourball_tourId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourFourball" DROP CONSTRAINT "GolfTourFourball_roundId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourFourball" DROP CONSTRAINT "GolfTourFourball_campId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourFourball" DROP CONSTRAINT "GolfTourFourball_golfRoundId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourFourball" DROP CONSTRAINT "GolfTourFourball_standingFourballId_fkey";

-- DropForeignKey
ALTER TABLE "GolfTourFourballPlayer" DROP CONSTRAINT "GolfTourFourballPlayer_fourballId_fkey";

-- DropForeignKey
ALTER TABLE "VenueLeaderboardEventFact" DROP CONSTRAINT "VenueLeaderboardEventFact_venueCmsId_fkey";

-- DropForeignKey
ALTER TABLE "VenueLeaderboardSnapshot" DROP CONSTRAINT "VenueLeaderboardSnapshot_venueCmsId_fkey";

-- DropTable
DROP TABLE "BadgeAward";

-- DropTable
DROP TABLE "TrainingEnrollment";

-- DropTable
DROP TABLE "IntegrationConnection";

-- DropTable
DROP TABLE "PredictionPool";

-- DropTable
DROP TABLE "PredictionPoolEntry";

-- DropTable
DROP TABLE "Match";

-- DropTable
DROP TABLE "MatchPlayer";

-- DropTable
DROP TABLE "OrganisedGame";

-- DropTable
DROP TABLE "OrganisedGameInvite";

-- DropTable
DROP TABLE "Team";

-- DropTable
DROP TABLE "TeamMembership";

-- DropTable
DROP TABLE "TeamInviteLink";

-- DropTable
DROP TABLE "TeamMatch";

-- DropTable
DROP TABLE "TeamMatchLineup";

-- DropTable
DROP TABLE "Tournament";

-- DropTable
DROP TABLE "TournamentRegistration";

-- DropTable
DROP TABLE "TournamentSlot";

-- DropTable
DROP TABLE "GolfRound";

-- DropTable
DROP TABLE "GolfRoundPlayer";

-- DropTable
DROP TABLE "WeekendEvent";

-- DropTable
DROP TABLE "GameDay";

-- DropTable
DROP TABLE "GameDayCard";

-- DropTable
DROP TABLE "GameDayPlayer";

-- DropTable
DROP TABLE "GameDayHoleScore";

-- DropTable
DROP TABLE "GameDayFeedEvent";

-- DropTable
DROP TABLE "DartsMatch";

-- DropTable
DROP TABLE "DartsMatchPlayer";

-- DropTable
DROP TABLE "DartsTurn";

-- DropTable
DROP TABLE "LobbyLooking";

-- DropTable
DROP TABLE "LobbyOpenGame";

-- DropTable
DROP TABLE "LobbyOpenGameMember";

-- DropTable
DROP TABLE "LobbyProposal";

-- DropTable
DROP TABLE "LobbyProposalMember";

-- DropTable
DROP TABLE "GolfTour";

-- DropTable
DROP TABLE "GolfTourCamp";

-- DropTable
DROP TABLE "GolfTourCampMember";

-- DropTable
DROP TABLE "GolfTourStandingFourball";

-- DropTable
DROP TABLE "GolfTourStandingFourballPlayer";

-- DropTable
DROP TABLE "GolfTourRound";

-- DropTable
DROP TABLE "GolfTourFourball";

-- DropTable
DROP TABLE "GolfTourFourballPlayer";

-- DropTable
DROP TABLE "VenueLeaderboardEventFact";

-- DropTable
DROP TABLE "VenueLeaderboardSnapshot";

-- DropEnum
DROP TYPE "TrainingEnrollmentStatus";

-- DropEnum
DROP TYPE "IntegrationConnectionStatus";

-- DropEnum
DROP TYPE "PredictionPoolMemberRole";

-- DropEnum
DROP TYPE "PredictionWinner";

-- DropEnum
DROP TYPE "MatchRuleset";

-- DropEnum
DROP TYPE "MatchStatus";

-- DropEnum
DROP TYPE "MatchTeam";

-- DropEnum
DROP TYPE "MatchPlayerSlot";

-- DropEnum
DROP TYPE "GolfRoundStatus";

-- DropEnum
DROP TYPE "OrganisedGameSport";

-- DropEnum
DROP TYPE "OrganisedGameStatus";

-- DropEnum
DROP TYPE "OrganisedGameRsvp";

-- DropEnum
DROP TYPE "TeamSport";

-- DropEnum
DROP TYPE "TeamMemberRole";

-- DropEnum
DROP TYPE "TeamMemberStatus";

-- DropEnum
DROP TYPE "TeamMatchStatus";

-- DropEnum
DROP TYPE "TournamentStatus";

-- DropEnum
DROP TYPE "TournamentRegistrationStatus";

-- DropEnum
DROP TYPE "TournamentSlotSide";

-- DropEnum
DROP TYPE "GameDayFormat";

-- DropEnum
DROP TYPE "GameDayStatus";

-- DropEnum
DROP TYPE "GameDayCardStatus";

-- DropEnum
DROP TYPE "DartsMatchStatus";

-- DropEnum
DROP TYPE "LobbySport";

-- DropEnum
DROP TYPE "LobbySkill";

-- DropEnum
DROP TYPE "LobbyOpenGameStatus";

-- DropEnum
DROP TYPE "LobbyProposalStatus";

-- DropEnum
DROP TYPE "LobbyProposalResponse";

-- DropEnum
DROP TYPE "GolfTourStatus";

-- DropEnum
DROP TYPE "GolfTourFormat";

-- DropEnum
DROP TYPE "GolfTourFourballStatus";

-- DropEnum
DROP TYPE "VenueLeaderboardSport";

-- DropEnum
DROP TYPE "VenueLeaderboardBoard";
