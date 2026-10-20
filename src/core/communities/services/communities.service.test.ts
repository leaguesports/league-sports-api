import { DomainError } from "../../../lib/domain-error";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryCommunityRepository } from "../repositories/in-memory-community.repository";
import {
  CommunityMembershipNotFoundError,
  CommunityNotFoundError,
  CreateCommunity,
  GetCommunity,
  JoinCommunity,
  LeaveCommunity,
  ListCommunities,
  ListMyCommunities,
  SoleOwnerLeaveError,
} from "./communities.service";

describe("communities services", () => {
  function setup() {
    const communities = new InMemoryCommunityRepository();
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
      communities,
      profiles,
      create: new CreateCommunity(communities, profiles),
      get: new GetCommunity(communities, profiles),
      list: new ListCommunities(communities),
      me: new ListMyCommunities(communities),
      join: new JoinCommunity(communities, profiles),
      leave: new LeaveCommunity(communities),
    };
  }

  test("create makes the session user owner and first member", async () => {
    const { create } = setup();
    const result = await create.execute({
      userId: "user-a",
      name: "  Sunday Beers  ",
      city: "Cape Town",
      sport: "Padel",
    });

    expect(result.community).toMatchObject({
      name: "Sunday Beers",
      city: "Cape Town",
      sport: "padel",
      memberCount: 1,
      joined: true,
      role: "owner",
    });
    expect(result.community.members).toEqual([
      expect.objectContaining({
        id: "user-a",
        handle: "alex",
        role: "owner",
      }),
    ]);
  });

  test("create allows omitting sport and rejects unknown tags", async () => {
    const { create } = setup();
    const omitted = await create.execute({
      userId: "user-a",
      name: "City League",
      city: "Durban",
    });
    expect(omitted.community.sport).toBeNull();

    await expect(
      create.execute({
        userId: "user-a",
        name: "City League",
        city: "Durban",
        sport: "darts",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("join is idempotent and member count is derived from memberships", async () => {
    const { create, join, get } = setup();
    const created = await create.execute({
      userId: "user-a",
      name: "Multi Sport Sundays",
      city: "Joburg",
      sport: "multi",
    });

    const joined = await join.execute({
      userId: "user-b",
      communityId: created.community.id,
    });
    expect(joined.community.memberCount).toBe(2);
    expect(joined.community.joined).toBe(true);
    expect(joined.community.role).toBe("member");
    expect(joined.community.members.map((row) => row.handle)).toEqual([
      "alex",
      "blake",
    ]);

    const again = await join.execute({
      userId: "user-b",
      communityId: created.community.id,
    });
    expect(again.community.memberCount).toBe(2);

    const detail = await get.execute({ communityId: created.community.id });
    expect(detail.community.memberCount).toBe(2);
    expect(detail.community.joined).toBe(false);
    expect(detail.community.role).toBeNull();
  });

  test("leave removes a member and blocks the sole owner", async () => {
    const { create, join, leave, me } = setup();
    const created = await create.execute({
      userId: "user-a",
      name: "Thursday League",
      city: "Pretoria",
    });

    await expect(
      leave.execute({ userId: "user-a", communityId: created.community.id }),
    ).rejects.toBeInstanceOf(SoleOwnerLeaveError);

    await join.execute({
      userId: "user-b",
      communityId: created.community.id,
    });
    await leave.execute({
      userId: "user-b",
      communityId: created.community.id,
    });

    const listed = await me.execute({ userId: "user-b" });
    expect(listed.communities).toEqual([]);

    await expect(
      leave.execute({ userId: "user-b", communityId: created.community.id }),
    ).rejects.toBeInstanceOf(CommunityMembershipNotFoundError);

    await expect(
      leave.execute({ userId: "user-a", communityId: created.community.id }),
    ).rejects.toBeInstanceOf(SoleOwnerLeaveError);
  });

  test("list is newest first and me returns only memberships", async () => {
    const { create, join, list, me } = setup();
    const first = await create.execute({
      userId: "user-a",
      name: "Older League",
      city: "Cape Town",
    });
    const second = await create.execute({
      userId: "user-a",
      name: "Newer League",
      city: "Cape Town",
    });
    await join.execute({ userId: "user-b", communityId: first.community.id });

    const listed = await list.execute({ userId: "user-b" });
    expect(listed.communities.map((row) => row.name)).toEqual([
      "Newer League",
      "Older League",
    ]);
    expect(listed.communities[0]).toMatchObject({
      name: "Newer League",
      joined: false,
      role: null,
    });
    expect(listed.communities[1]).toMatchObject({
      name: "Older League",
      joined: true,
      role: "member",
      memberCount: 2,
    });

    const mine = await me.execute({ userId: "user-b" });
    expect(mine.communities).toHaveLength(1);
    expect(mine.communities[0]).toMatchObject({
      id: first.community.id,
      role: "member",
      joined: true,
    });
    expect(mine.communities[0]?.joinedAt).toEqual(expect.any(String));
  });

  test("get and join fail for unknown communities", async () => {
    const { get, join } = setup();
    await expect(
      get.execute({ communityId: "missing" }),
    ).rejects.toBeInstanceOf(CommunityNotFoundError);
    await expect(
      join.execute({ userId: "user-b", communityId: "missing" }),
    ).rejects.toBeInstanceOf(CommunityNotFoundError);
  });
});
