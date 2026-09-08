import { CoverageIntent } from "../entities/coverage-intent";
import { InMemoryCoverageIntentRepository } from "../repositories/in-memory-coverage-intent.repository";
import {
  UnsubscribeCoverageIntents,
  UpsertCoverageIntent,
} from "./coverage-intents.service";

describe("coverage intent services", () => {
  test("upsert is idempotent on email+sport+city", async () => {
    const repo = new InMemoryCoverageIntentRepository();
    const upsert = new UpsertCoverageIntent(repo);

    const first = await upsert.execute({
      email: "  Fan@Example.com ",
      sport: "padel",
      city: "Cape Town",
      sourcePage: "/padel/cape-town",
    });
    const second = await upsert.execute({
      email: "fan@example.com",
      sport: "PADEL",
      city: "  cape town ",
      sourcePage: "/other",
    });

    expect(second.intent.id).toBe(first.intent.id);
    expect(second.intent.sport).toBe("padel");
    expect(second.intent.city).toBe("cape town");
    expect(repo.all()).toHaveLength(1);
    expect(JSON.stringify(second)).not.toContain("fan@example.com");
  });

  test("null sport/city share one uniqueness slot", async () => {
    const repo = new InMemoryCoverageIntentRepository();
    const upsert = new UpsertCoverageIntent(repo);

    const first = await upsert.execute({ email: "a@b.com" });
    const second = await upsert.execute({
      email: "a@b.com",
      sport: "",
      city: "   ",
    });
    const otherSport = await upsert.execute({
      email: "a@b.com",
      sport: "golf",
    });

    expect(second.intent.id).toBe(first.intent.id);
    expect(otherSport.intent.id).not.toBe(first.intent.id);
    expect(repo.all()).toHaveLength(2);
  });

  test("unsubscribe then upsert reactivates the same row", async () => {
    const repo = new InMemoryCoverageIntentRepository();
    const upsert = new UpsertCoverageIntent(repo);
    const unsub = new UnsubscribeCoverageIntents(repo);

    const created = await upsert.execute({
      email: "a@b.com",
      sport: "darts",
      city: "johannesburg",
    });
    const result = await unsub.execute({ email: "A@B.com" });
    expect(result).toEqual({ unsubscribed: true, count: 1 });

    const stored = await repo.findByEmailSportCity(
      "a@b.com",
      "darts",
      "johannesburg",
    );
    expect(stored?.isActive).toBe(false);

    const again = await upsert.execute({
      email: "a@b.com",
      sport: "darts",
      city: "johannesburg",
    });
    expect(again.intent.id).toBe(created.intent.id);
    expect(
      (await repo.findByEmailSportCity("a@b.com", "darts", "johannesburg"))
        ?.isActive,
    ).toBe(true);
  });

  test("rejects invalid email and unknown sport", async () => {
    const upsert = new UpsertCoverageIntent(
      new InMemoryCoverageIntentRepository(),
    );
    await expect(upsert.execute({ email: "nope" })).rejects.toThrow(
      "email is invalid",
    );
    await expect(
      upsert.execute({ email: "a@b.com", sport: "tennis" }),
    ).rejects.toThrow("sport must be padel, golf, or darts");
  });

  test("seeded unsubscribed row reactivates on upsert", async () => {
    const repo = new InMemoryCoverageIntentRepository();
    const existing = repo.seed(
      CoverageIntent.rehydrate({
        id: "intent-1",
        email: "a@b.com",
        sport: "golf",
        city: "durban",
        sourcePage: "/old",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        unsubscribedAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
    );
    const result = await new UpsertCoverageIntent(repo).execute({
      email: "a@b.com",
      sport: "golf",
      city: "Durban",
      sourcePage: "/new",
    });
    expect(result.intent.id).toBe(existing.id);
    expect(result.intent.sourcePage).toBe("/new");
    expect(result.intent.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
