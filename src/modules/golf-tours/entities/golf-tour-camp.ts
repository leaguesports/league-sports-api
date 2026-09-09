import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { GolfTourCampName } from "./golf-tour-camp-name";

const COLOR_MAX_LENGTH = 32;

export type GolfTourCampSnapshot = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
};

export class GolfTourCamp {
  private constructor(
    readonly id: string,
    private nameValue: GolfTourCampName,
    private colorValue: string | null,
    readonly sortOrder: number,
  ) {}

  static create(props: {
    id: string;
    name: GolfTourCampName;
    color?: string | null;
    sortOrder: number;
  }): GolfTourCamp {
    return new GolfTourCamp(
      props.id,
      props.name,
      parseColor(props.color),
      props.sortOrder,
    );
  }

  static rehydrate(props: {
    id: string;
    name: GolfTourCampName;
    color: string | null;
    sortOrder: number;
  }): GolfTourCamp {
    return new GolfTourCamp(props.id, props.name, props.color, props.sortOrder);
  }

  static fromSnapshot(snapshot: GolfTourCampSnapshot): GolfTourCamp {
    return GolfTourCamp.rehydrate({
      id: snapshot.id,
      name: GolfTourCampName.from(snapshot.name),
      color: snapshot.color,
      sortOrder: snapshot.sortOrder,
    });
  }

  get name(): GolfTourCampName {
    return this.nameValue;
  }

  get color(): string | null {
    return this.colorValue;
  }

  rename(details: { name?: GolfTourCampName; color?: string | null }): void {
    if (details.name) this.nameValue = details.name;
    if ("color" in details) this.colorValue = parseColor(details.color);
  }

  toSnapshot(): GolfTourCampSnapshot {
    return {
      id: this.id,
      name: this.nameValue.value,
      color: this.colorValue,
      sortOrder: this.sortOrder,
    };
  }
}

export function parseColor(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const value = requiredTrimmed(raw, "color");
  if (value.length > COLOR_MAX_LENGTH) {
    throw new DomainError(`color must be at most ${COLOR_MAX_LENGTH} characters`);
  }
  return value;
}
