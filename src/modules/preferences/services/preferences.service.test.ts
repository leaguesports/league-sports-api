import {
  assertSportSlugs,
  GetPreferences,
  UpdatePreferences,
} from "./preferences.service";
import { InMemoryPreferencesRepository } from "../repositories/in-memory-preferences.repository";

describe("preferences service", () => {
  test("normalizes and dedupes sport slugs", () => {
    expect(assertSportSlugs(["Padel", "padel", " golf "])).toEqual([
      "padel",
      "golf",
    ]);
  });

  test("get returns empty defaults", async () => {
    const repo = new InMemoryPreferencesRepository();
    const result = await new GetPreferences(repo).execute({ userId: "u1" });
    expect(result).toEqual({
      sports: [],
      activeSport: null,
      onboardingCompletedAt: null,
      onboardingSkippedAt: null,
    });
  });

  test("update persists sports, active sport, and onboarding flags", async () => {
    const repo = new InMemoryPreferencesRepository();
    const update = new UpdatePreferences(repo);

    const saved = await update.execute({
      userId: "u1",
      sports: ["padel", "golf"],
      activeSport: "padel",
      completeOnboarding: true,
    });

    expect(saved.sports).toEqual(["padel", "golf"]);
    expect(saved.activeSport).toBe("padel");
    expect(saved.onboardingCompletedAt).toEqual(expect.any(String));
    expect(saved.onboardingSkippedAt).toBeNull();

    const loaded = await new GetPreferences(repo).execute({ userId: "u1" });
    expect(loaded).toEqual(saved);
  });

  test("skip onboarding sets skipped timestamp", async () => {
    const repo = new InMemoryPreferencesRepository();
    const saved = await new UpdatePreferences(repo).execute({
      userId: "u1",
      skipOnboarding: true,
    });
    expect(saved.onboardingSkippedAt).toEqual(expect.any(String));
  });
});
