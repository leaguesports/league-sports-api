import { RoadmapFeature } from "../entities/roadmap-feature";
import { RoadmapFeatureStatus } from "../entities/roadmap-feature-status";
import { InMemoryRoadmapRepository } from "../repositories/in-memory-roadmap.repository";
import { RecordingRoadmapEmailSender } from "./email-sender";
import {
  ListRoadmapFeatures,
  NotifyRoadmapFeature,
  ShipRoadmapFeature,
  ToggleRoadmapVote,
} from "./roadmap.service";

describe("roadmap services", () => {
  test("public feature list never includes githubIssueUrl", async () => {
    const repo = new InMemoryRoadmapRepository();
    repo.seedFeature(
      RoadmapFeature.create({
        title: "Hidden issue",
        description: "Internal tracker only.",
        githubIssueUrl: "https://github.com/leaguesports/x/issues/1",
        status: RoadmapFeatureStatus.PLANNED,
      }),
    );
    const result = await new ListRoadmapFeatures(repo).execute({
      voterKeys: [],
    });
    expect(result.features[0]).not.toHaveProperty("githubIssueUrl");
    expect(JSON.stringify(result)).not.toContain("github.com");
  });

  test("notify is idempotent across mixed-case email", async () => {
    const repo = new InMemoryRoadmapRepository();
    const feature = repo.seedFeature(
      RoadmapFeature.create({
        title: "Pools",
        description: "Tip with friends.",
      }),
    );
    const notify = new NotifyRoadmapFeature(repo);
    await notify.execute({ featureId: feature.id, email: "A@B.com" });
    await notify.execute({ featureId: feature.id, email: "a@b.com" });
    const watching = await repo.listActiveNotifies(feature.id);
    expect(watching).toHaveLength(1);
    expect(watching[0].email).toBe("a@b.com");
  });

  test("ship marks SHIPPED and sends one email per active notify", async () => {
    const repo = new InMemoryRoadmapRepository();
    const emails = new RecordingRoadmapEmailSender();
    const feature = repo.seedFeature(
      RoadmapFeature.create({
        slug: "club-nights",
        title: "Club nights",
        description: "Host a night.",
      }),
    );
    await repo.upsertNotify(feature.id, "one@example.com");
    await repo.upsertNotify(feature.id, "two@example.com");
    await repo.unsubscribeFeature("two@example.com", feature.id);

    const result = await new ShipRoadmapFeature(repo, emails, {
      jwtSecret: "secret",
      productUrl: "http://localhost:3001/roadmap",
      unsubscribeUrl: (token) =>
        `http://localhost:3001/roadmap/unsubscribe?token=${token}`,
    }).execute({ featureIdOrSlug: "club-nights" });

    expect(result.feature.status).toBe("SHIPPED");
    expect(result.emailsSent).toBe(1);
    expect(emails.sent.map((message) => message.to)).toEqual([
      "one@example.com",
    ]);
    expect(emails.sent[0].subject).toBe("Club nights shipped");
  });

  test("toggle vote increments then decrements", async () => {
    const repo = new InMemoryRoadmapRepository();
    const feature = repo.seedFeature(
      RoadmapFeature.create({
        title: "Mobile",
        description: "App later.",
      }),
    );
    const toggle = new ToggleRoadmapVote(repo);
    expect(
      await toggle.execute({ featureId: feature.id, voterKey: "cookie:abc" }),
    ).toEqual({ voted: true, voteCount: 1 });
    expect(
      await toggle.execute({ featureId: feature.id, voterKey: "cookie:abc" }),
    ).toEqual({ voted: false, voteCount: 0 });
  });
});
