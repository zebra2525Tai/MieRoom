// 休み・行事 of a date (外部設計書 R3-10). No I/O here.

export type ClosureItem = {
  startDate: string;
  endDate: string | null;
  name: string;
};

/** The names on a date. The same name is shown once (e.g. a class and the school). */
export function closureNamesOn(
  date: string,
  closures: readonly ClosureItem[],
): string[] {
  const names = closures
    .filter(
      (closure) =>
        date >= closure.startDate &&
        date <= (closure.endDate ?? closure.startDate),
    )
    .map((closure) => closure.name);
  return [...new Set(names)];
}
