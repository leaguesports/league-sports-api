import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryGolfRoundRepository } from "../../golf-round/repositories/in-memory-golf-round.repository";
import { CreateGolfRound } from "../../golf-round/services/create-golf-round.service";
import { InMemoryMatchRepository } from "../../match/repositories/in-memory-match.repository";
import { CreateMatch } from "../../match/services/create-match.service";
import { OrganisedGameNotFriendError } from "../entities/organised-game-not-friend-error";
import { OrganisedGameForbiddenError } from "../entities/organised-game-forbidden-error";
import { OrganisedGameNotFoundError } from "../entities/organised-game-not-found-error";
import { OrganisedGameStartWindowError } from "../entities/organised-game-start-window-error";
import { OrganisedGameVenueNotFoundError } from "../entities/organised-game-venue-not-found-error";
import { InMemoryOrganisedGameRepository } from "../repositories/in-memory-organised-game.repository";
import {
  CreateOrganisedGame,
  GetOrganisedGame,
  InviteFriends,
  JoinByInviteToken,
  ListMyOrganisedGames,
  RsvpOrganisedGame,
  StartOrganisedGame,
} from "./organised-games.service";

const STARTS_AT = "2026-09-07T18:00:00.000Z";

async function seedVenue(venues: InMemoryVenueRepository, cmsId = "sanity-court-1") {
  await venues.ensureFromCms(
    Venue.registerFromCms(
      CmsId.from(cmsId),
      VenueName.from("Padel Club"),
      Slug.from("padel-club"),
    ),
    { refreshDetails: false },
  );
}

async function becomeFriends(
  friendships: InMemoryFriendshipRepository,
  a: string,
  b: string,
) {
  const pending = await friendships.createPending(a, b);
  await friendships.accept(pending.id);
}

function seedProfiles(profiles: InMemoryFriendProfileLookup) {
  profiles.seed({
    userId: "host-1",
    displayName: "Alex",
    handle: "alex",
    avatarUrl: null,
  });
  profiles.seed({
    userId: "friend-a",
    displayName: "Blake",
    handle: "blake",
    avatarUrl: "https://cdn.example/blake.png",
  });
  profiles.seed({
    userId: "friend-b",
    displayName: "Casey",
    handle: "casey",
    avatarUrl: null,
  });
  profiles.seed({
    userId: "stranger",
    displayName: "Drew",
    handle: "drew",
    avatarUrl: null,
  });
}

describe("organised games application", () => {
  test("create requires a known venue and accepted-friend invites", async () => {
    const venues = new InMemoryVenueRepository();
    const games = new InMemoryOrganisedGameRepository();
    const friendships = new InMemoryFriendshipRepository();
    const profiles = new InMemoryFriendProfileLookup();
    seedProfiles(profiles);
    await seedVenue(venues);
    await becomeFriends(friendships, "host-1", "friend-a");

    const create = new CreateOrganisedGame(
      games,
      venues,
      friendships,
      profiles,
    );

    await expect(
      create.execute({
        userId: "host-1",
        sport: "padel",
        venueCmsId: "missing-venue",
        startsAt: STARTS_AT,
      }),
    ).rejects.toBeInstanceOf(OrganisedGameVenueNotFoundError);

    await expect(
      create.execute({
        userId: "host-1",
        sport: "padel",
        venueCmsId: "sanity-court-1",
        startsAt: STARTS_AT,
        inviteUserIds: ["stranger"],
      }),
    ).rejects.toBeInstanceOf(OrganisedGameNotFriendError);

    const { game } = await create.execute({
      userId: "host-1",
      sport: "padel",
      venueCmsId: "sanity-court-1",
      startsAt: STARTS_AT,
      notes: "Sunday hit",
      inviteUserIds: ["friend-a"],
    });

    expect(game).toMatchObject({
      sport: "padel",
      status: "open",
      venueCmsId: "sanity-court-1",
      notes: "Sunday hit",
      capacity: 4,
      host: { id: "host-1", handle: "alex" },
      viewer: { role: "host", rsvp: null },
    });
    expect(game.inviteToken).toHaveLength(32);
    expect(game.invitees).toEqual([
      expect.objectContaining({
        id: "friend-a",
        handle: "blake",
        rsvp: "pending",
      }),
    ]);
  });

  test("stranger cannot GET by id; token join then RSVP; host cannot RSVP", async () => {
    const venues = new InMemoryVenueRepository();
    const games = new InMemoryOrganisedGameRepository();
    const friendships = new InMemoryFriendshipRepository();
    const profiles = new InMemoryFriendProfileLookup();
    seedProfiles(profiles);
    await seedVenue(venues);

    const create = new CreateOrganisedGame(
      games,
      venues,
      friendships,
      profiles,
    );
    const { game } = await create.execute({
      userId: "host-1",
      sport: "golf",
      venueCmsId: "sanity-court-1",
      startsAt: STARTS_AT,
    });

    const get = new GetOrganisedGame(games, profiles);
    await expect(
      get.execute({ userId: "stranger", gameId: game.id }),
    ).rejects.toBeInstanceOf(OrganisedGameNotFoundError);

    const join = new JoinByInviteToken(games, profiles);
    const joined = await join.execute({
      userId: "stranger",
      token: game.inviteToken!,
    });
    expect(joined.game.viewer).toEqual({ role: "invitee", rsvp: "pending" });
    expect(joined.game.inviteToken).toBeNull();

    const rsvp = new RsvpOrganisedGame(games, profiles);
    await expect(
      rsvp.execute({ userId: "host-1", gameId: game.id, rsvp: "accepted" }),
    ).rejects.toBeInstanceOf(OrganisedGameForbiddenError);

    const accepted = await rsvp.execute({
      userId: "stranger",
      gameId: game.id,
      rsvp: "accepted",
    });
    expect(accepted.game.viewer.rsvp).toBe("accepted");

    const hub = new ListMyOrganisedGames(games, profiles);
    const listed = await hub.execute({ userId: "stranger" });
    expect(listed.hosted).toHaveLength(0);
    expect(listed.invited[0]?.id).toBe(game.id);
  });

  test("host start seats host + accepted invitees into a live padel match", async () => {
    const venues = new InMemoryVenueRepository();
    const games = new InMemoryOrganisedGameRepository();
    const friendships = new InMemoryFriendshipRepository();
    const profiles = new InMemoryFriendProfileLookup();
    const matches = new InMemoryMatchRepository();
    seedProfiles(profiles);
    await seedVenue(venues);
    await becomeFriends(friendships, "host-1", "friend-a");
    await becomeFriends(friendships, "host-1", "friend-b");

    const create = new CreateOrganisedGame(
      games,
      venues,
      friendships,
      profiles,
    );
    const now = new Date();
    const { game } = await create.execute({
      userId: "host-1",
      sport: "padel",
      venueCmsId: "sanity-court-1",
      startsAt: now.toISOString(),
      inviteUserIds: ["friend-a", "friend-b"],
    });

    const invite = new InviteFriends(games, friendships, profiles);
    await expect(
      invite.execute({
        userId: "friend-a",
        gameId: game.id,
        userIds: ["friend-b"],
      }),
    ).rejects.toBeInstanceOf(OrganisedGameForbiddenError);

    const rsvp = new RsvpOrganisedGame(games, profiles);
    await rsvp.execute({
      userId: "friend-a",
      gameId: game.id,
      rsvp: "accepted",
    });
    await rsvp.execute({
      userId: "friend-b",
      gameId: game.id,
      rsvp: "declined",
    });

    const start = new StartOrganisedGame(
      games,
      profiles,
      new CreateMatch(matches, venues),
      new CreateGolfRound(new InMemoryGolfRoundRepository(), venues),
    );
    const started = await start.execute({ userId: "host-1", gameId: game.id });

    expect(started.game.status).toBe("started");
    expect(started.live.sport).toBe("padel");
    expect(started.live.path).toBe(`/padel/${started.live.id}`);

    const match = await matches.findById(started.live.id);
    expect(match?.toSnapshot().pairings).toMatchObject({
      teamA: [
        { userId: "host-1", displayName: "Alex", isGuest: false },
        { userId: "friend-a", displayName: "Blake", isGuest: false },
      ],
      teamB: [
        { displayName: "Guest 3", isGuest: true, userId: null },
        { displayName: "Guest 4", isGuest: true, userId: null },
      ],
    });

    const again = await start.execute({ userId: "host-1", gameId: game.id });
    expect(again.live.id).toBe(started.live.id);
  });

  test("start outside the window is rejected", async () => {
    const venues = new InMemoryVenueRepository();
    const games = new InMemoryOrganisedGameRepository();
    const friendships = new InMemoryFriendshipRepository();
    const profiles = new InMemoryFriendProfileLookup();
    seedProfiles(profiles);
    await seedVenue(venues);

    const create = new CreateOrganisedGame(
      games,
      venues,
      friendships,
      profiles,
    );
    const { game } = await create.execute({
      userId: "host-1",
      sport: "padel",
      venueCmsId: "sanity-court-1",
      startsAt: "2030-01-01T00:00:00.000Z",
    });

    const start = new StartOrganisedGame(
      games,
      profiles,
      new CreateMatch(new InMemoryMatchRepository(), venues),
      new CreateGolfRound(new InMemoryGolfRoundRepository(), venues),
    );

    await expect(
      start.execute({ userId: "host-1", gameId: game.id }),
    ).rejects.toBeInstanceOf(OrganisedGameStartWindowError);
  });
});
