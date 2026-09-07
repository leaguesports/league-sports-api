export function defaultNineHoleCourse() {
  return {
    name: null as string | null,
    holes: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      par: 4,
      strokeIndex: index + 1,
    })),
  };
}
