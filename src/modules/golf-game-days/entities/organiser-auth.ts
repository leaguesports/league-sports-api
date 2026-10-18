import { hashEquals } from "./tokens";

export type OrganiserOwner = {
  organiserUserId: string | null;
  organiserTokenHash: string | null;
};

export type OrganiserCredentials = {
  userId: string | null;
  organiserToken: string | null;
};

/**
 * Shared organiser check. A signed-in owner and the organiser token are equal.
 * The token is compared as a sha256 digest with a constant-time compare.
 */
export function isOrganiser(
  owner: OrganiserOwner,
  credentials: OrganiserCredentials,
): boolean {
  if (
    credentials.userId != null &&
    owner.organiserUserId != null &&
    credentials.userId === owner.organiserUserId
  ) {
    return true;
  }
  if (
    credentials.organiserToken &&
    owner.organiserTokenHash &&
    hashEquals(owner.organiserTokenHash, credentials.organiserToken)
  ) {
    return true;
  }
  return false;
}
