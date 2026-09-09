import { DomainError, requiredTrimmed } from "../../../lib/domain-error";
import { CmsId } from "../../venue/entities/cms-id";
import { GolfTourFormat } from "./golf-tour-format";
import { TourDate } from "./tour-date";

const LABEL_MAX_LENGTH = 80;

export type GolfTourRoundSnapshot = {
  id: string;
  date: string;
  venueCmsId: string;
  label: string | null;
  format: "stroke";
};

export class GolfTourRound {
  private constructor(
    readonly id: string,
    private dateValue: TourDate,
    private venueCmsIdValue: CmsId,
    private labelValue: string | null,
    private formatValue: GolfTourFormat,
  ) {}

  static create(props: {
    id: string;
    date: TourDate;
    venueCmsId: CmsId;
    label?: string | null;
    format?: GolfTourFormat;
  }): GolfTourRound {
    return new GolfTourRound(
      props.id,
      props.date,
      props.venueCmsId,
      parseLabel(props.label),
      props.format ?? GolfTourFormat.STROKE,
    );
  }

  static rehydrate(props: {
    id: string;
    date: TourDate;
    venueCmsId: CmsId;
    label: string | null;
    format: GolfTourFormat;
  }): GolfTourRound {
    return new GolfTourRound(
      props.id,
      props.date,
      props.venueCmsId,
      props.label,
      props.format,
    );
  }

  static fromSnapshot(snapshot: GolfTourRoundSnapshot): GolfTourRound {
    return GolfTourRound.rehydrate({
      id: snapshot.id,
      date: TourDate.from(snapshot.date, "date"),
      venueCmsId: CmsId.from(snapshot.venueCmsId),
      label: snapshot.label,
      format: GolfTourFormat.from(snapshot.format),
    });
  }

  get date(): TourDate {
    return this.dateValue;
  }

  get venueCmsId(): CmsId {
    return this.venueCmsIdValue;
  }

  get label(): string | null {
    return this.labelValue;
  }

  get format(): GolfTourFormat {
    return this.formatValue;
  }

  update(details: {
    date?: TourDate;
    venueCmsId?: CmsId;
    label?: string | null;
    format?: GolfTourFormat;
  }): void {
    if (details.date) this.dateValue = details.date;
    if (details.venueCmsId) this.venueCmsIdValue = details.venueCmsId;
    if ("label" in details) this.labelValue = parseLabel(details.label);
    if (details.format) this.formatValue = details.format;
  }

  toSnapshot(): GolfTourRoundSnapshot {
    return {
      id: this.id,
      date: this.dateValue.toDayString(),
      venueCmsId: this.venueCmsIdValue.value,
      label: this.labelValue,
      format: this.formatValue.value,
    };
  }
}

export function parseLabel(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const value = requiredTrimmed(raw, "label");
  if (value.length > LABEL_MAX_LENGTH) {
    throw new DomainError(`label must be at most ${LABEL_MAX_LENGTH} characters`);
  }
  return value;
}
