import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { Config, corsReflectOrigin } from "./config";
import { createPrismaClient } from "./lib/prisma";
import {
  createDartsModule,
  DartsMatchRepository,
} from "./modules/darts";
import {
  createGolfRoundModule,
  GolfRoundRepository,
} from "./modules/golf-round";
import { createIdentityModule } from "./modules/identity";
import {
  createMatchModule,
  MatchRepository,
} from "./modules/match";
import {
  createFriendsModule,
  FriendProfileLookup,
  FriendshipRepository,
} from "./modules/friends";
import {
  createBadgesModule,
  BadgeAwardRepository,
} from "./modules/badges";
import {
  createCommunitiesModule,
  CommunityRepository,
} from "./modules/communities";
import {
  createPreferencesModule,
  PreferencesRepository,
} from "./modules/preferences";
import {
  createTrainingModule,
  TrainingEnrollmentRepository,
} from "./modules/training";
import {
  createIntegrationsModule,
  IntegrationConnectionRepository,
} from "./modules/integrations";
import {
  createVenueModule,
  VenueRepository,
} from "./modules/venue";
import {
  createFixturesModule,
  FixtureFollowRepository,
} from "./modules/fixtures";
import {
  createPoolsModule,
  PoolRepository,
} from "./modules/pools";
import {
  createOrganisedGamesModule,
  OrganisedGameRepository,
} from "./modules/organised-games";
import {
  createNotificationsModule,
  NotificationRepository,
} from "./modules/notifications";
import {
  createTeamsModule,
  TeamRepository,
} from "./modules/teams";
import {
  createTeamMatchesModule,
  TeamMatchRepository,
} from "./modules/team-matches";
import { PrismaTeamMatchRepository } from "./modules/team-matches/repositories/prisma-team-match.repository";
import { CompleteTeamMatchOnScorecardLock } from "./modules/team-matches/services/complete-on-scorecard-lock";
import { ScorecardLockedEvent } from "./modules/scorecards/on-scorecard-locked";
import {
  createTournamentsModule,
  TournamentRepository,
} from "./modules/tournaments";
import { PrismaTournamentRepository } from "./modules/tournaments/repositories/prisma-tournament.repository";
import { AdvanceTournamentOnTeamMatchComplete } from "./modules/tournaments/services/advance-on-team-match-complete";
import {
  createRoadmapModule,
  RoadmapEmailSender,
  RoadmapRateLimiter,
  RoadmapRepository,
} from "./modules/roadmap";
import {
  CoverageIntentRepository,
  CoverageRateLimiter,
  createIntentsModule,
} from "./modules/intents";
import {
  createLobbyModule,
  LobbyRepository,
} from "./modules/lobby";

export type CreateAppDependencies = {
  venueRepository?: VenueRepository;
  venueFollowRepository?: import("./modules/venue").VenueFollowRepository;
  fixtureFollowRepository?: FixtureFollowRepository;
  friendshipRepository?: FriendshipRepository;
  friendProfileLookup?: FriendProfileLookup;
  matchRepository?: MatchRepository;
  golfRoundRepository?: GolfRoundRepository;
  dartsMatchRepository?: DartsMatchRepository;
  badgeAwardRepository?: BadgeAwardRepository;
  preferencesRepository?: PreferencesRepository;
  communityRepository?: CommunityRepository;
  trainingEnrollmentRepository?: TrainingEnrollmentRepository;
  integrationConnectionRepository?: IntegrationConnectionRepository;
  poolRepository?: PoolRepository;
  organisedGameRepository?: OrganisedGameRepository;
  notificationRepository?: NotificationRepository;
  teamRepository?: TeamRepository;
  teamMatchRepository?: TeamMatchRepository;
  tournamentRepository?: TournamentRepository;
  roadmapRepository?: RoadmapRepository;
  roadmapEmailSender?: RoadmapEmailSender;
  roadmapVoteRateLimiter?: RoadmapRateLimiter;
  coverageIntentRepository?: CoverageIntentRepository;
  coverageRateLimiter?: CoverageRateLimiter;
  lobbyRepository?: LobbyRepository;
};

export async function createApp(
  config: Config,
  dependencies: CreateAppDependencies = {},
) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(
          null,
          corsReflectOrigin(origin, config.CORS_ORIGINS, config.FRONTEND_URL),
        );
      },
      credentials: true,
    }),
  );

  const prisma = createPrismaClient(config);
  app.locals.prisma = prisma;

  const identity = createIdentityModule({ config, prisma });
  const venue = createVenueModule({
    prisma,
    venueRepository: dependencies.venueRepository,
    venueFollowRepository: dependencies.venueFollowRepository,
    hasAuthenticatedCaller: identity.hasAuthenticatedCaller,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const fixtures = createFixturesModule({
    prisma,
    fixtureFollowRepository: dependencies.fixtureFollowRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const teamMatchRepository =
    dependencies.teamMatchRepository ??
    new PrismaTeamMatchRepository(prisma);
  const tournamentRepository =
    dependencies.tournamentRepository ??
    new PrismaTournamentRepository(prisma);
  const advanceTournament = new AdvanceTournamentOnTeamMatchComplete(
    tournamentRepository,
  );
  const onTeamMatchCompleted = (match: import("./modules/team-matches/entities/team-match").TeamMatch) =>
    advanceTournament.execute(match);
  const completeOnLock = new CompleteTeamMatchOnScorecardLock(
    teamMatchRepository,
    onTeamMatchCompleted,
  );
  const onScorecardLocked = (event: ScorecardLockedEvent) =>
    completeOnLock.execute(event);

  const match = createMatchModule({
    prisma,
    venueRepository: venue.venueRepository,
    matchRepository: dependencies.matchRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    onScorecardLocked,
  });
  const golfRound = createGolfRoundModule({
    prisma,
    venueRepository: venue.venueRepository,
    golfRoundRepository: dependencies.golfRoundRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    onScorecardLocked,
  });
  const darts = createDartsModule({
    prisma,
    venueRepository: venue.venueRepository,
    dartsMatchRepository: dependencies.dartsMatchRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    onScorecardLocked,
  });
  const friends = createFriendsModule({
    prisma,
    friendshipRepository: dependencies.friendshipRepository,
    friendProfileLookup: dependencies.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const preferences = createPreferencesModule({
    prisma,
    preferencesRepository: dependencies.preferencesRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const badges = createBadgesModule({
    prisma,
    matchRepository: match.matchRepository,
    golfRoundRepository: golfRound.golfRoundRepository,
    friendshipRepository: friends.friendshipRepository,
    badgeAwardRepository: dependencies.badgeAwardRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const communities = createCommunitiesModule({
    prisma,
    communityRepository: dependencies.communityRepository,
    friendProfileLookup: friends.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const training = createTrainingModule({
    prisma,
    trainingEnrollmentRepository: dependencies.trainingEnrollmentRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const integrations = createIntegrationsModule({
    prisma,
    tokenEncryptionKey: config.JWT_SECRET,
    integrationConnectionRepository:
      dependencies.integrationConnectionRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const pools = createPoolsModule({
    prisma,
    poolRepository: dependencies.poolRepository,
    friendProfileLookup: friends.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const notifications = createNotificationsModule({
    prisma,
    notificationRepository: dependencies.notificationRepository,
    friendProfileLookup: friends.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const organisedGames = createOrganisedGamesModule({
    prisma,
    venueRepository: venue.venueRepository,
    friendshipRepository: friends.friendshipRepository,
    friendProfileLookup: friends.friendProfileLookup,
    matchRepository: match.matchRepository,
    golfRoundRepository: golfRound.golfRoundRepository,
    organisedGameRepository: dependencies.organisedGameRepository,
    inviteNotifier: notifications.organisedGameInviteNotifier,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const teams = createTeamsModule({
    prisma,
    teamRepository: dependencies.teamRepository,
    friendshipRepository: friends.friendshipRepository,
    friendProfileLookup: friends.friendProfileLookup,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const teamMatches = createTeamMatchesModule({
    prisma,
    teamRepository: teams.teamRepository,
    venueRepository: venue.venueRepository,
    matchRepository: match.matchRepository,
    golfRoundRepository: golfRound.golfRoundRepository,
    dartsMatchRepository: darts.dartsMatchRepository,
    friendProfileLookup: friends.friendProfileLookup,
    teamMatchRepository,
    onTeamMatchCompleted,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const tournaments = createTournamentsModule({
    prisma,
    teamRepository: teams.teamRepository,
    teamMatchRepository,
    tournamentRepository,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });
  const roadmap = createRoadmapModule({
    prisma,
    config,
    roadmapRepository: dependencies.roadmapRepository,
    emailSender: dependencies.roadmapEmailSender,
    voteRateLimiter: dependencies.roadmapVoteRateLimiter,
    tryGetSessionUserId: identity.tryGetSessionUserId,
  });
  const intents = createIntentsModule({
    prisma,
    config,
    coverageIntentRepository: dependencies.coverageIntentRepository,
    coverageRateLimiter: dependencies.coverageRateLimiter,
  });
  const lobby = createLobbyModule({
    prisma,
    lobbyRepository: dependencies.lobbyRepository,
    organisedGameRepository: organisedGames.organisedGameRepository,
    venueRepository: venue.venueRepository,
    friendshipRepository: friends.friendshipRepository,
    teamRepository: teams.teamRepository,
    friendProfileLookup: friends.friendProfileLookup,
    lobbyNotifier: notifications.lobbyNotifier,
    tryGetSessionUserId: identity.tryGetSessionUserId,
    requireAuth: identity.authorizationMiddleware,
  });

  app.use(identity.router);
  app.use(venue.router);
  app.use(fixtures.router);
  app.use(match.router);
  app.use(golfRound.router);
  app.use(darts.router);
  app.use(friends.router);
  app.use(preferences.router);
  app.use(badges.router);
  app.use(communities.router);
  app.use(training.router);
  app.use(integrations.router);
  app.use(pools.router);
  app.use(notifications.router);
  app.use(organisedGames.router);
  app.use(teams.router);
  app.use(teamMatches.router);
  app.use(tournaments.router);
  app.use(roadmap.router);
  app.use(intents.router);
  app.use(lobby.router);

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) {
        return;
      }

      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
