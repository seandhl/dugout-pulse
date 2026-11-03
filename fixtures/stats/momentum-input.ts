import type { Input, Row, Role } from "../../src/stats/momentum";
// Synthetic DEMO cohort: each player contributes ONE season aggregate, not one observation per game.
const counts = {
  pa: 4,
  ab: 4,
  h: 1,
  doubles: 0,
  triples: 0,
  hr: 0,
  bb: 0,
  hbp: 0,
  sf: 0,
  sac: 0,
  ci: 0,
  so: 1,
};
function row(playerId: string, i: number, role: Role = "hitter"): Row {
  return {
    leagueId: "demo",
    season: 2026,
    competition: "regular",
    role,
    playerId,
    gameId: `g${i}`,
    playedOn: `2026-10-${String(i + 1).padStart(2, "0")}`,
    doubleheaderNo: 1,
    releaseId: "demo-release",
    status: "FINAL",
    completedAt: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
    asOf: "2026-11-03T00:00:00Z",
    revision: 1,
    sourceId: "synthetic",
    inputRef: `${playerId}/${i}`,
    counts:
      role === "hitter"
        ? { ...counts }
        : {
            bf: 25,
            outsRecorded: 18,
            so: 5,
            bb: 1,
            ibb: 0,
            h: 4,
            hbp: 0,
            hr: 0,
            r: 0,
            er: 0,
          },
    walkDefinition: "includes_ibb",
  };
}
export function fixture(role: Role = "hitter"): Input {
  const rows: Row[] = [];
  for (let p = 0; p < 20; p++)
    for (let i = 0; i < 10; i++) rows.push(row(`cohort${p}`, i, role));
  for (let i = 10; i < 21; i++) rows.push(row("target", i, role));
  return {
    leagueId: "demo",
    season: 2026,
    competition: "regular",
    role,
    playerId: "target",
    cutoffAt: "2026-10-21T14:00:00Z",
    releaseId: "demo-release",
    demo: true,
    rights: "demo_allowed",
    revisionsResolved: true,
    coverageComplete: true,
    lastAppearanceDate: "2026-10-21",
    roster: {
      status: "registered",
      asOf: "2026-10-21T00:00:00Z",
      sourceId: "synthetic",
    },
    rows: rows.map((r) => ({ ...r, asOf: "2026-10-21T13:00:00Z" })),
  };
}

export function momentumScenario(role: Role, variant: string): Input {
  const input = fixture(role);
  if (variant === "unlicensed")
    return { ...input, rights: "denied" } as unknown as Input;
  if (variant === "baseline")
    return {
      ...input,
      rows: input.rows.filter((r) => r.playerId === "target"),
    };
  if (variant === "sample")
    return {
      ...input,
      rows: input.rows.filter(
        (r) => r.playerId !== "target" || r.gameId === "g20",
      ),
    };
  return {
    ...input,
    rows: input.rows.map((r) => {
      if (
        r.playerId !== "target" ||
        r.playedOn < "2026-10-17" ||
        variant === "neutral"
      )
        return r;
      const up = variant === "up";
      return {
        ...r,
        counts:
          role === "hitter"
            ? {
                ...r.counts,
                h: up ? 3 : 0,
                doubles: up ? 1 : 0,
                so: up ? 0 : 3,
              }
            : {
                ...r.counts,
                so: up ? 10 : 1,
                bb: up ? 0 : 4,
                h: up ? 1 : 8,
                hr: up ? 0 : 2,
              },
      };
    }),
  };
}
