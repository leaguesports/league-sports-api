import { CmsId } from "../../venue/entities/cms-id";

export function optionalVenueCmsId(raw: unknown): CmsId | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === "string" && raw.trim().length === 0) {
    return null;
  }
  return CmsId.from(raw);
}
