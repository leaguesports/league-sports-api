import { randomUUID } from "node:crypto";

import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { CompletedStepIds } from "./completed-step-ids";
import { EnrollmentStatus } from "./enrollment-status";
import { PercentComplete } from "./percent-complete";
import { TrainingEnrollmentCompletedError } from "./training-enrollment-completed-error";
import { TrainingPlan } from "./training-plan";
import { TrainingPlanId } from "./training-plan-id";

export type TrainingEnrollmentSnapshot = {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "completed";
  completedStepIds: string[];
  percentComplete: number;
  currentStepIndex: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export class TrainingEnrollment {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly planId: TrainingPlanId,
    readonly startedAt: Date,
    private statusValue: EnrollmentStatus,
    private completedStepIdsValue: CompletedStepIds,
    private percentCompleteValue: PercentComplete,
    private currentStepIndexValue: number,
    private updatedAtValue: Date,
    private completedAtValue: Date | null,
  ) {}

  static start(userId: string, plan: TrainingPlan): TrainingEnrollment {
    const now = new Date();
    return new TrainingEnrollment(
      randomUUID(),
      requiredTrimmed(userId, "userId"),
      plan.id,
      now,
      EnrollmentStatus.ACTIVE,
      CompletedStepIds.empty(),
      PercentComplete.ZERO,
      0,
      now,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    userId: string;
    planId: TrainingPlanId;
    status: EnrollmentStatus;
    completedStepIds: CompletedStepIds;
    percentComplete: PercentComplete;
    currentStepIndex: number;
    startedAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }): TrainingEnrollment {
    return new TrainingEnrollment(
      props.id,
      props.userId,
      props.planId,
      props.startedAt,
      props.status,
      props.completedStepIds,
      props.percentComplete,
      props.currentStepIndex,
      props.updatedAt,
      props.completedAt,
    );
  }

  static fromSnapshot(
    snapshot: TrainingEnrollmentSnapshot,
    plan: TrainingPlan,
  ): TrainingEnrollment {
    if (snapshot.planId !== plan.id.value) {
      throw new DomainError("enrollment planId does not match catalog plan");
    }

    return TrainingEnrollment.rehydrate({
      id: snapshot.id,
      userId: snapshot.userId,
      planId: TrainingPlanId.from(snapshot.planId),
      status: EnrollmentStatus.from(snapshot.status),
      completedStepIds: CompletedStepIds.from(snapshot.completedStepIds, plan),
      percentComplete: PercentComplete.from(snapshot.percentComplete),
      currentStepIndex: snapshot.currentStepIndex,
      startedAt: new Date(snapshot.startedAt),
      updatedAt: new Date(snapshot.updatedAt),
      completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
    });
  }

  get status(): EnrollmentStatus {
    return this.statusValue;
  }

  get completedStepIds(): readonly string[] {
    return this.completedStepIdsValue.values;
  }

  get percentComplete(): number {
    return this.percentCompleteValue.value;
  }

  get currentStepIndex(): number {
    return this.currentStepIndexValue;
  }

  get updatedAt(): Date {
    return this.updatedAtValue;
  }

  get completedAt(): Date | null {
    return this.completedAtValue;
  }

  get isCompleted(): boolean {
    return this.statusValue.isCompleted;
  }

  belongsTo(userId: string): boolean {
    return this.userId === userId.trim();
  }

  advanceByCompletedSteps(rawIds: unknown, plan: TrainingPlan): void {
    this.assertPlan(plan);
    const incoming = CompletedStepIds.from(rawIds, plan);
    this.applyProgress(this.completedStepIdsValue.union(incoming, plan), plan);
  }

  advanceByPercent(rawPercent: unknown, plan: TrainingPlan): void {
    this.assertPlan(plan);
    const percent = PercentComplete.from(rawPercent);
    if (percent.isLessThan(this.percentCompleteValue)) {
      if (this.statusValue.isCompleted) {
        throw new TrainingEnrollmentCompletedError();
      }
      throw new DomainError("percentComplete cannot decrease");
    }
    const incoming = CompletedStepIds.prefixForPercent(percent, plan);
    this.applyProgress(this.completedStepIdsValue.union(incoming, plan), plan);
  }

  toSnapshot(): TrainingEnrollmentSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      planId: this.planId.value,
      status: this.statusValue.value,
      completedStepIds: [...this.completedStepIdsValue.values],
      percentComplete: this.percentCompleteValue.value,
      currentStepIndex: this.currentStepIndexValue,
      startedAt: this.startedAt.toISOString(),
      updatedAt: this.updatedAtValue.toISOString(),
      completedAt: this.completedAtValue
        ? this.completedAtValue.toISOString()
        : null,
    };
  }

  private applyProgress(completed: CompletedStepIds, plan: TrainingPlan): void {
    const percent = completed.toPercent(plan);
    const currentStepIndex = completed.currentStepIndex(plan);
    const done = completed.isComplete(plan) || percent.isComplete;

    if (this.statusValue.isCompleted) {
      if (done) {
        return;
      }
      throw new TrainingEnrollmentCompletedError();
    }

    const unchanged =
      this.listsEqual(this.completedStepIdsValue.values, completed.values) &&
      this.percentCompleteValue.value === percent.value &&
      this.currentStepIndexValue === currentStepIndex;
    if (unchanged) {
      return;
    }

    this.completedStepIdsValue = completed;
    this.percentCompleteValue = done ? PercentComplete.HUNDRED : percent;
    this.currentStepIndexValue = done ? plan.stepCount : currentStepIndex;
    this.updatedAtValue = new Date();

    if (done) {
      this.statusValue = EnrollmentStatus.COMPLETED;
      this.completedAtValue = this.updatedAtValue;
    }
  }

  private assertPlan(plan: TrainingPlan): void {
    if (!this.planId.equals(plan.id)) {
      throw new DomainError("enrollment planId does not match catalog plan");
    }
  }

  private listsEqual(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((id, index) => id === right[index]);
  }
}
