import { DomainError } from "../../../lib/domain-error";
import { InMemoryFriendProfileLookup } from "../../friends/repositories/in-memory-friend-profile.lookup";
import { InMemoryClubRepository } from "../repositories/in-memory-club.repository";
import {
  ClubMembershipNotFoundError,
  ClubNotFoundError,
  CreateClub,
  GetClub,
  JoinClub,
  LeaveClub,
  ListClubs,
  ListMyClubs,
  SoleOwnerLeaveError,
} from "./clubs.service";

describe("clubs services", () => {
  function setup() {
    const clubs = new InMemoryClubRepository();
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
      clubs,
      profiles,
      create: new CreateClub(clubs, profiles),
      get: new GetClub(clubs, profiles),
      list: new ListClubs(clubs),
      me: new ListMyClubs(clubs),
      join: new JoinClub(clubs, profiles),
      leave: new LeaveClub(clubs),
    };
  }

  test("create makes the session user owner and first member", async () => {
    const { create } = setup();
    const result = await create.execute({
      userId: "user-a",
      name: "  Sea Point Padel  ",
      city: "Cape Town",
      sport: "Padel",
    });

    expect(result.club).toMatchObject({
      name: "Sea Point Padel",
      city: "Cape Town",
      sport: "padel",
      memberCount: 1,
      joined: true,
      role: "owner",
    });
    expect(result.club.members).toEqual([
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
      name: "City Club",
      city: "Durban",
    });
    expect(omitted.club.sport).toBeNull();

    await expect(
      create.execute({
        userId: "user-a",
        name: "City Club",
        city: "Durban",
        sport: "darts",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("join is idempotent and member count is derived from memberships", async () => {
    const { create, join, get } = setup();
    const created = await create.execute({
      userId: "user-a",
      name: "Multi Club",
      city: "Joburg",
      sport: "multi",
    });

    const joined = await join.execute({
      userId: "user-b",
      clubId: created.club.id,
    });
    expect(joined.club.memberCount).toBe(2);
    expect(joined.club.joined).toBe(true);
    expect(joined.club.role).toBe("member");
    expect(joined.club.members.map((row) => row.handle)).toEqual([
      "alex",
      "blake",
    ]);

    const again = await join.execute({
      userId: "user-b",
      clubId: created.club.id,
    });
    expect(again.club.memberCount).toBe(2);

    const detail = await get.execute({ clubId: created.club.id });
    expect(detail.club.memberCount).toBe(2);
    expect(detail.club.joined).toBe(false);
    expect(detail.club.role).toBeNull();
  });

  test("leave removes a member and blocks the sole owner", async () => {
    const { create, join, leave, me } = setup();
    const created = await create.execute({
      userId: "user-a",
      name: "Leave Club",
      city: "Pretoria",
    });

    await expect(
      leave.execute({ userId: "user-a", clubId: created.club.id }),
    ).rejects.toBeInstanceOf(SoleOwnerLeaveError);

    await join.execute({ userId: "user-b", clubId: created.club.id });
    await leave.execute({ userId: "user-b", clubId: created.club.id });

    const listed = await me.execute({ userId: "user-b" });
    expect(listed.clubs).toEqual([]);

    await expect(
      leave.execute({ userId: "user-b", clubId: created.club.id }),
    ).rejects.toBeInstanceOf(ClubMembershipNotFoundError);

    await expect(
      leave.execute({ userId: "user-a", clubId: created.club.id }),
    ).rejects.toBeInstanceOf(SoleOwnerLeaveError);
  });

  test("list is newest first and me returns only memberships", async () => {
    const { create, join, list, me } = setup();
    const first = await create.execute({
      userId: "user-a",
      name: "Older Club",
      city: "Cape Town",
    });
    const second = await create.execute({
      userId: "user-a",
      name: "Newer Club",
      city: "Cape Town",
    });
    await join.execute({ userId: "user-b", clubId: first.club.id });

    const listed = await list.execute({ userId: "user-b" });
    expect(listed.clubs.map((row) => row.name)).toEqual([
      "Newer Club",
      "Older Club",
    ]);
    expect(listed.clubs[0]).toMatchObject({
      name: "Newer Club",
      joined: false,
      role: null,
    });
    expect(listed.clubs[1]).toMatchObject({
      name: "Older Club",
      joined: true,
      role: "member",
      memberCount: 2,
    });

    const mine = await me.execute({ userId: "user-b" });
    expect(mine.clubs).toHaveLength(1);
    expect(mine.clubs[0]).toMatchObject({
      id: first.club.id,
      role: "member",
      joined: true,
    });
    expect(mine.clubs[0]?.joinedAt).toEqual(expect.any(String));
  });

  test("get and join fail for unknown clubs", async () => {
    const { get, join } = setup();
    await expect(get.execute({ clubId: "missing" })).rejects.toBeInstanceOf(
      ClubNotFoundError,
    );
    await expect(
      join.execute({ userId: "user-b", clubId: "missing" }),
    ).rejects.toBeInstanceOf(ClubNotFoundError);
  });
});
