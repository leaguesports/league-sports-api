import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { GolfTourCampName } from "./golf-tour-camp-name";
import { GolfTourRosterMember } from "./golf-tour-roster-member";
import { GolfTourRosterMemberNotFoundError } from "./golf-tour-roster-member-not-found-error";

const COLOR_MAX_LENGTH = 32;

export type GolfTourCampSnapshot = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  roster: ReturnType<GolfTourRosterMember["toSnapshot"]>[];
};

export class GolfTourCamp {
  private constructor(
    readonly id: string,
    private nameValue: GolfTourCampName,
    private colorValue: string | null,
    readonly sortOrder: number,
    private rosterValue: GolfTourRosterMember[],
  ) {}

  static create(props: {
    id: string;
    name: GolfTourCampName;
    color?: string | null;
    sortOrder: number;
    roster?: GolfTourRosterMember[];
  }): GolfTourCamp {
    return new GolfTourCamp(
      props.id,
      props.name,
      parseColor(props.color),
      props.sortOrder,
      props.roster ?? [],
    );
  }

  static rehydrate(props: {
    id: string;
    name: GolfTourCampName;
    color: string | null;
    sortOrder: number;
    roster?: GolfTourRosterMember[];
  }): GolfTourCamp {
    return new GolfTourCamp(
      props.id,
      props.name,
      props.color,
      props.sortOrder,
      [...(props.roster ?? [])],
    );
  }

  static fromSnapshot(snapshot: GolfTourCampSnapshot): GolfTourCamp {
    return GolfTourCamp.rehydrate({
      id: snapshot.id,
      name: GolfTourCampName.from(snapshot.name),
      color: snapshot.color,
      sortOrder: snapshot.sortOrder,
      roster: (snapshot.roster ?? []).map((member) =>
        GolfTourRosterMember.fromSnapshot(member),
      ),
    });
  }

  get name(): GolfTourCampName {
    return this.nameValue;
  }

  get color(): string | null {
    return this.colorValue;
  }

  get roster(): readonly GolfTourRosterMember[] {
    return this.rosterValue;
  }

  rosterMemberById(memberId: string): GolfTourRosterMember | null {
    return this.rosterValue.find((member) => member.id === memberId) ?? null;
  }

  hasPlayerUserId(userId: string): boolean {
    return this.rosterValue.some((member) => member.hasUserId(userId));
  }

  rename(details: { name?: GolfTourCampName; color?: string | null }): void {
    if (details.name) this.nameValue = details.name;
    if ("color" in details) this.colorValue = parseColor(details.color);
  }

  addMember(member: GolfTourRosterMember): void {
    assertUniqueRosterMember(this.rosterValue, member);
    this.rosterValue = [...this.rosterValue, member];
  }

  updateMember(
    memberId: string,
    details: {
      userId?: string | null;
      displayName?: unknown;
      isGuest?: unknown;
    },
  ): GolfTourRosterMember {
    const member = this.requireMember(memberId);
    member.update(details);
    assertUniqueRosterMember(
      this.rosterValue.filter((row) => row.id !== member.id),
      member,
    );
    return member;
  }

  removeMember(memberId: string): GolfTourRosterMember {
    const member = this.requireMember(memberId);
    this.rosterValue = this.rosterValue.filter((row) => row.id !== member.id);
    return member;
  }

  toSnapshot(): GolfTourCampSnapshot {
    return {
      id: this.id,
      name: this.nameValue.value,
      color: this.colorValue,
      sortOrder: this.sortOrder,
      roster: this.rosterValue.map((member) => member.toSnapshot()),
    };
  }

  private requireMember(memberId: string): GolfTourRosterMember {
    const member = this.rosterMemberById(memberId.trim());
    if (!member) throw new GolfTourRosterMemberNotFoundError();
    return member;
  }
}

function assertUniqueRosterMember(
  existing: readonly GolfTourRosterMember[],
  member: GolfTourRosterMember,
): void {
  if (existing.some((row) => row.identityKey === member.identityKey)) {
    throw new DomainError("That player is already on this camp roster");
  }
}

export function parseColor(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const value = requiredTrimmed(raw, "color");
  if (value.length > COLOR_MAX_LENGTH) {
    throw new DomainError(`color must be at most ${COLOR_MAX_LENGTH} characters`);
  }
  return value;
}
