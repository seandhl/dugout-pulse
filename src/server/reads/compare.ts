import "server-only";
import { z } from "zod";
import type { Fixture } from "@/demo/generator";
import { selectPlayerDetail } from "./player-detail";
import { selectPitcherDetail } from "./pitcher-detail";
import { formatMetric, type Metric } from "@/stats/batting";
export const compareQuery = z
  .object({
    players: z
      .string()
      .max(201)
      .regex(/^[a-zA-Z0-9_,-]*$/)
      .default("")
      .refine(
        (value) => value.split(",").length <= 2,
        "비교는 최대 2명까지 가능합니다. 선수 ID를 2개 이하로 줄여 주세요.",
      ),
    window: z.enum(["5", "10", "season"]).default("10"),
    season: z.coerce.number().int().optional(),
    competition: z.enum(["regular", "postseason"]).default("regular"),
    q: z.string().trim().max(100).default(""),
    role1: z.enum(["batter", "starter", "reliever"]).optional(),
    role2: z.enum(["batter", "starter", "reliever"]).optional(),
  })
  .strict();
export type CompareQuery = z.infer<typeof compareQuery>;
export function selectComparison(f: Fixture, q: CompareQuery) {
  q = compareQuery.parse(q);
  const ids = q.players.split(",");
  const available =
    (q.season ?? f.season) === f.season && q.competition === "regular";
  const slots = ids.map((id, i) => {
    const player = f.players.find((p) => p.playerId === id);
    if (!player || !available) return null;
    const requested = i === 0 ? q.role1 : q.role2;
    const role = requested ?? player.listedRoles[0];
    if (!player.listedRoles.includes(role)) return null;
    const d =
      role === "batter"
        ? selectPlayerDetail(f, id, q.window)
        : selectPitcherDetail(f, id, role as "starter" | "reliever", q.window);
    if (!d) return null;
    const metrics: {
      label: string;
      value: number | null;
      text: string;
      lower: boolean;
      denominator: number | null;
    }[] = [];
    const add = (label: string, m: Metric, lower = false) =>
      metrics.push({
        label,
        value: m.value,
        text: formatMetric(m),
        lower,
        denominator: m.denominator,
      });
    if ("avg" in d.recent.metrics) {
      const m = d.recent.metrics;
      for (const [label, key] of [
        ["AVG", "avg"],
        ["OBP", "obp"],
        ["SLG", "slg"],
        ["OPS", "ops"],
        ["ISO", "iso"],
        ["BB%", "bbPct"],
        ["K%", "kPct"],
      ] as const)
        add(label, m[key], key === "kPct");
    } else {
      const stats = d.recent as ReturnType<
        typeof import("@/stats/pitching").pitchingStats
      >;
      metrics.push({
        label: "IP",
        value: stats.ip,
        text: stats.inningsDisplay,
        lower: false,
        denominator: stats.totals.outsRecorded,
      });
      for (const [label, key, lower] of [
        ["ERA", "era", true],
        ["WHIP", "whip", true],
        ["K/9", "kPer9", false],
        ["BB/9", "bbPer9", true],
        ["K-BB%", "kMinusBbPct", false],
      ] as const)
        add(label, stats.metrics[key], lower);
    }
    const score = d.momentum?.rawScore ?? null;
    metrics.push({
      label: "기세 점수",
      value: score,
      text: score === null ? "N/A" : score.toFixed(1),
      lower: false,
      denominator: null,
    });
    return { role, d, metrics };
  });
  return {
    slots,
    available,
    comparable:
      slots.length === 2 &&
      ids[0] !== ids[1] &&
      new Set(slots.flatMap((s) => (s ? [s.d.asOf] : []))).size <= 1 &&
      slots.every(Boolean) &&
      slots[0]!.role === slots[1]!.role,
    asOfMismatch: new Set(slots.flatMap((s) => (s ? [s.d.asOf] : []))).size > 1,
  };
}
