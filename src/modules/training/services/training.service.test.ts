import { DomainError } from "../../../lib/domain-error";
import { TrainingCatalog } from "../catalog/training-catalog";
import { InMemoryTrainingEnrollmentRepository } from "../repositories/in-memory-training-enrollment.repository";
import {
  AdvanceEnrollment,
  CreateEnrollment,
  ListTrainingPlans,
  TrainingEnrollmentCompletedError,
  TrainingEnrollmentNotFoundError,
  TrainingPlanNotFoundError,
} from "./training.service";

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
});
