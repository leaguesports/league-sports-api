import { DomainError } from "../../../lib/domain-error";
import { CmsId } from "../entities/cms-id";
import { VenueFollowRepository } from "../repositories/venue-follow.repository";
import { VenueRepository } from "../repositories/venue.repository";
import {
  FollowVenue,
  VenueNotFoundForFollowError,
} from "./follow-venue.service";

describe("FollowVenue", () => {
  const venues = {
    findByCmsId: jest.fn(),
  } as unknown as VenueRepository;
  const follows = {
    follow: jest.fn(),
  } as unknown as VenueFollowRepository;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("follows an existing venue", async () => {
    const venue = {
      toSnapshot: () => ({
        id: "v1",
        cmsId: "cms-1",
        name: "Arena",
        slug: "arena",
      }),
    };
    (venues.findByCmsId as jest.Mock).mockResolvedValue(venue);
    (follows.follow as jest.Mock).mockResolvedValue({
      userId: "user-1",
      venueCmsId: "cms-1",
      createdAt: new Date("2026-09-04T12:00:00.000Z"),
    });

    const result = await new FollowVenue(venues, follows).execute({
      userId: "user-1",
      cmsId: "cms-1",
    });

    expect(venues.findByCmsId).toHaveBeenCalledWith(CmsId.from("cms-1"));
    expect(follows.follow).toHaveBeenCalledWith("user-1", CmsId.from("cms-1"));
    expect(result).toEqual({
      following: true,
      venueCmsId: "cms-1",
      followedAt: "2026-09-04T12:00:00.000Z",
      venue: {
        id: "v1",
        cmsId: "cms-1",
        name: "Arena",
        slug: "arena",
      },
    });
  });

  test("rejects blank userId", async () => {
    await expect(
      new FollowVenue(venues, follows).execute({ userId: "  ", cmsId: "cms-1" }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("rejects missing venue", async () => {
    (venues.findByCmsId as jest.Mock).mockResolvedValue(null);
    await expect(
      new FollowVenue(venues, follows).execute({
        userId: "user-1",
        cmsId: "cms-1",
      }),
    ).rejects.toBeInstanceOf(VenueNotFoundForFollowError);
  });
});
