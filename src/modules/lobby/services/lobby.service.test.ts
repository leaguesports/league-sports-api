import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../../friends/repositories/in-memory-friendship.repository";
import { InMemoryNotificationRepository } from "../../notifications/repositories/in-memory-notification.repository";
import { NotifyLobby } from "../../notifications/services/notifications.service";
import { InMemoryOrganisedGameRepository } from "../../organised-games/repositories/in-memory-organised-game.repository";
import { InMemoryTeamRepository } from "../../teams/repositories/in-memory-team.repository";
import { CmsId } from "../../venue/entities/cms-id";
import { Slug } from "../../venue/entities/slug";
import { Venue } from "../../venue/entities/venue";
import { VenueName } from "../../venue/entities/venue-name";
import { InMemoryVenueRepository } from "../../venue/repositories/in-memory-venue.repository";
import { InMemoryLobbyRepository } from "../repositories/in-memory-lobby.repository";
import { ConvertLobbyToOrganisedGame } from "./convert-to-organise";
import {
  ClearLooking,
  CreateOpenGame,
  JoinOpenGame,
  KickOpenGame,
  ListLobby,
  RespondToProposal,
  SetLooking,
} from "./lobby.service";

const NOW = new Date("2026-09-08T12:00:00.000Z");
const WINDOW = {
  windowStart: "2026-09-08T16:00:00.000Z",
  windowEnd: "2026-09-08T18:00:00.000Z",
};

function seedProfiles(profiles: InMemoryFriendProfileLookup) {
  profiles.seed({
    userId: "user-a",
    displayName: "Alex Smith",
    handle: "alex",
    avatarUrl: "https://cdn.example/alex.png",
  });
  profiles.seed({
    userId: "user-b",
    displayName: "Blake Jones",
    handle: "blake",
    avatarUrl: null,
  });
  profiles.seed({
    userId: "user-c",
    displayName: "Casey Lee",
    handle: "casey",
    avatarUrl: null,
  });
  profiles.seed({
    userId: "user-d",
    displayName: "Drew Patel",
    handle: "drew",
    avatarUrl: null,
  });
}

async function setup() {
  const lobby = new InMemoryLobbyRepository();
  const profiles = new InMemoryFriendProfileLookup();
  seedProfiles(profiles);
  const friendships = new InMemoryFriendshipRepository();
  const teams = new InMemoryTeamRepository();
  const notifications = new InMemoryNotificationRepository();
  const notifier = new NotifyLobby(notifications);
  const venues = new InMemoryVenueRepository();
  await venues.ensureFromCms(
    Venue.registerFromCms(
      CmsId.from("sanity-court-1"),
      VenueName.from("Padel Club"),
      Slug.from("padel-club"),
    ),
    { refreshDetails: false },
  );
  const organised = new InMemoryOrganisedGameRepository();
  const converter = new ConvertLobbyToOrganisedGame(organised, venues);

  return {
    lobby,
    profiles,
    friendships,
    teams,
    notifications,
    notifier,
    organised,
    converter,
    list: new ListLobby(lobby, profiles, friendships, teams),
    setLooking: new SetLooking(lobby, profiles, notifier, converter),
    clearLooking: new ClearLooking(lobby),
    createOpenGame: new CreateOpenGame(lobby, profiles, notifier),
    join: new JoinOpenGame(lobby, profiles, notifier, converter),
    kick: new KickOpenGame(lobby, profiles),
    respond: new RespondToProposal(lobby, profiles, notifier, converter),
  };
}

describe("lobby application", () => {
  test("set looking replaces the previous row and caps TTL at windowEnd", async () => {
    const ctx = await setup();
    const first = await ctx.setLooking.execute({
      userId: "user-a",
      sport: "darts",
      ...WINDOW,
      city: "Cape Town",
      partySizeWithMe: 1,
      now: NOW,
    });
    const second = await ctx.setLooking.execute({
      userId: "user-a",
      sport: "padel",
      ...WINDOW,
      city: "Cape Town",
      partySizeWithMe: 2,
      now: NOW,
    });

    expect(first.looking.expiresAt).toBe(WINDOW.windowEnd);
    expect(second.looking.sport).toBe("padel");
    expect(second.looking.partySize).toBe(2);
    expect(await ctx.lobby.findLookingById(first.looking.id)).toBeNull();
  });

  test("clear looking removes the seeker status", async () => {
    const ctx = await setup();
    await ctx.setLooking.execute({
      userId: "user-a",
      sport: "darts",
      ...WINDOW,
      city: "Cape Town",
      now: NOW,
    });
    const cleared = await ctx.clearLooking.execute({
      userId: "user-a",
      now: NOW,
    });
    expect(cleared.cleared).toBe(true);
    expect(await ctx.lobby.findLookingByUserId("user-a")).toBeNull();
  });

  test("two compatible darts lookings become a proposal", async () => {
    const ctx = await setup();
    await ctx.setLooking.execute({
      userId: "user-a",
      sport: "darts",
      ...WINDOW,
      city: "Cape Town",
      now: NOW,
    });
    const second = await ctx.setLooking.execute({
      userId: "user-b",
      sport: "darts",
      ...WINDOW,
      city: "Cape Town",
      now: NOW,
    });

    expect(second.proposals).toHaveLength(1);
    expect(second.proposals[0].sport).toBe("darts");
    expect(second.proposals[0].members).toHaveLength(2);

    const inbox = await ctx.notifications.listPage({
      recipientId: "user-b",
      limit: 10,
    });
    expect(
      inbox.items.some((n) => n.type.value === "lobby_proposal_ready"),
    ).toBe(true);
  });

  test("proposal accept converts to Organise when venue is present", async () => {
    const ctx = await setup();
    await ctx.setLooking.execute({
      userId: "user-a",
      sport: "padel",
      ...WINDOW,
      city: "Cape Town",
      venueCmsId: "sanity-court-1",
      partySizeWithMe: 2,
      now: NOW,
    });
    const second = await ctx.setLooking.execute({
      userId: "user-b",
      sport: "padel",
      ...WINDOW,
      city: "Cape Town",
      partySizeWithMe: 2,
      now: NOW,
    });
    const proposalId = second.proposals[0].id;

    await ctx.respond.execute({
      userId: "user-a",
      proposalId,
      decision: "accept",
      now: NOW,
    });
    const accepted = await ctx.respond.execute({
      userId: "user-b",
      proposalId,
      decision: "accept",
      now: NOW,
    });

    expect(accepted.proposal.status).toBe("accepted");
    expect(accepted.proposal.organiseGameId).toBeTruthy();
    expect(accepted.proposal.source).toBe("lobby");
    const organised = await ctx.organised.findById(
      accepted.proposal.organiseGameId!,
    );
    expect(organised?.sport.value).toBe("padel");
    expect(organised?.inviteOf("user-b")?.rsvp.isAccepted).toBe(true);
  });

  test("proposal pass cancels when remaining parties cannot fill", async () => {
    const ctx = await setup();
    await ctx.setLooking.execute({
      userId: "user-a",
      sport: "darts",
      ...WINDOW,
      city: "Cape Town",
      now: NOW,
    });
    const second = await ctx.setLooking.execute({
      userId: "user-b",
      sport: "darts",
      ...WINDOW,
      city: "Cape Town",
      now: NOW,
    });

    const passed = await ctx.respond.execute({
      userId: "user-b",
      proposalId: second.proposals[0].id,
      decision: "pass",
      now: NOW,
    });
    expect(passed.proposal.status).toBe("cancelled");
    expect(passed.proposal.organiseGameId).toBeNull();
  });

  test("open game create/join/kick and fill converts to Organise", async () => {
    const ctx = await setup();
    const created = await ctx.createOpenGame.execute({
      userId: "user-a",
      sport: "padel",
      ...WINDOW,
      city: "Cape Town",
      venueCmsId: "sanity-court-1",
      slotsNeeded: 4,
      partySizeWithMe: 1,
      now: NOW,
    });
    expect(created.openGame.slotsRemaining).toBe(3);
    expect(created.openGame.status).toBe("open");

    const joined = await ctx.join.execute({
      userId: "user-b",
      openGameId: created.openGame.id,
      partySizeWithMe: 1,
      now: NOW,
    });
    expect(joined.openGame.slotsFilled).toBe(2);
    expect(joined.openGame.status).toBe("open");

    const kicked = await ctx.kick.execute({
      userId: "user-a",
      openGameId: created.openGame.id,
      targetUserId: "user-b",
      now: NOW,
    });
    expect(kicked.openGame.slotsFilled).toBe(1);

    await ctx.join.execute({
      userId: "user-b",
      openGameId: created.openGame.id,
      partySizeWithMe: 1,
      now: NOW,
    });
    const filled = await ctx.join.execute({
      userId: "user-c",
      openGameId: created.openGame.id,
      partySizeWithMe: 2,
      now: NOW,
    });

    expect(filled.openGame.status).toBe("filled");
    expect(filled.openGame.organiseGameId).toBeTruthy();
    expect(filled.openGame.source).toBe("lobby");
    expect(filled.openGame.slotsRemaining).toBe(0);
  });

  test("GET lobby privacy shape hides profile dump", async () => {
    const ctx = await setup();
    await ctx.setLooking.execute({
      userId: "user-a",
      sport: "golf",
      ...WINDOW,
      city: "Cape Town",
      area: "Sea Point",
      skill: "casual",
      now: NOW,
    });
    await ctx.createOpenGame.execute({
      userId: "user-b",
      sport: "golf",
      ...WINDOW,
      city: "Cape Town",
      area: "Camps Bay",
      now: NOW,
    });

    const listed = await ctx.list.execute({
      userId: "user-c",
      city: "Cape Town",
      now: NOW,
    });

    expect(listed.lookings).toEqual([
      {
        id: expect.any(String),
        firstName: "Alex",
        sport: "golf",
        windowStart: WINDOW.windowStart,
        windowEnd: WINDOW.windowEnd,
        city: "Cape Town",
        area: "Sea Point",
      },
    ]);
    expect(listed.openGames[0]).toEqual({
      id: expect.any(String),
      firstName: "Blake",
      sport: "golf",
      windowStart: WINDOW.windowStart,
      windowEnd: WINDOW.windowEnd,
      city: "Cape Town",
      area: "Camps Bay",
      slotsNeeded: 4,
      slotsFilled: 1,
      slotsRemaining: 3,
    });
    expect(JSON.stringify(listed)).not.toContain("alex");
    expect(JSON.stringify(listed)).not.toContain("Smith");
    expect(JSON.stringify(listed)).not.toContain("cdn.example");
    expect(JSON.stringify(listed.lookings)).not.toContain("user-a");
  });

  test("looking notifies when a compatible open game already exists", async () => {
    const ctx = await setup();
    await ctx.createOpenGame.execute({
      userId: "user-a",
      sport: "golf",
      ...WINDOW,
      city: "Cape Town",
      now: NOW,
    });
    await ctx.setLooking.execute({
      userId: "user-b",
      sport: "golf",
      ...WINDOW,
      city: "Cape Town",
      now: NOW,
    });

    const inbox = await ctx.notifications.listPage({
      recipientId: "user-b",
      limit: 10,
    });
    expect(
      inbox.items.some((n) => n.type.value === "lobby_open_game_compatible"),
    ).toBe(true);
  });

  test("darts fill is blocked from Organise conversion", async () => {
    const ctx = await setup();
    const created = await ctx.createOpenGame.execute({
      userId: "user-a",
      sport: "darts",
      ...WINDOW,
      city: "Cape Town",
      venueCmsId: "sanity-court-1",
      now: NOW,
    });
    const filled = await ctx.join.execute({
      userId: "user-b",
      openGameId: created.openGame.id,
      now: NOW,
    });
    expect(filled.openGame.status).toBe("filled");
    expect(filled.openGame.organiseGameId).toBeNull();
    expect(filled.openGame.conversionBlocked).toBe("unsupported_sport");
  });
});
