export const JOHANNESBURG_TIMEZONE = "Africa/Johannesburg";

const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

export function johannesburgYearMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: JOHANNESBURG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    throw new Error("Unable to format Johannesburg calendar month");
  }
  return `${year}-${month}`;
}

export function currentJohannesburgYearMonth(now = new Date()): string {
  return johannesburgYearMonth(now);
}

export function isJohannesburgYearMonth(value: string): boolean {
  const match = YEAR_MONTH.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function isInJohannesburgMonth(date: Date, yearMonth: string): boolean {
  return johannesburgYearMonth(date) === yearMonth;
}
