import { generatePerformance } from "../../src/demo/performance";
import {
  modelVersion,
  type MomentumSnapshot,
} from "../../src/server/reads/momentum";
import {
  rowKey,
  type Canonical,
  type Kind,
} from "../../src/server/ingest/files";
import type { PipelineState } from "../../src/server/ingest/pipeline";
export function performancePanel() {
  const fixture = generatePerformance();
  const state: PipelineState = {
    version: 1,
    revision: 1,
    records: {},
    batches: {},
    history: [],
    audit: [],
    events: [],
    aggregates: {},
    scores: {},
    momentumSnapshots: {},
    momentumCurrent: [],
  };
  const refs = new Map<string, string[]>();
  function add(kind: Kind, row: Canonical, playerId?: string) {
    const key = rowKey(kind, row);
    state.records[key] = {
      kind,
      row,
      batchId: "perf",
      sourceId: fixture.sourceId,
      licenseId: "demo-self-authored-v1",
    };
    const ref = JSON.stringify([key, "perf", "demo-self-authored-v1"]);
    if (playerId) {
      const group = refs.get(playerId) ?? [];
      group.push(ref);
      refs.set(playerId, group);
    }
  }
  const scope = { season: 2026, competition: "regular", as_of: fixture.asOf };
  for (const p of fixture.players)
    add(
      "players",
      { ...scope, player_id: p.playerId, display_name: p.displayName },
      p.playerId,
    );
  for (const g of fixture.games) {
    add("games", {
      ...scope,
      game_id: g.gameId,
      played_on: g.date,
      status: g.status === "final" ? "FINAL" : "CANCELLED",
    });
    for (const [kind, logs] of [
      ["batting_game_logs", g.batting],
      ["pitching_game_logs", g.pitching],
    ] as const) {
      for (const l of logs)
        add(
          kind,
          {
            ...scope,
            player_id: l.playerId,
            game_id: g.gameId,
            team_id: l.teamId,
            role: l.role ?? "BATTER",
          },
          l.playerId,
        );
    }
  }
  for (const [i, p] of fixture.players.entries()) {
    const role =
      p.listedRoles[0] === "batter"
        ? "hitter"
        : (p.listedRoles[0] as "starter" | "reliever");
    const s: MomentumSnapshot = {
      id: p.playerId,
      playerId: p.playerId,
      role,
      season: 2026,
      competition: "regular",
      modelVersion,
      algorithmVersion: modelVersion,
      computedAt: fixture.asOf,
      asOf: fixture.asOf,
      dataAsOfGameId: null,
      window: 10,
      windowBasis: "DEMO performance panel",
      rawFeatureSummary: {
        W: { appearances: 10, opportunities: 100, outs: 60, metrics: {} },
      },
      score: 40 + (i % 40),
      deltaScore: (i % 5) - 2,
      confidence: "medium",
      eligibility: { eligible: true, reason: null },
      explanation: { demo: true },
      previousSnapshotId: null,
      sourceIds: [fixture.sourceId],
      inputRefs: refs.get(p.playerId) ?? [],
      sampleSize: 10,
      demo: true,
      publicationRevision: 1,
      rankingStatus: "ranked",
    };
    state.momentumSnapshots![s.id] = s;
    state.momentumCurrent!.push(s.id);
  }
  return { fixture, state };
}
