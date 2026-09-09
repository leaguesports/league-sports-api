import { Notification } from "./notification";
import { NotificationType } from "./notification-type";
import { OrganisedGameInvitePayload } from "./organised-game-invite-payload";

describe("Notification", () => {
  test("organised-game invite is unread and cannot notify the actor", () => {
    const notification = Notification.organisedGameInvite({
      recipientId: "friend-a",
      actorId: "host-1",
      organisedGameId: "game-1",
      sport: "padel",
      startsAt: "2026-09-07T18:00:00.000Z",
      venueCmsId: "sanity-court-1",
    });

    expect(notification.isUnread).toBe(true);
    expect(notification.type.value).toBe("organised_game_invite");
    expect(notification.resourceId).toBe("game-1");
    expect(notification.payload.toSnapshot()).toEqual({
      organisedGameId: "game-1",
      sport: "padel",
      startsAt: "2026-09-07T18:00:00.000Z",
      venueCmsId: "sanity-court-1",
    });

    expect(() =>
      Notification.organisedGameInvite({
        recipientId: "host-1",
        actorId: "host-1",
        organisedGameId: "game-1",
        sport: "golf",
        startsAt: "2026-09-07T18:00:00.000Z",
      }),
    ).toThrow("Cannot notify the actor");
  });

  test("markRead is idempotent and round-trips through a snapshot", () => {
    const notification = Notification.organisedGameInvite({
      recipientId: "friend-a",
      actorId: "host-1",
      organisedGameId: "game-1",
      sport: "golf",
      startsAt: "2026-09-07T18:00:00.000Z",
      venueCmsId: null,
    });

    const at = new Date("2026-09-07T12:00:00.000Z");
    notification.markRead(at);
    notification.markRead(new Date("2026-09-07T13:00:00.000Z"));
    expect(notification.readAt?.toISOString()).toBe(at.toISOString());

    const restored = Notification.fromSnapshot(notification.toSnapshot());
    expect(restored.toSnapshot()).toEqual(notification.toSnapshot());
  });

  test("lobby notice round-trips and cannot notify the actor", () => {
    const notification = Notification.lobby({
      recipientId: "seeker-1",
      actorId: "host-1",
      type: NotificationType.LOBBY_PROPOSAL_READY,
      resourceId: "proposal-1",
      sport: "darts",
      city: "Cape Town",
      windowStart: "2026-09-08T16:00:00.000Z",
      windowEnd: "2026-09-08T18:00:00.000Z",
      proposalId: "proposal-1",
    });

    expect(notification.type.value).toBe("lobby_proposal_ready");
    expect(notification.toSnapshot().payload).toEqual({
      source: "lobby",
      sport: "darts",
      city: "Cape Town",
      windowStart: "2026-09-08T16:00:00.000Z",
      windowEnd: "2026-09-08T18:00:00.000Z",
      openGameId: null,
      proposalId: "proposal-1",
      organiseGameId: null,
    });
    expect(
      Notification.fromSnapshot(notification.toSnapshot()).toSnapshot(),
    ).toEqual(notification.toSnapshot());
  });

  test("payload rejects unknown sport", () => {
    expect(() => OrganisedGameInvitePayload.from({ organisedGameId: "g" })).toThrow(
      "sport must be padel or golf",
    );
  });
});
