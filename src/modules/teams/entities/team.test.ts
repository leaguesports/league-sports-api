import { DomainError } from "../../../lib/domain-error";
import { HomeVenueCmsId } from "./home-venue-cms-id";
import { Team } from "./team";
import { TeamForbiddenError } from "./team-forbidden-error";
import { TeamInviteLinkNotFoundError } from "./team-invite-link-not-found-error";
import { TeamInviteToken } from "./team-invite-token";
import { TeamMemberRole } from "./team-member-role";
import { TeamMemberStatus } from "./team-member-status";
import { TeamMembershipNotFoundError } from "./team-membership-not-found-error";
import { TeamName } from "./team-name";
import { TeamOwnerLeaveError } from "./team-owner-leave-error";
import { TeamSport } from "./team-sport";

function createSmash() {
  return Team.create({
    name: TeamName.from("  Sunday Smash  "),
    sport: TeamSport.from("Padel"),
    createdBy: "user-a",
    homeVenueCmsId: HomeVenueCmsId.from("sanity-court-1"),
  });
}

describe("team value objects", () => {
  test("trims name and caps length", () => {
    expect(TeamName.from("  Sunday Smash  ").value).toBe("Sunday Smash");
    expect(() => TeamName.from("")).toThrow(DomainError);
    expect(() => TeamName.from("x".repeat(81))).toThrow(DomainError);
  });

  test("sport is padel, golf, or darts", () => {
    expect(TeamSport.from("Padel").value).toBe("padel");
    expect(TeamSport.from("golf").value).toBe("golf");
    expect(TeamSport.from("DARTS").value).toBe("darts");
    expect(() => TeamSport.from("tennis")).toThrow(DomainError);
  });

  test("role and status are closed enums", () => {
    expect(TeamMemberRole.from("owner").isOwner).toBe(true);
    expect(TeamMemberRole.from("captain").canInvite).toBe(true);
    expect(TeamMemberRole.from("member").canInvite).toBe(false);
    expect(() => TeamMemberRole.from("admin")).toThrow(DomainError);
    expect(TeamMemberStatus.from("active").isActive).toBe(true);
    expect(TeamMemberStatus.from("invited").isInvited).toBe(true);
    expect(() => TeamMemberStatus.from("pending")).toThrow(DomainError);
  });

  test("home venue cms id is optional", () => {
    expect(HomeVenueCmsId.from(null)).toBeNull();
    expect(HomeVenueCmsId.from("  ")).toBeNull();
    expect(HomeVenueCmsId.from("venue-1")?.value).toBe("venue-1");
  });
});

describe(Team, () => {
  test("create mints exactly one owner membership", () => {
    const team = createSmash();
    const snapshot = team.toSnapshot();

    expect(snapshot).toMatchObject({
      name: "Sunday Smash",
      sport: "padel",
      homeVenueCmsId: "sanity-court-1",
      createdBy: "user-a",
    });
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.members[0]).toMatchObject({
      userId: "user-a",
      role: "owner",
      status: "active",
    });
    expect(team.memberCount).toBe(1);
    expect(team.owner().userId).toBe("user-a");
  });

  test("owner can edit name, sport, and home venue", () => {
    const team = createSmash();
    team.updateDetails("user-a", {
      name: TeamName.from("Night Smash"),
      sport: TeamSport.from("golf"),
      homeVenueCmsId: null,
    });

    expect(team.toSnapshot()).toMatchObject({
      name: "Night Smash",
      sport: "golf",
      homeVenueCmsId: null,
    });
  });

  test("member cannot edit team details", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    expect(() =>
      team.updateDetails("user-b", { name: TeamName.from("Nope") }),
    ).toThrow(TeamForbiddenError);
  });

  test("friend invite direct-adds an active member and is idempotent", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    team.inviteFriend("user-a", "  user-b  ");

    expect(team.memberCount).toBe(2);
    expect(team.membershipOf("user-b")).toMatchObject({
      role: TeamMemberRole.MEMBER,
      status: TeamMemberStatus.ACTIVE,
    });
    expect(team.members.filter((member) => member.role.isOwner)).toHaveLength(1);
  });

  test("member cannot invite; cannot invite yourself", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");

    expect(() => team.inviteFriend("user-b", "user-c")).toThrow(
      TeamForbiddenError,
    );
    expect(() => team.inviteFriend("user-a", "user-a")).toThrow(DomainError);
  });

  test("owner appoints and removes captains; cannot demote owner via role", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    team.updateMemberRole("user-a", "user-b", TeamMemberRole.CAPTAIN);
    expect(team.membershipOf("user-b")?.role.isCaptain).toBe(true);

    team.updateMemberRole("user-a", "user-b", TeamMemberRole.MEMBER);
    expect(team.membershipOf("user-b")?.role.isMember).toBe(true);

    expect(() =>
      team.updateMemberRole("user-a", "user-a", TeamMemberRole.MEMBER),
    ).toThrow(TeamOwnerLeaveError);
    expect(() =>
      team.updateMemberRole("user-a", "user-b", TeamMemberRole.OWNER),
    ).toThrow(DomainError);
  });

  test("captain can invite and remove members but not the owner", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    team.updateMemberRole("user-a", "user-b", TeamMemberRole.CAPTAIN);
    team.inviteFriend("user-b", "user-c");

    expect(team.membershipOf("user-c")?.role.isMember).toBe(true);
    team.removeMember("user-b", "user-c");
    expect(team.membershipOf("user-c")).toBeNull();
    expect(team.removedUserIds).toEqual(["user-c"]);

    expect(() => team.removeMember("user-b", "user-a")).toThrow(
      TeamForbiddenError,
    );
  });

  test("captain cannot remove another captain", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    team.inviteFriend("user-a", "user-c");
    team.updateMemberRole("user-a", "user-b", TeamMemberRole.CAPTAIN);
    team.updateMemberRole("user-a", "user-c", TeamMemberRole.CAPTAIN);

    expect(() => team.removeMember("user-b", "user-c")).toThrow(
      TeamForbiddenError,
    );
  });

  test("owner can remove a captain; cannot remove the owner", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    team.updateMemberRole("user-a", "user-b", TeamMemberRole.CAPTAIN);
    team.removeMember("user-a", "user-b");
    expect(team.membershipOf("user-b")).toBeNull();

    team.inviteFriend("user-a", "user-c");
    expect(() => team.removeMember("user-a", "user-a")).toThrow(DomainError);
  });

  test("member and captain can leave; owner must transfer first", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    team.inviteFriend("user-a", "user-c");
    team.updateMemberRole("user-a", "user-b", TeamMemberRole.CAPTAIN);

    team.leave("user-c");
    expect(team.membershipOf("user-c")).toBeNull();
    team.leave("user-b");
    expect(team.membershipOf("user-b")).toBeNull();
    expect(() => team.leave("user-a")).toThrow(TeamOwnerLeaveError);
    expect(() => team.leave("user-z")).toThrow(TeamMembershipNotFoundError);
  });

  test("transfer ownership makes former owner a captain", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    team.transferOwnership("user-a", "user-b");

    expect(team.membershipOf("user-b")?.role.isOwner).toBe(true);
    expect(team.membershipOf("user-a")?.role.isCaptain).toBe(true);
    expect(team.members.filter((member) => member.role.isOwner)).toHaveLength(1);

    expect(() => team.transferOwnership("user-a", "user-b")).toThrow(
      TeamForbiddenError,
    );
  });

  test("invite link regenerate revokes the previous token", () => {
    const team = createSmash();
    const first = team.regenerateInviteLink("user-a");
    const second = team.regenerateInviteLink("user-a");

    expect(first.isActive).toBe(false);
    expect(second.isActive).toBe(true);
    expect(team.activeInviteLink()?.token.value).toBe(second.token.value);

    expect(() =>
      team.joinWithToken("user-b", TeamInviteToken.from(first.token.value)),
    ).toThrow(TeamInviteLinkNotFoundError);

    team.joinWithToken("user-b", TeamInviteToken.from(second.token.value));
    expect(team.membershipOf("user-b")?.status.isActive).toBe(true);
    team.joinWithToken("user-b", TeamInviteToken.from(second.token.value));
    expect(team.memberCount).toBe(2);
  });

  test("member cannot create an invite link", () => {
    const team = createSmash();
    team.inviteFriend("user-a", "user-b");
    expect(() => team.regenerateInviteLink("user-b")).toThrow(
      TeamForbiddenError,
    );
  });

  test("non-member cannot view the team", () => {
    const team = createSmash();
    expect(() => team.assertCanView("user-z")).toThrow(TeamForbiddenError);
    team.assertCanView("user-a");
  });

  test("rehydrate + snapshot round-trips memberships and links", () => {
    const created = createSmash();
    created.inviteFriend("user-a", "user-b");
    created.regenerateInviteLink("user-a");
    const restored = Team.fromSnapshot(created.toSnapshot());

    expect(restored.toSnapshot()).toEqual(created.toSnapshot());
    expect(restored.removedUserIds).toEqual([]);
  });
});
