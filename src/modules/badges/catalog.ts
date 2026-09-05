/** V1 server badge catalog — ids must match the landing-page client. */

export const SERVER_BADGE_IDS = [
  "first_lock",
  "first_win",
  "matches_5",
  "first_golf",
  "first_friend",
  "hot_form",
] as const;

export type ServerBadgeId = (typeof SERVER_BADGE_IDS)[number];

/** Device-local only until a share *action* is recorded server-side. */
export const CLIENT_ONLY_BADGE_IDS = ["whatsapp_share"] as const;

export function isServerBadgeId(value: string): value is ServerBadgeId {
  return (SERVER_BADGE_IDS as readonly string[]).includes(value);
}
