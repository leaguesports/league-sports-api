import { randomUUID } from "node:crypto";

import { CmsId } from "./cmsId";
import { Slug } from "./slug";
import { VenueName } from "./venueName";

export type VenueSnapshot = {
  id: string;
  cmsId: string;
  name: string;
  slug: string;
};

export class Venue {
  private constructor(
    readonly id: string,
    readonly cmsId: CmsId,
    private nameValue: VenueName,
    private slugValue: Slug,
  ) {}

  static registerFromCms(cmsId: CmsId, name: VenueName, slug: Slug): Venue {
    return new Venue(randomUUID(), cmsId, name, slug);
  }

  static rehydrate(props: {
    id: string;
    cmsId: CmsId;
    name: VenueName;
    slug: Slug;
  }): Venue {
    return new Venue(props.id, props.cmsId, props.name, props.slug);
  }

  get name(): VenueName {
    return this.nameValue;
  }

  get slug(): Slug {
    return this.slugValue;
  }

  refreshDetails(name: VenueName, slug: Slug): void {
    this.nameValue = name;
    this.slugValue = slug;
  }

  toSnapshot(): VenueSnapshot {
    return {
      id: this.id,
      cmsId: this.cmsId.value,
      name: this.nameValue.value,
      slug: this.slugValue.value,
    };
  }
}
