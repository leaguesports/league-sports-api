import { DomainError, requiredTrimmed } from "../../../lib/domain-error";

export type GolfTourRosterMemberSnapshot = {
  id: string;
  campId: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

export type GolfTourRosterMemberInput = {
  userId?: string | null;
  displayName?: unknown;
  isGuest?: unknown;
};

export class GolfTourRosterMember {
  private constructor(
    readonly id: string,
    readonly campId: string,
    private userIdValue: string | null,
    private displayNameValue: string,
    private isGuestValue: boolean,
  ) {}

  static create(props: {
    id: string;
    campId: string;
    userId?: string | null;
    displayName: unknown;
    isGuest: unknown;
  }): GolfTourRosterMember {
    const identity = parseRosterIdentity(props);
    return new GolfTourRosterMember(
      props.id,
      props.campId,
      identity.userId,
      identity.displayName,
      identity.isGuest,
    );
  }

  static rehydrate(props: {
    id: string;
    campId: string;
    userId: string | null;
    displayName: string;
    isGuest: boolean;
  }): GolfTourRosterMember {
    return new GolfTourRosterMember(
      props.id,
      props.campId,
      props.userId,
      props.displayName,
      props.isGuest,
    );
  }

  static fromSnapshot(
    snapshot: GolfTourRosterMemberSnapshot,
  ): GolfTourRosterMember {
    return GolfTourRosterMember.rehydrate(snapshot);
  }

  get userId(): string | null {
    return this.userIdValue;
  }

  get displayName(): string {
    return this.displayNameValue;
  }

  get isGuest(): boolean {
    return this.isGuestValue;
  }

  get identityKey(): string {
    if (!this.isGuestValue && this.userIdValue) {
      return `user:${this.userIdValue}`;
    }
    return `guest:${this.displayNameValue.trim().toLowerCase()}`;
  }

  hasUserId(userId: string): boolean {
    return this.userIdValue === userId;
  }

  update(details: GolfTourRosterMemberInput): void {
    const identity = parseRosterIdentity({
      userId: "userId" in details ? details.userId : this.userIdValue,
      displayName:
        details.displayName === undefined
          ? this.displayNameValue
          : details.displayName,
      isGuest:
        details.isGuest === undefined ? this.isGuestValue : details.isGuest,
    });
    this.userIdValue = identity.userId;
    this.displayNameValue = identity.displayName;
    this.isGuestValue = identity.isGuest;
  }

  toSnapshot(): GolfTourRosterMemberSnapshot {
    return {
      id: this.id,
      campId: this.campId,
      userId: this.userIdValue,
      displayName: this.displayNameValue,
      isGuest: this.isGuestValue,
    };
  }
}

function parseRosterIdentity(input: GolfTourRosterMemberInput): {
  userId: string | null;
  displayName: string;
  isGuest: boolean;
} {
  const displayName = requiredTrimmed(input.displayName, "displayName");
  const isGuest = input.isGuest === true;
  const userId = optionalRosterUserId(input.userId);

  if (isGuest) {
    if (userId !== null) {
      throw new DomainError("A guest roster member cannot have a userId");
    }
    return { userId: null, displayName, isGuest: true };
  }

  if (userId === null) {
    throw new DomainError("A registered roster member requires a userId");
  }
  return { userId, displayName, isGuest: false };
}

function optionalRosterUserId(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new DomainError("userId must be a string");
  }
  const value = raw.trim();
  return value.length === 0 ? null : value;
}
