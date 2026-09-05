import { DomainError } from "../../../lib/domain-error";
import { FixtureSlug } from "../entities/fixture-slug";
import { FixtureFollowRepository } from "../repositories/fixture-follow.repository";
import { FollowFixture } from "./follow-fixture.service";
import { GetFixtureFollowStatus } from "./get-fixture-follow-status.service";
import { ListFollowedFixtures } from "./list-followed-fixtures.service";
import { UnfollowFixture } from "./unfollow-fixture.service";

describe("fixture follow services", () => {
  const follows = {
    follow: jest.fn(),
    unfollow: jest.fn(),
    isFollowing: jest.fn(),
    listFollowedByUser: jest.fn(),
  } as unknown as FixtureFollowRepository;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("FollowFixture upserts by session userId and slug", async () => {
    (follows.follow as jest.Mock).mockResolvedValue({
      userId: "user-1",
      fixtureSlug: "springboks-vs-all-blacks-2026-09-06",
      createdAt: new Date("2026-09-05T09:00:00.000Z"),
    });

    const result = await new FollowFixture(follows).execute({
      userId: "user-1",
      slug: "springboks-vs-all-blacks-2026-09-06",
    });

    expect(follows.follow).toHaveBeenCalledWith(
      "user-1",
      FixtureSlug.from("springboks-vs-all-blacks-2026-09-06"),
    );
    expect(result).toEqual({ following: true });
  });

  test("FollowFixture rejects blank userId and invalid slug", async () => {
    await expect(
      new FollowFixture(follows).execute({
        userId: "  ",
        slug: "springboks-vs-all-blacks-2026-09-06",
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      new FollowFixture(follows).execute({
        userId: "user-1",
        slug: "Springboks",
      }),
    ).rejects.toBeInstanceOf(DomainError);

    expect(follows.follow).not.toHaveBeenCalled();
  });

  test("UnfollowFixture is idempotent when the follow is missing", async () => {
    (follows.unfollow as jest.Mock).mockResolvedValue(false);

    const result = await new UnfollowFixture(follows).execute({
      userId: "user-1",
      slug: "derby-2026-09-12",
    });

    expect(follows.unfollow).toHaveBeenCalledWith(
      "user-1",
      FixtureSlug.from("derby-2026-09-12"),
    );
    expect(result).toEqual({ following: false });
  });

  test("GetFixtureFollowStatus returns following for the session user", async () => {
    (follows.isFollowing as jest.Mock).mockResolvedValue(true);

    const result = await new GetFixtureFollowStatus(follows).execute({
      userId: "user-1",
      slug: "derby-2026-09-12",
    });

    expect(follows.isFollowing).toHaveBeenCalledWith(
      "user-1",
      FixtureSlug.from("derby-2026-09-12"),
    );
    expect(result).toEqual({ following: true });
  });

  test("ListFollowedFixtures returns session-owned slugs only", async () => {
    (follows.listFollowedByUser as jest.Mock).mockResolvedValue([
      {
        userId: "user-1",
        fixtureSlug: "springboks-vs-all-blacks-2026-09-06",
        createdAt: new Date("2026-09-05T09:00:00.000Z"),
      },
    ]);

    const result = await new ListFollowedFixtures(follows).execute({
      userId: "user-1",
    });

    expect(follows.listFollowedByUser).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({
      fixtures: [
        {
          slug: "springboks-vs-all-blacks-2026-09-06",
          createdAt: "2026-09-05T09:00:00.000Z",
        },
      ],
    });
  });
});
