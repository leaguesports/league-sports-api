import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { Area } from "./area";
import { City } from "./city";
import { LobbyForbiddenError } from "./lobby-forbidden-error";
import { LobbyProposalMember } from "./lobby-proposal-member";
import { LobbyProposalResponse } from "./lobby-proposal-response";
import { LobbyProposalStatus } from "./lobby-proposal-status";
import { LobbySkill } from "./lobby-skill";
import { LobbySport } from "./lobby-sport";
import { PartySize } from "./party-size";
import { TimeWindow } from "./time-window";

export type LobbyProposalSnapshot = {
  id: string;
  sport: "padel" | "darts" | "golf";
  city: string;
  area: string | null;
  windowStart: string;
  windowEnd: string;
  venueCmsId: string | null;
  skill: "casual" | "intermediate" | "competitive" | null;
  status: "pending" | "accepted" | "expired" | "cancelled";
  organiseGameId: string | null;
  createdAt: string;
  updatedAt: string;
  members: ReturnType<LobbyProposalMember["toSnapshot"]>[];
};

export type CreateLobbyProposalProps = {
  sport: LobbySport;
  city: City;
  area: Area | null;
  window: TimeWindow;
  venueCmsId: string | null;
  skill: LobbySkill | null;
  members: Array<{
    userId: string;
    partySize: PartySize;
    lookingId?: string | null;
  }>;
  now?: Date;
};

export class LobbyProposal {
  private constructor(
    readonly id: string,
    readonly sport: LobbySport,
    readonly city: City,
    readonly area: Area | null,
    readonly window: TimeWindow,
    readonly venueCmsId: string | null,
    readonly skill: LobbySkill | null,
    private statusValue: LobbyProposalStatus,
    private organiseGameIdValue: string | null,
    readonly createdAt: Date,
    private updatedAtValue: Date,
    private membersValue: LobbyProposalMember[],
  ) {}

  static create(props: CreateLobbyProposalProps): LobbyProposal {
    const now = props.now ?? new Date();
    if (props.members.length < 2) {
      throw new DomainError("proposal needs at least two parties");
    }

    const members = props.members.map((member) =>
      LobbyProposalMember.create({
        userId: member.userId,
        partySize: member.partySize,
        lookingId: member.lookingId,
        now,
      }),
    );

    return new LobbyProposal(
      randomUUID(),
      props.sport,
      props.city,
      props.area,
      props.window,
      props.venueCmsId,
      props.skill,
      LobbyProposalStatus.PENDING,
      null,
      now,
      now,
      members,
    );
  }

  static rehydrate(props: {
    id: string;
    sport: LobbySport;
    city: City;
    area: Area | null;
    window: TimeWindow;
    venueCmsId: string | null;
    skill: LobbySkill | null;
    status: LobbyProposalStatus;
    organiseGameId: string | null;
    createdAt: Date;
    updatedAt: Date;
    members: LobbyProposalMember[];
  }): LobbyProposal {
    return new LobbyProposal(
      props.id,
      props.sport,
      props.city,
      props.area,
      props.window,
      props.venueCmsId,
      props.skill,
      props.status,
      props.organiseGameId,
      props.createdAt,
      props.updatedAt,
      [...props.members],
    );
  }

  static fromSnapshot(snapshot: LobbyProposalSnapshot): LobbyProposal {
    return LobbyProposal.rehydrate({
      id: snapshot.id,
      sport: LobbySport.from(snapshot.sport),
      city: City.from(snapshot.city),
      area: Area.from(snapshot.area),
      window: TimeWindow.from(snapshot.windowStart, snapshot.windowEnd),
      venueCmsId: snapshot.venueCmsId,
      skill: LobbySkill.from(snapshot.skill),
      status: LobbyProposalStatus.from(snapshot.status),
      organiseGameId: snapshot.organiseGameId,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      members: snapshot.members.map((member) =>
        LobbyProposalMember.rehydrate({
          id: member.id,
          userId: member.userId,
          partySize: PartySize.from(member.partySize),
          response: LobbyProposalResponse.from(member.response),
          lookingId: member.lookingId,
          createdAt: new Date(member.createdAt),
          respondedAt: member.respondedAt
            ? new Date(member.respondedAt)
            : null,
        }),
      ),
    });
  }

  get status(): LobbyProposalStatus {
    return this.statusValue;
  }

  get organiseGameId(): string | null {
    return this.organiseGameIdValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get members(): readonly LobbyProposalMember[] {
    return this.membersValue;
  }

  organizerUserId(): string {
    return this.membersValue[0]?.userId ?? "";
  }

  memberOf(userId: string): LobbyProposalMember | null {
    const id = userId.trim();
    return this.membersValue.find((member) => member.userId === id) ?? null;
  }

  isMember(userId: string): boolean {
    return this.memberOf(userId) != null;
  }

  acceptedSlots(): number {
    return this.membersValue
      .filter((member) => member.response.isAccept)
      .reduce((sum, member) => sum + member.partySize.value, 0);
  }

  remainingActiveSlots(): number {
    return this.membersValue
      .filter((member) => !member.response.isPass)
      .reduce((sum, member) => sum + member.partySize.value, 0);
  }

  hasPending(): boolean {
    return this.membersValue.some((member) => member.response.isPending);
  }

  isReadyToConvert(): boolean {
    if (!this.statusValue.isPending) return false;
    if (this.hasPending()) return false;
    return this.acceptedSlots() >= this.sport.minSlots();
  }

  accept(userId: string, now = new Date()): void {
    this.respond(userId, LobbyProposalResponse.ACCEPT, now);
    if (this.isReadyToConvert()) {
      this.statusValue = LobbyProposalStatus.ACCEPTED;
    }
  }

  pass(userId: string, now = new Date()): void {
    this.respond(userId, LobbyProposalResponse.PASS, now);
    if (this.remainingActiveSlots() < this.sport.minSlots()) {
      this.statusValue = LobbyProposalStatus.CANCELLED;
    }
  }

  cancel(now = new Date()): void {
    if (!this.statusValue.isPending) return;
    this.statusValue = LobbyProposalStatus.CANCELLED;
    this.touch(now);
  }

  expire(now = new Date()): void {
    if (!this.statusValue.isPending) return;
    this.statusValue = LobbyProposalStatus.EXPIRED;
    this.touch(now);
  }

  linkOrganisedGame(organiseGameId: string, now = new Date()): void {
    this.organiseGameIdValue = requiredTrimmed(organiseGameId, "organiseGameId");
    this.statusValue = LobbyProposalStatus.ACCEPTED;
    this.touch(now);
  }

  toSnapshot(): LobbyProposalSnapshot {
    return {
      id: this.id,
      sport: this.sport.value,
      city: this.city.value,
      area: this.area?.value ?? null,
      windowStart: this.window.start.toISOString(),
      windowEnd: this.window.end.toISOString(),
      venueCmsId: this.venueCmsId,
      skill: this.skill?.value ?? null,
      status: this.statusValue.value,
      organiseGameId: this.organiseGameIdValue,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      members: this.membersValue.map((member) => member.toSnapshot()),
    };
  }

  private respond(
    userId: string,
    response: LobbyProposalResponse,
    now: Date,
  ): void {
    if (!this.statusValue.isPending) {
      throw new DomainError("Proposal is no longer pending");
    }
    const member = this.memberOf(userId);
    if (!member) {
      throw new LobbyForbiddenError("Only a proposal member can respond");
    }
    if (!member.response.isPending) {
      throw new DomainError("Already responded to this proposal");
    }
    member.setResponse(response, now);
    this.touch(now);
  }

  private touch(now: Date): void {
    this.updatedAtValue = now;
  }
}
