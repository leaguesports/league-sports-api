export function publicBoardDisplayName(
  firstName: string,
  lastName: string,
  fallback = "Player",
): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first && !last) return fallback;
  if (!last) return first;
  const initial = last[0]!.toUpperCase();
  if (!first) return `${initial}.`;
  return `${first} ${initial}.`;
}

export type BoardProfile = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export function toPublicBoardIdentity(profile: BoardProfile | undefined, userId: string) {
  return {
    userId,
    displayName: profile
      ? publicBoardDisplayName(profile.firstName, profile.lastName)
      : "Player",
    avatarUrl: profile?.avatarUrl ?? null,
  };
}
