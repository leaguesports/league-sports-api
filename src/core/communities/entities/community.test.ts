import { DomainError } from "../../../lib/domain-error";
import { City } from "./city";
import { Community } from "./community";
import { CommunityMemberRole } from "./community-member-role";
import { CommunityMembershipNotFoundError } from "./community-membership-not-found-error";
import { CommunityName } from "./community-name";
import { CommunitySport } from "./community-sport";
import { SoleOwnerLeaveError } from "./sole-owner-leave-error";

function createSundayBeers() {
  return Community.create({
    name: CommunityName.from("  Sunday Beers  "),
    city: City.from("Cape Town"),
    sport: CommunitySport.from("Padel"),
    ownerUserId: "user-a",
  });
}

describe("community value objects", () => {
  test.each([
    ["name", (value: unknown) => CommunityName.from(value)],
    ["city", (value: unknown) => City.from(value)],
  ])("rejects missing %s", (_field, create) => {
    expect(() => create(undefined)).toThrow(DomainError);
    expect(() => create("")).toThrow(DomainError);
    expect(() => create("   ")).toThrow(DomainError);
  });

  test("trims name and city and caps length", () => {
    expect(CommunityName.from("  Sunday Beers  ").value).toBe("Sunday Beers");
    expect(City.from("  Cape Town  ").value).toBe("Cape Town");
    expect(() => CommunityName.from("x".repeat(81))).toThrow(DomainError);
    expect(() => City.from("x".repeat(81))).toThrow(DomainError);
  });

  test("sport allows padel, multi, or omit", () => {
    expect(CommunitySport.from("Padel")?.value).toBe("padel");
    expect(CommunitySport.from("multi")?.value).toBe("multi");
    expect(CommunitySport.from(null)).toBeNull();
    expect(CommunitySport.from("  ")).toBeNull();
    expect(() => CommunitySport.from("darts")).toThrow(DomainError);
  });

  test("role is owner or member", () => {
    expect(CommunityMemberRole.from("owner").isOwner).toBe(true);
    expect(CommunityMemberRole.from("member").isOwner).toBe(false);
    expect(() => CommunityMemberRole.from("admin")).toThrow(DomainError);
  });
});

describe(Community, () => {
  test("create mints the owner membership and no other owners", () => {
    const community = createSundayBeers();
    const snapshot = community.toSnapshot();

    expect(community.id).toBeTruthy();
    expect(snapshot).toMatchObject({
      name: "Sunday Beers",
      city: "Cape Town",
      sport: "padel",
    });
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.members[0]).toMatchObject({
      userId: "user-a",
      role: "owner",
    });
    expect(community.memberCount).toBe(1);
  });

  test("join is idempotent and always adds member, never owner", () => {
    const community = createSundayBeers();
    community.join("user-b");
    community.join("  user-b  ");

    expect(community.memberCount).toBe(2);
    expect(community.membershipOf("user-b")?.role).toBe(
      CommunityMemberRole.MEMBER,
    );
    expect(
      community.members.filter((member) => member.role.isOwner),
    ).toHaveLength(1);
  });

  test("leave removes a member", () => {
    const community = createSundayBeers();
    community.join("user-b");
    community.leave("user-b");

    expect(community.membershipOf("user-b")).toBeNull();
    expect(community.memberCount).toBe(1);
    expect(community.removedUserIds).toEqual(["user-b"]);
  });

  test("sole owner cannot leave", () => {
    const community = createSundayBeers();
    community.join("user-b");

    expect(() => community.leave("user-a")).toThrow(SoleOwnerLeaveError);
    expect(community.membershipOf("user-a")?.role.isOwner).toBe(true);
  });

  test("leave when not a member is a domain error", () => {
    const community = createSundayBeers();
    expect(() => community.leave("user-b")).toThrow(
      CommunityMembershipNotFoundError,
    );
  });

  test("rehydrate + snapshot round-trips memberships", () => {
    const created = createSundayBeers();
    created.join("user-b");
    const restored = Community.fromSnapshot(created.toSnapshot());

    expect(restored.toSnapshot()).toEqual(created.toSnapshot());
    expect(restored.removedUserIds).toEqual([]);
  });
});
