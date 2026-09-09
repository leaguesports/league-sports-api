import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { InviteToken } from "./invite-token";
import { OrganisedGameCapacity } from "./organised-game-capacity";
import { OrganisedGameCapacityError } from "./organised-game-capacity-error";
import { OrganisedGameForbiddenError } from "./organised-game-forbidden-error";
import { OrganisedGameInvite } from "./organised-game-invite";
import { OrganisedGameNotOpenError } from "./organised-game-not-open-error";
import { OrganisedGameNotes } from "./organised-game-notes";
import { OrganisedGameRsvp } from "./organised-game-rsvp";
import { OrganisedGameSport } from "./organised-game-sport";
import { OrganisedGameStartWindowError } from "./organised-game-start-window-error";
import { OrganisedGameStatus } from "./organised-game-status";
import { StartsAt } from "./starts-at";

/** Host may start from 12 hours before `startsAt` until 24 hours after. */
export const START_WINDOW_BEFORE_MS = 12 * 60 * 60 * 1000;
export const START_WINDOW_AFTER_MS = 24 * 60 * 60 * 1000;

export type LiveScorecardSnapshot = {
  id: string;
  path: string;
};

export type OrganisedGameSnapshot = {
  id: string;
  hostUserId: string;
  sport: "padel" | "golf";
  status: "open" | "started" | "cancelled";
  venueCmsId: string;
  startsAt: string;
  notes: string | null;
  capacity: number;
  inviteToken: string;
  live: LiveScorecardSnapshot | null;
  createdAt: string;
  updatedAt: string;
  invites: ReturnType<OrganisedGameInvite["toSnapshot"]>[];
};

export type CreateOrganisedGameProps = {
  hostUserId: string;
  sport: OrganisedGameSport;
  venueCmsId: CmsId;
  startsAt: StartsAt;
  notes: OrganisedGameNotes | null;
  capacity: OrganisedGameCapacity;
};

export class OrganisedGame {
  private constructor(
    readonly id: string,
    readonly hostUserId: string,
    readonly sport: OrganisedGameSport,
    private statusValue: OrganisedGameStatus,
    readonly venueCmsId: CmsId,
    readonly startsAt: StartsAt,
    readonly notes: OrganisedGameNotes | null,
    readonly capacity: OrganisedGameCapacity,
    readonly inviteToken: InviteToken,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private liveScorecardIdValue: string | null,
    private livePathValue: string | null,
    private invitesValue: OrganisedGameInvite[],
  ) {}

  static create(props: CreateOrganisedGameProps): OrganisedGame {
    const hostUserId = requiredTrimmed(props.hostUserId, "userId");
    const now = new Date();
    return new OrganisedGame(
      randomUUID(),
      hostUserId,
      props.sport,
      OrganisedGameStatus.OPEN,
      props.venueCmsId,
      props.startsAt,
      props.notes,
      props.capacity,
      InviteToken.generate(),
      now,
      now,
      null,
      null,
      [],
    );
  }

  static rehydrate(props: {
    id: string;
    hostUserId: string;
    sport: OrganisedGameSport;
    status: OrganisedGameStatus;
    venueCmsId: CmsId;
    startsAt: StartsAt;
    notes: OrganisedGameNotes | null;
    capacity: OrganisedGameCapacity;
    inviteToken: InviteToken;
    createdAt: Date;
    updatedAt: Date;
    liveScorecardId: string | null;
    livePath: string | null;
    invites: OrganisedGameInvite[];
  }): OrganisedGame {
    return new OrganisedGame(
      props.id,
      props.hostUserId,
      props.sport,
      props.status,
      props.venueCmsId,
      props.startsAt,
      props.notes,
      props.capacity,
      props.inviteToken,
      props.createdAt,
      props.updatedAt,
      props.liveScorecardId,
      props.livePath,
      [...props.invites],
    );
  }

  static fromSnapshot(snapshot: OrganisedGameSnapshot): OrganisedGame {
    return OrganisedGame.rehydrate({
      id: snapshot.id,
      hostUserId: snapshot.hostUserId,
      sport: OrganisedGameSport.from(snapshot.sport),
      status: OrganisedGameStatus.from(snapshot.status),
      venueCmsId: CmsId.from(snapshot.venueCmsId),
      startsAt: StartsAt.from(snapshot.startsAt),
      notes: OrganisedGameNotes.from(snapshot.notes),
      capacity: OrganisedGameCapacity.from(
        snapshot.capacity,
        snapshot.capacity,
      ),
      inviteToken: InviteToken.from(snapshot.inviteToken),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      liveScorecardId: snapshot.live?.id ?? null,
      livePath: snapshot.live?.path ?? null,
      invites: snapshot.invites.map((invite) =>
        OrganisedGameInvite.rehydrate({
          id: invite.id,
          userId: invite.userId,
          rsvp: OrganisedGameRsvp.from(invite.rsvp),
          invitedAt: new Date(invite.invitedAt),
          respondedAt: invite.respondedAt ? new Date(invite.respondedAt) : null,
        }),
      ),
    });
  }

  get status(): OrganisedGameStatus {
    return this.statusValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get invites(): readonly OrganisedGameInvite[] {
    return this.invitesValue;
  }

  get live(): LiveScorecardSnapshot | null {
    if (!this.liveScorecardIdValue || !this.livePathValue) return null;
    return { id: this.liveScorecardIdValue, path: this.livePathValue };
  }

  isHost(userId: string): boolean {
    return this.hostUserId === userId.trim();
  }

  inviteOf(userId: string): OrganisedGameInvite | null {
    const id = userId.trim();
    return this.invitesValue.find((invite) => invite.userId === id) ?? null;
  }

  isParticipant(userId: string): boolean {
    return this.isHost(userId) || this.inviteOf(userId) != null;
  }

  /** Host + non-declined invitees. */
  occupiedCount(): number {
    const inviteSlots = this.invitesValue.filter((invite) =>
      invite.rsvp.occupiesSlot,
    ).length;
    return 1 + inviteSlots;
  }

  isAtCapacity(): boolean {
    return this.occupiedCount() >= this.capacity.value;
  }

  acceptedInvitees(): OrganisedGameInvite[] {
    return this.invitesValue.filter((invite) => invite.rsvp.isAccepted);
  }

  isWithinStartWindow(now = new Date()): boolean {
    const start = this.startsAt.value.getTime();
    const t = now.getTime();
    return (
      t >= start - START_WINDOW_BEFORE_MS && t <= start + START_WINDOW_AFTER_MS
    );
  }

  addInvitee(userId: string, now = new Date()): OrganisedGameInvite {
    const id = requiredTrimmed(userId, "userId");
    if (id === this.hostUserId) {
      throw new DomainError("Host cannot be invited as an invitee");
    }
    if (!this.statusValue.isOpen) {
      throw new OrganisedGameNotOpenError();
    }

    const existing = this.inviteOf(id);
    if (existing) return existing;

    if (this.isAtCapacity()) {
      throw new OrganisedGameCapacityError();
    }

    const invite = OrganisedGameInvite.pending(id, now);
    this.invitesValue = [...this.invitesValue, invite];
    this.touch(now);
    return invite;
  }

  rsvp(userId: string, decision: OrganisedGameRsvp, now = new Date()): void {
    const id = requiredTrimmed(userId, "userId");
    if (!this.statusValue.isOpen) {
      throw new OrganisedGameNotOpenError();
    }

    const invite = this.inviteOf(id);
    if (!invite) {
      throw new OrganisedGameForbiddenError(
        "Only an invitee can RSVP this organised game",
      );
    }

    invite.setRsvp(decision, now);
    this.touch(now);
  }

  start(live: LiveScorecardSnapshot, now = new Date()): void {
    if (this.statusValue.isStarted && this.live) {
      return;
    }
    if (!this.statusValue.isOpen) {
      throw new OrganisedGameNotOpenError();
    }
    if (!this.isWithinStartWindow(now)) {
      throw new OrganisedGameStartWindowError();
    }

    const id = requiredTrimmed(live.id, "liveScorecardId");
    const path = requiredTrimmed(live.path, "livePath");
    this.statusValue = OrganisedGameStatus.STARTED;
    this.liveScorecardIdValue = id;
    this.livePathValue = path;
    this.touch(now);
  }

  cancel(now = new Date()): void {
    if (!this.statusValue.isOpen) {
      throw new OrganisedGameNotOpenError();
    }
    this.statusValue = OrganisedGameStatus.CANCELLED;
    this.touch(now);
  }

  toSnapshot(): OrganisedGameSnapshot {
    return {
      id: this.id,
      hostUserId: this.hostUserId,
      sport: this.sport.value,
      status: this.statusValue.value,
      venueCmsId: this.venueCmsId.value,
      startsAt: this.startsAt.toIsoString(),
      notes: this.notes?.value ?? null,
      capacity: this.capacity.value,
      inviteToken: this.inviteToken.value,
      live: this.live,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      invites: this.invitesValue.map((invite) => invite.toSnapshot()),
    };
  }

  private touch(now: Date): void {
    this.updatedAtValue = now;
  }
}
