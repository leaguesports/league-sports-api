import { DomainError } from "../../../lib/domain-error";
import { InMemoryFriendProfileLookup } from "../repositories/in-memory-friend-profile.lookup";
import { InMemoryFriendshipRepository } from "../repositories/in-memory-friendship.repository";
import {
  AcceptFriend,
  AlreadyFriendsError,
  FriendNotFoundError,
  FriendRequestAlreadySentError,
  ListFriends,
  RemoveFriend,
  RequestFriend,
} from "./friends.service";

describe("friends services", () => {
  function setup() {
    const friendships = new InMemoryFriendshipRepository();
    const profiles = new InMemoryFriendProfileLookup();
    profiles.seed({
      userId: "user-a",
      displayName: "Alex",
      handle: "alex",
      avatarUrl: null,
    });
    profiles.seed({
      userId: "user-b",
      displayName: "Blake",
      handle: "blake",
      avatarUrl: "https://example.test/b.png",
    });
    return {
      friendships,
      profiles,
      request: new RequestFriend(friendships, profiles),
      accept: new AcceptFriend(friendships, profiles),
      remove: new RemoveFriend(friendships),
      list: new ListFriends(friendships, profiles),
    };
  }

  test("request by handle creates an outgoing pending request", async () => {
    const { request, list } = setup();
    const result = await request.execute({ userId: "user-a", handle: "@blake" });

    expect(result.status).toBe("pending");
    if (result.status !== "pending") return;
    expect(result.request.user.handle).toBe("blake");

    const listed = await list.execute({ userId: "user-a" });
    expect(listed.outgoing).toHaveLength(1);
    expect(listed.incoming).toHaveLength(0);
    expect(listed.friends).toHaveLength(0);

    const forB = await list.execute({ userId: "user-b" });
    expect(forB.incoming).toHaveLength(1);
    expect(forB.incoming[0]?.user.handle).toBe("alex");
  });

  test("accept turns a pending request into friends", async () => {
    const { request, accept, list } = setup();
    await request.execute({ userId: "user-a", handle: "blake" });

    const accepted = await accept.execute({
      userId: "user-b",
      otherUserId: "user-a",
    });
    expect(accepted.friend.handle).toBe("alex");

    const listed = await list.execute({ userId: "user-a" });
    expect(listed.friends).toHaveLength(1);
    expect(listed.friends[0]?.handle).toBe("blake");
    expect(listed.outgoing).toHaveLength(0);
  });

  test("requesting when the other side already asked accepts instead", async () => {
    const { request } = setup();
    await request.execute({ userId: "user-a", handle: "blake" });

    const result = await request.execute({
      userId: "user-b",
      handle: "alex",
    });
    expect(result.status).toBe("accepted");
  });

  test("rejects unknown handle, self, and duplicate outgoing", async () => {
    const { request } = setup();

    await expect(
      request.execute({ userId: "user-a", handle: "missing" }),
    ).rejects.toBeInstanceOf(FriendNotFoundError);

    await expect(
      request.execute({ userId: "user-a", handle: "alex" }),
    ).rejects.toBeInstanceOf(DomainError);

    await request.execute({ userId: "user-a", handle: "blake" });
    await expect(
      request.execute({ userId: "user-a", handle: "blake" }),
    ).rejects.toBeInstanceOf(FriendRequestAlreadySentError);
  });

  test("remove deletes friendship or pending request", async () => {
    const { request, accept, remove, list } = setup();
    await request.execute({ userId: "user-a", handle: "blake" });
    await accept.execute({ userId: "user-b", otherUserId: "user-a" });

    await remove.execute({ userId: "user-a", otherUserId: "user-b" });
    expect(await list.execute({ userId: "user-a" })).toEqual({
      friends: [],
      incoming: [],
      outgoing: [],
    });
  });

  test("already friends is a conflict", async () => {
    const { request, accept } = setup();
    await request.execute({ userId: "user-a", handle: "blake" });
    await accept.execute({ userId: "user-b", otherUserId: "user-a" });

    await expect(
      request.execute({ userId: "user-a", handle: "blake" }),
    ).rejects.toBeInstanceOf(AlreadyFriendsError);
  });
});
