import "server-only";
import {
  compareBatting,
  fields,
  type Appearance,
  type Counts,
} from "../../stats/batting";
/** Adapter for already authorized, published rows; rights remain enforced by pipeline. */
export function publishedBatting(
  records: readonly {
    kind: string;
    row: Record<string, unknown>;
    sourceId: string;
    batchId: string;
    licenseId: string;
  }[],
) {
  const players: Record<string, Appearance[]> = {};
  for (const record of records) {
    if (record.kind !== "batting_game_logs") continue;
    const row = record.row;
    const game = records.find(
      (g) => g.kind === "games" && g.row.game_id === row.game_id,
    )?.row;
    if (!game || game.status !== "FINAL") continue;
    const counts: Counts = {};
    for (const field of fields) {
      const value = row[field];
      if (value != null) {
        if (typeof value !== "number") throw new Error(`Invalid ${field}`);
        counts[field] = value;
      }
    }
    (players[String(row.player_id)] ??= []).push({
      gameId: String(row.game_id),
      playedOn: String(game.played_on),
      order: Number(game.doubleheader_no ?? 1),
      counts,
      sourceId: record.sourceId,
      asOf: String(row.as_of),
      inputRef: JSON.stringify([
        record.batchId,
        record.licenseId,
        row.game_id,
        row.player_id,
      ]),
    });
  }
  return Object.fromEntries(
    Object.entries(players).map(([id, rows]) => [
      id,
      { demo: true, ...compareBatting(rows) },
    ]),
  );
}
