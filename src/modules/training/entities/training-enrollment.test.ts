import { DomainError } from "../../../lib/domain-error";
import { TrainingCatalog } from "../catalog/training-catalog";
import { EnrollmentStatus } from "./enrollment-status";
import { PercentComplete } from "./percent-complete";
import { TrainingEnrollment } from "./training-enrollment";
import { TrainingEnrollmentCompletedError } from "./training-enrollment-completed-error";
import { TrainingFocus } from "./training-focus";
import { TrainingPlan } from "./training-plan";
import { TrainingPlanId } from "./training-plan-id";
import { TrainingSport } from "./training-sport";

function accuracyPlan() {
  return TrainingCatalog.padel().require("accuracy-focus");
}

describe("training value objects", () => {
  test("plan id and step id require kebab-case slugs", () => {
    expect(TrainingPlanId.from("Accuracy-Focus").value).toBe("accuracy-focus");
    expect(() => TrainingPlanId.from("")).toThrow(DomainError);
    expect(() => TrainingPlanId.from("Accuracy Focus")).toThrow(DomainError);
  });

  test("sport is padel-only and focus is optional", () => {
    expect(TrainingSport.from("Padel").value).toBe("padel");
    expect(() => TrainingSport.from("golf")).toThrow(DomainError);
    expect(TrainingFocus.from("Accuracy")?.value).toBe("accuracy");
    expect(TrainingFocus.from(null)).toBeNull();
    expect(TrainingFocus.from("  ")).toBeNull();
    expect(() => TrainingFocus.from("footwork")).toThrow(DomainError);
  });

  test("percent is a whole number 0-100 and derives from completed ratio", () => {
    expect(PercentComplete.from(50).value).toBe(50);
    expect(PercentComplete.fromCompletedRatio(2, 4).value).toBe(50);
    expect(PercentComplete.fromCompletedRatio(4, 4).isComplete).toBe(true);
    expect(() => PercentComplete.from(101)).toThrow(DomainError);
    expect(() => PercentComplete.from(12.5)).toThrow(DomainError);
    expect(() => PercentComplete.from(-1)).toThrow(DomainError);
  });

  test("status is active or completed", () => {
    expect(EnrollmentStatus.from("active").isActive).toBe(true);
    expect(EnrollmentStatus.from("completed").isCompleted).toBe(true);
    expect(() => EnrollmentStatus.from("paused")).toThrow(DomainError);
  });
});

describe(TrainingPlan, () => {
  test("rejects empty or duplicate steps", () => {
    expect(() =>
      TrainingPlan.fromDefinition({
        id: "empty",
        title: "Empty",
        sport: "padel",
        steps: [],
      }),
    ).toThrow(DomainError);

    expect(() =>
      TrainingPlan.fromDefinition({
        id: "dupes",
        title: "Dupes",
        sport: "padel",
        steps: [
          { id: "warm-up", name: "A", durationMinutes: 10 },
          { id: "warm-up", name: "B", durationMinutes: 10 },
        ],
      }),
    ).toThrow(DomainError);
  });
});

describe(TrainingEnrollment, () => {
  test("start is empty progress on the given plan", () => {
    const plan = accuracyPlan();
    const enrollment = TrainingEnrollment.start("user-a", plan);
    const snapshot = enrollment.toSnapshot();

    expect(enrollment.id).toBeTruthy();
    expect(snapshot).toMatchObject({
      userId: "user-a",
      planId: "accuracy-focus",
      status: "active",
      completedStepIds: [],
      percentComplete: 0,
      currentStepIndex: 0,
      completedAt: null,
    });
  });

  test("completed steps union, derive percent, and point at the next step", () => {
    const plan = accuracyPlan();
    const enrollment = TrainingEnrollment.start("user-a", plan);

    enrollment.advanceByCompletedSteps(["warm-up"], plan);
    expect(enrollment.toSnapshot()).toMatchObject({
      completedStepIds: ["warm-up"],
      percentComplete: 25,
      currentStepIndex: 1,
      status: "active",
    });

    enrollment.advanceByCompletedSteps(["warm-up", "target-practice"], plan);
    expect(enrollment.toSnapshot()).toMatchObject({
      completedStepIds: ["warm-up", "target-practice"],
      percentComplete: 50,
      currentStepIndex: 2,
    });
  });

  test("unknown step ids are domain errors", () => {
    const plan = accuracyPlan();
    const enrollment = TrainingEnrollment.start("user-a", plan);
    expect(() =>
      enrollment.advanceByCompletedSteps(["not-a-step"], plan),
    ).toThrow(DomainError);
  });

  test("percent advance materializes a prefix of steps", () => {
    const plan = accuracyPlan();
    const enrollment = TrainingEnrollment.start("user-a", plan);

    enrollment.advanceByPercent(50, plan);
    expect(enrollment.toSnapshot()).toMatchObject({
      completedStepIds: ["warm-up", "target-practice"],
      percentComplete: 50,
      currentStepIndex: 2,
      status: "active",
    });
  });

  test("percent cannot decrease on an active enrollment", () => {
    const plan = accuracyPlan();
    const enrollment = TrainingEnrollment.start("user-a", plan);
    enrollment.advanceByPercent(50, plan);
    expect(() => enrollment.advanceByPercent(25, plan)).toThrow(DomainError);
  });

  test("all steps or 100% marks the enrollment completed", () => {
    const plan = accuracyPlan();
    const bySteps = TrainingEnrollment.start("user-a", plan);
    bySteps.advanceByCompletedSteps(
      ["warm-up", "target-practice", "precision-drills", "cool-down"],
      plan,
    );
    expect(bySteps.toSnapshot()).toMatchObject({
      status: "completed",
      percentComplete: 100,
      currentStepIndex: 4,
    });
    expect(bySteps.completedAt).toBeInstanceOf(Date);

    const byPercent = TrainingEnrollment.start("user-a", plan);
    byPercent.advanceByPercent(100, plan);
    expect(byPercent.toSnapshot()).toMatchObject({
      status: "completed",
      completedStepIds: [
        "warm-up",
        "target-practice",
        "precision-drills",
        "cool-down",
      ],
      percentComplete: 100,
    });
  });

  test("completing again is a no-op; regressing a completed enrollment errors", () => {
    const plan = accuracyPlan();
    const enrollment = TrainingEnrollment.start("user-a", plan);
    enrollment.advanceByPercent(100, plan);
    const before = enrollment.toSnapshot();

    enrollment.advanceByPercent(100, plan);
    enrollment.advanceByCompletedSteps(
      ["warm-up", "target-practice", "precision-drills", "cool-down"],
      plan,
    );
    expect(enrollment.toSnapshot()).toEqual(before);

    expect(() => enrollment.advanceByPercent(50, plan)).toThrow(
      TrainingEnrollmentCompletedError,
    );
  });

  test("rehydrate + snapshot round-trips progress", () => {
    const plan = accuracyPlan();
    const created = TrainingEnrollment.start("user-a", plan);
    created.advanceByCompletedSteps(["warm-up", "target-practice"], plan);
    const restored = TrainingEnrollment.fromSnapshot(created.toSnapshot(), plan);
    expect(restored.toSnapshot()).toEqual(created.toSnapshot());
  });
});
