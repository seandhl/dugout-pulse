import "server-only";
import { movingBasis } from "./comparison-basis";
import { z } from "zod";
import type { Fixture } from "@/demo/generator";
import { pitchingStats } from "@/stats/pitching";
import { MODEL, scoreMomentum, type Row } from "@/stats/momentum";
export const pitcherQuery = z
  .object({
    role: z.enum(["starter", "reliever"]).default("starter"),
    window: z.enum(["3", "5", "10", "20", "season"]).default("10"),
  })
  .strict()
  .refine(
    (q) =>
      q.window === "season" ||
      (q.role === "starter" ? ["3", "5", "10"] : ["5", "10", "20"]).includes(
        q.window,
      ),
    "역할에 맞는 기간을 선택하세요.",
  );
export function selectPitcherDetail(
  f: Fixture,
  id: string,
  role: "starter" | "reliever",
  window: string,
) {
  const player = f.players.find(
    (p) =>
      p.playerId === id &&
      p.listedRoles.some((r) => r === "starter" || r === "reliever"),
  );
  if (!player) return null;
  const rows: Row[] = f.games
    .filter((g) => g.status === "final")
    .flatMap((g) =>
      g.pitching.map((l) => ({
        leagueId: "demo",
        season: f.season,
        competition: "regular" as const,
        role:
          l.role === "STARTER"
            ? ("starting_pitcher" as const)
            : ("relief_pitcher" as const),
        playerId: l.playerId,
        gameId: g.gameId,
        playedOn: g.date,
        doubleheaderNo: g.doubleheaderNo,
        releaseId: f.releaseId,
        status: "FINAL" as const,
        completedAt: f.asOf,
        asOf: f.asOf,
        revision: g.revision,
        sourceId: f.sourceId,
        inputRef: `${f.releaseId}/${g.gameId}/${l.playerId}/r${g.revision}`,
        counts: l,
        walkDefinition: "includes_ibb" as const,
      })),
    )
    .sort(
      (a, b) =>
        a.playedOn.localeCompare(b.playedOn) ||
        a.doubleheaderNo - b.doubleheaderNo ||
        a.gameId.localeCompare(b.gameId),
    );
  const modelRole = role === "starter" ? "starting_pitcher" : "relief_pitcher";
  const own = rows.filter((r) => r.playerId === id);
  const roleRows = own.filter((r) => r.role === modelRole);
  const selected =
    window === "season" ? roleRows : roleRows.slice(-Number(window));
  const summarize = (rs: Row[]) =>
    pitchingStats(
      rs.map((r) => ({ counts: r.counts, walkDefinition: r.walkDefinition! })),
    );
  const momentum =
    window === "season"
      ? null
      : scoreMomentum({
          leagueId: "demo",
          season: f.season,
          competition: "regular",
          role: modelRole,
          window: Number(window) as 3 | 5 | 10 | 20,
          playerId: id,
          cutoffAt: f.asOf,
          releaseId: f.releaseId,
          demo: true,
          rights: "demo_allowed",
          revisionsResolved: true,
          coverageComplete: true,
          lastAppearanceDate: roleRows.at(-1)?.playedOn ?? null,
          roster: { status: "unknown", asOf: f.asOf, sourceId: f.sourceId },
          rows,
        });
  const context = momentum?.explanation;
  const scoreEvidence = {
    baseline:
      context && "baseline" in context
        ? context.baseline.map((b) => ({
            id: b.id,
            median: b.median,
            count: b.count,
            available: b.available,
          }))
        : [],
    reliability: context && "rW" in context ? context.rW : null,
    reasons:
      context && "reasons" in context
        ? context.reasons.map((r) => `${r.direction}: ${r.text}`)
        : [],
    terms:
      context && "terms" in context
        ? context.terms.map((t) => ({
            id: t.id,
            current: t.current,
            median: t.median,
            weight: t.weight,
            contribution: t.contribution,
          }))
        : [],
  };
  return {
    player,
    scoreEvidence,
    role,
    window,
    comparisonBasis: movingBasis(f, role, window, roleRows),
    modelVersion: MODEL,
    momentum,
    source: f.sourceId,
    exportPolicy: {
      demo: true,
      exportAllowed: true,
      licenseId: "demo-self-authored-v1",
    },
    asOf: f.asOf,
    updatedAt: f.lastUpdatedAt,
    seasonYear: f.season,
    competition: "정규시즌",
    team: f.teams.find((t) => t.teamId === player.teamId)?.name ?? "소속 미상",
    availableRoles: (["starter", "reliever"] as const).filter(
      (r) =>
        own.some(
          (x) =>
            x.role ===
            (r === "starter" ? "starting_pitcher" : "relief_pitcher"),
        ) || player.listedRoles.includes(r),
    ),
    lastAppearance: roleRows.at(-1)?.playedOn ?? null,
    season: summarize(own),
    roleSeason: summarize(roleRows),
    recent: summarize(selected),
    games: selected.map((r, i) => {
      const g = f.games.find((g) => g.gameId === r.gameId)!;
      const line = g.pitching.find((l) => l.playerId === id)!;
      const opponent = line.teamId === g.home ? g.away : g.home;
      return {
        id: r.gameId,
        date: r.playedOn,
        order: r.doubleheaderNo,
        role,
        counts: r.counts,
        ip: summarize([r]).inningsDisplay,
        stats: summarize([r]),
        cumulative: summarize(selected.slice(0, i + 1)),
        moving: summarize(selected.slice(Math.max(0, i - 4), i + 1)),
        opponent: f.teams.find((t) => t.teamId === opponent)?.name ?? opponent,
        result: "미제공",
        source: r.sourceId,
        inputRef: r.inputRef,
        asOf: r.asOf,
      };
    }),
  };
}
export type PitcherDetail = NonNullable<ReturnType<typeof selectPitcherDetail>>;
