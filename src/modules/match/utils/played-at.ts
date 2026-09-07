export function resolvePlayedAt(body: {
  startsAt?: string;
  playedAt?: string;
}): string | undefined {
  const startsAt = typeof body.startsAt === "string" ? body.startsAt.trim() : "";
  if (startsAt.length > 0) {
    return startsAt;
  }

  const playedAt = typeof body.playedAt === "string" ? body.playedAt.trim() : "";
  return playedAt.length > 0 ? playedAt : undefined;
}
