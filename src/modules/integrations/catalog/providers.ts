import { ProviderDefinition } from "../entities/provider";

export const GENERIC_IMPORT_PROVIDER_ID = "generic-import";
export const TRACKMAN_PROVIDER_ID = "trackman";
export const AUTODARTS_PROVIDER_ID = "autodarts";

export const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  {
    id: GENERIC_IMPORT_PROVIDER_ID,
    name: "Import session",
    description:
      "Paste a structured session so the athlete hub can record a real last sync without a vendor partnership.",
    available: true,
    comingSoon: false,
  },
  {
    id: TRACKMAN_PROVIDER_ID,
    name: "Trackman",
    description:
      "Range and launch-monitor sessions. Requires a Trackman partnership and vendor API keys.",
    available: false,
    comingSoon: true,
  },
  {
    id: AUTODARTS_PROVIDER_ID,
    name: "Autodarts",
    description:
      "Electronic dartboard sessions. Requires Autodarts API access that is not available in v1.",
    available: false,
    comingSoon: true,
  },
];
