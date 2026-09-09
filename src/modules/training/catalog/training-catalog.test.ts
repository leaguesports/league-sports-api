import { TrainingCatalog } from "./training-catalog";

describe(TrainingCatalog, () => {
  const catalog = TrainingCatalog.padel();

  test("ships three padel plans including Accuracy Focus from /athletes", () => {
    const plans = catalog.list();
    expect(plans).toHaveLength(3);
    expect(plans.every((plan) => plan.sport.value === "padel")).toBe(true);

    const accuracy = catalog.require("accuracy-focus").toSnapshot();
    expect(accuracy).toEqual({
      id: "accuracy-focus",
      title: "Accuracy Focus",
      sport: "padel",
      focus: "accuracy",
      totalDurationMinutes: 50,
      steps: [
        { id: "warm-up", name: "Warm-up", durationMinutes: 10 },
        { id: "target-practice", name: "Target Practice", durationMinutes: 20 },
        { id: "precision-drills", name: "Precision Drills", durationMinutes: 15 },
        { id: "cool-down", name: "Cool-down", durationMinutes: 5 },
      ],
    });
  });

  test("lookup is case-insensitive and unknown ids miss", () => {
    expect(catalog.get("Accuracy-Focus")?.id.value).toBe("accuracy-focus");
    expect(catalog.get("missing")).toBeNull();
  });
});
