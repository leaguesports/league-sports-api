import { CmsId } from "./cms-id";
import { DomainError } from "../../../lib/domain-error";
import { Slug } from "./slug";
import { Venue } from "./venue";
import { VenueName } from "./venue-name";

describe("venue value objects", () => {
  test.each([
    ["cmsId", (value: unknown) => CmsId.from(value)],
    ["name", (value: unknown) => VenueName.from(value)],
    ["slug", (value: unknown) => Slug.from(value)],
  ])("rejects missing %s", (_field, create) => {
    expect(() => create(undefined)).toThrow(DomainError);
    expect(() => create("")).toThrow(DomainError);
    expect(() => create("   ")).toThrow(DomainError);
  });

  test("trims name and slug", () => {
    expect(VenueName.from("  Grand Prix Arena  ").value).toBe("Grand Prix Arena");
    expect(Slug.from("  grand-prix-arena  ").value).toBe("grand-prix-arena");
    expect(CmsId.from("  sanity-1  ").value).toBe("sanity-1");
  });
});

describe(Venue, () => {
  test("registerFromCms assigns an id and exposes cms correlation", () => {
    const venue = Venue.registerFromCms(
      CmsId.from("sanity-1"),
      VenueName.from("Grand Prix Arena"),
      Slug.from("grand-prix-arena"),
    );

    expect(venue.id).toBeTruthy();
    expect(venue.toSnapshot()).toEqual({
      id: venue.id,
      cmsId: "sanity-1",
      name: "Grand Prix Arena",
      slug: "grand-prix-arena",
    });
  });
});
