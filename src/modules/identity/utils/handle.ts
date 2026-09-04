/** URL-safe handle from a display seed (email local-part, name, etc.). */
export function slugifyHandle(seed: string): string {
  const cleaned = seed
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);

  return cleaned || "player";
}

export function handleCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = String(attempt);
  const maxBase = Math.max(1, 20 - suffix.length);
  return `${base.slice(0, maxBase)}${suffix}`;
}
