type DatedGame = { id: string; date: string; order: number };
/** Calendar gaps describe missing appearance logs, never inferred injury/rest. */
export function gameTimeline<T extends DatedGame>(games: readonly T[]) {
  return [...games]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.order - b.order ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((game, i, sorted) => ({
      ...game,
      gapDays:
        i === 0
          ? null
          : Math.max(
              0,
              Math.round(
                (Date.parse(game.date) - Date.parse(sorted[i - 1].date)) /
                  86400000,
              ) - 1,
            ),
    }));
}
