import { DomainError } from "../../../lib/domain-error";
import { TrainingCatalog } from "../catalog/training-catalog";
import { TrainingEnrollment } from "../entities/training-enrollment";
import { TrainingEnrollmentActiveConflictError } from "../entities/training-enrollment-active-conflict-error";
import { InMemoryTrainingEnrollmentRepository } from "../repositories/in-memory-training-enrollment.repository";
import { TrainingPlanId } from "../entities/training-plan-id";
import {
  AdvanceEnrollment,
  CreateEnrollment,
  ListTrainingPlans,
  TrainingEnrollmentCompletedError,
  TrainingEnrollmentNotFoundError,
  TrainingPlanNotFoundError,
} from "./training.service";

class RaceyEnrollmentRepository extends InMemoryTrainingEnrollmentRepository {
  missActiveOnce = false;

  override async findActiveByUserAndPlan(
    userId: string,
    planId: TrainingPlanId,
  ) {
    if (this.missActiveOnce) {
      this.missActiveOnce = false;
      return null;
    }
    return super.findActiveByUserAndPlan(userId, planId);
  }
}

describe("training services", () => {
  function setup() {
    const catalog = TrainingCatalog.padel();
    const enrollments = new InMemoryTrainingEnrollmentRepository(catalog);
    return {
      catalog,
      enrollments,
      list: new ListTrainingPlans(enrollments, catalog),
      create: new CreateEnrollment(enrollments, catalog),
      advance: new AdvanceEnrollment(enrollments, catalog),
    };
  }

  test("list returns the curated catalog and empty enrollments", async () => {
    const { list } = setup();
    const result = await list.execute({ userId: "user-a" });

    expect(result.plans.map((plan) => plan.id)).toEqual([
      "accuracy-focus",
      "consistency-builder",
      "match-intensity",
    ]);
    expect(result.plans[0]).toMatchObject({
      title: "Accuracy Focus",
      sport: "padel",
      focus: "accuracy",
      totalDurationMinutes: 50,
    });
    expect(result.enrollments).toEqual([]);
  });

  test("create starts a plan and resumes the active enrollment", async () => {
    const { create, list } = setup();
    const started = await create.execute({
      userId: "user-a",
      planId: "accuracy-focus",
    });
    expect(started.resumed).toBe(false);
    expect(started.enrollment).toMatchObject({
      planId: "accuracy-focus",
      status: "active",
      percentComplete: 0,
      currentStepIndex: 0,
    });

    const resumed = await create.execute({
      userId: "user-a",
      planId: "  Accuracy-Focus  ",
    });
    expect(resumed.resumed).toBe(true);
    expect(resumed.enrollment.id).toBe(started.enrollment.id);

    const listed = await list.execute({ userId: "user-a" });
    expect(listed.enrollments).toHaveLength(1);
    expect(listed.enrollments[0]?.id).toBe(started.enrollment.id);
  });

  test("unknown planId is a not-found error", async () => {
    const { create } = setup();
    await expect(
      create.execute({ userId: "user-a", planId: "missing-plan" }),
    ).rejects.toBeInstanceOf(TrainingPlanNotFoundError);
  });

  test("advance by steps then percent, and complete at 100%", async () => {
    const { create, advance } = setup();
    const started = await create.execute({
      userId: "user-a",
      planId: "accuracy-focus",
    });

    const stepped = await advance.execute({
      userId: "user-a",
      enrollmentId: started.enrollment.id,
      completedStepIds: ["warm-up"],
    });
    expect(stepped.enrollment).toMatchObject({
      completedStepIds: ["warm-up"],
      percentComplete: 25,
      currentStepIndex: 1,
      status: "active",
    });

    const percented = await advance.execute({
      userId: "user-a",
      enrollmentId: started.enrollment.id,
      percentComplete: 50,
    });
    expect(percented.enrollment).toMatchObject({
      completedStepIds: ["warm-up", "target-practice"],
      percentComplete: 50,
      currentStepIndex: 2,
    });

    const done = await advance.execute({
      userId: "user-a",
      enrollmentId: started.enrollment.id,
      percentComplete: 100,
    });
    expect(done.enrollment).toMatchObject({
      status: "completed",
      percentComplete: 100,
      currentStepIndex: 4,
    });
    expect(done.enrollment.completedAt).toEqual(expect.any(String));
  });

  test("re-enroll after complete creates a new active enrollment", async () => {
    const { create, advance, list } = setup();
    const first = await create.execute({
      userId: "user-a",
      planId: "accuracy-focus",
    });
    await advance.execute({
      userId: "user-a",
      enrollmentId: first.enrollment.id,
      percentComplete: 100,
    });

    const second = await create.execute({
      userId: "user-a",
      planId: "accuracy-focus",
    });
    expect(second.resumed).toBe(false);
    expect(second.enrollment.id).not.toBe(first.enrollment.id);
    expect(second.enrollment.status).toBe("active");
    expect(second.enrollment.percentComplete).toBe(0);

    const listed = await list.execute({ userId: "user-a" });
    expect(listed.enrollments).toHaveLength(2);
    expect(listed.enrollments[0]?.status).toBe("active");
    expect(listed.enrollments[1]?.status).toBe("completed");
    expect(listed.enrollments[1]?.id).toBe(first.enrollment.id);
  });

  test("advance rejects missing payload, foreign enrollments, and completed regress", async () => {
    const { create, advance } = setup();
    const started = await create.execute({
      userId: "user-a",
      planId: "consistency-builder",
    });

    await expect(
      advance.execute({
        userId: "user-a",
        enrollmentId: started.enrollment.id,
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      advance.execute({
        userId: "user-a",
        enrollmentId: started.enrollment.id,
        completedStepIds: ["warm-up-rallies"],
        percentComplete: 50,
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      advance.execute({
        userId: "user-b",
        enrollmentId: started.enrollment.id,
        percentComplete: 50,
      }),
    ).rejects.toBeInstanceOf(TrainingEnrollmentNotFoundError);

    await expect(
      advance.execute({
        userId: "user-a",
        enrollmentId: "missing",
        percentComplete: 50,
      }),
    ).rejects.toBeInstanceOf(TrainingEnrollmentNotFoundError);

    await advance.execute({
      userId: "user-a",
      enrollmentId: started.enrollment.id,
      percentComplete: 100,
    });
    await expect(
      advance.execute({
        userId: "user-a",
        enrollmentId: started.enrollment.id,
        percentComplete: 50,
      }),
    ).rejects.toBeInstanceOf(TrainingEnrollmentCompletedError);
  });

  test("create treats a unique-active race as resume", async () => {
    const catalog = TrainingCatalog.padel();
    const enrollments = new RaceyEnrollmentRepository(catalog);
    const create = new CreateEnrollment(enrollments, catalog);
    const first = await create.execute({
      userId: "user-a",
      planId: "accuracy-focus",
    });

    enrollments.missActiveOnce = true;
    const raced = await create.execute({
      userId: "user-a",
      planId: "accuracy-focus",
    });
    expect(raced.resumed).toBe(true);
    expect(raced.enrollment.id).toBe(first.enrollment.id);

    const colliding = TrainingEnrollment.start(
      "user-a",
      catalog.require("accuracy-focus"),
    );
    await expect(enrollments.create(colliding)).rejects.toBeInstanceOf(
      TrainingEnrollmentActiveConflictError,
    );
  });

  test("list skips drifted enrollments and still returns the catalog", async () => {
    const { enrollments, list, create } = setup();
    await create.execute({ userId: "user-a", planId: "accuracy-focus" });
    enrollments.seedSnapshot({
      id: "retired-1",
      userId: "user-a",
      planId: "retired-plan",
      status: "completed",
      completedStepIds: ["old-step"],
      percentComplete: 100,
      currentStepIndex: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      completedAt: "2026-01-02T00:00:00.000Z",
    });
    enrollments.seedSnapshot({
      id: "stale-step",
      userId: "user-a",
      planId: "accuracy-focus",
      status: "completed",
      completedStepIds: ["removed-drill"],
      percentComplete: 100,
      currentStepIndex: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      completedAt: "2026-01-03T00:00:00.000Z",
    });

    const listed = await list.execute({ userId: "user-a" });
    expect(listed.plans.map((plan) => plan.id)).toContain("accuracy-focus");
    expect(listed.enrollments.map((row) => row.id)).toEqual(
      expect.not.arrayContaining(["retired-1", "stale-step"]),
    );
    expect(listed.enrollments).toHaveLength(1);
    expect(listed.enrollments[0]?.planId).toBe("accuracy-focus");
  });

  test("list caps enrollments at 50 with active first", async () => {
    const { enrollments, list } = setup();
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 60; i += 1) {
      enrollments.seedSnapshot({
        id: `done-${i}`,
        userId: "user-a",
        planId: "accuracy-focus",
        status: "completed",
        completedStepIds: [
          "warm-up",
          "target-practice",
          "precision-drills",
          "cool-down",
        ],
        percentComplete: 100,
        currentStepIndex: 4,
        startedAt: new Date(now + i).toISOString(),
        updatedAt: new Date(now + i).toISOString(),
        completedAt: new Date(now + i).toISOString(),
      });
    }
    enrollments.seedSnapshot({
      id: "active-now",
      userId: "user-a",
      planId: "consistency-builder",
      status: "active",
      completedStepIds: [],
      percentComplete: 0,
      currentStepIndex: 0,
      startedAt: new Date(now + 1000).toISOString(),
      updatedAt: new Date(now + 1000).toISOString(),
      completedAt: null,
    });

    const listed = await list.execute({ userId: "user-a" });
    expect(listed.enrollments).toHaveLength(50);
    expect(listed.enrollments[0]?.id).toBe("active-now");
    expect(listed.enrollments.every((row) => row.id !== "done-0")).toBe(true);
  });
});
