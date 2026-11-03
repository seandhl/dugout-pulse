// Original synthetic simulation. No external records, names or assets.
export const SEED = 20261103;
export const AS_OF = "2026-11-03T00:00:00.000Z";
export function generate(seed = SEED) {
  let state = seed >>> 0;
  const random = (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % n;
  };
  const teams = Array.from({ length: 10 }, (_, i) => ({
    teamId: `sample_${i}`,
    name: `샘플 ${String.fromCharCode(65 + i)}팀`,
  }));
  const players = teams.flatMap((t, i) =>
    Array.from({ length: 15 }, (_, j) => ({
      playerId: `demo_${i}_${String(j).padStart(2, "0")}`,
      displayName: `가상 ${String.fromCharCode(65 + i)}-${String(j + 1).padStart(2, "0")}`,
      listedRoles:
        j === 12
          ? ["starter", "reliever"]
          : [j < 10 ? "batter" : j < 13 ? "starter" : "reliever"],
      sourceId: "synthetic_v2",
      teamId: t.teamId,
    })),
  );
  const date = (day: number) => `2026-10-${String(day + 1).padStart(2, "0")}`;
  const teamAt = (p: (typeof players)[number], day: number) =>
    p.playerId === "demo_0_00" && day >= 15 ? "sample_1" : p.teamId;
  type Line = {
    hbp?: number;
    sf?: number;
    sac?: number;
    ci?: number;
    ibb?: number;
    playerId: string;
    teamId: string;
    ab: number;
    h: number;
    doubles: number;
    triples: number;
    hr: number;
    r: number;
    rbi: number;
    so: number;
    pa: number;
    bb: number;
    role?: "STARTER" | "RELIEVER";
    outsRecorded: number;
    er: number;
    bf: number;
  };
  const blank = (p: (typeof players)[number], teamId: string): Line => ({
    playerId: p.playerId,
    teamId,
    ab: 0,
    h: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    r: 0,
    rbi: 0,
    so: 0,
    pa: 0,
    bb: 0,
    outsRecorded: 0,
    er: 0,
    bf: 0,
  });
  type Game = {
    gameId: string;
    date: string;
    home: string;
    away: string;
    doubleheaderNo: number;
    status: string;
    revision: number;
    batting: Line[];
    pitching: Line[];
    events: { batter: string; pitcher: string; outcome: string }[];
    homeRuns: number;
    awayRuns: number;
  };
  const games: Game[] = [];
  const absences: { playerId: string; date: string; reason: string }[] = [];
  for (let day = 0; day < 30; day++) {
    for (const p of players)
      if (p.playerId === "demo_0_01" && day >= 5 && day <= 10)
        absences.push({
          playerId: p.playerId,
          date: date(day),
          reason: "injury",
        });
    if (day % 7 === 6) {
      absences.push({ playerId: "ALL", date: date(day), reason: "rest" });
      continue;
    }
    for (let pair = 0; pair < 5; pair++)
      for (let dh = 1; dh <= (day === 12 && pair === 0 ? 2 : 1); dh++) {
        const home = `sample_${pair * 2}`,
          away = `sample_${pair * 2 + 1}`;
        const cancelled = day === 11 && pair === 0;
        const game = {
          gameId: `g_${day}_${pair}_${dh}`,
          date: date(day),
          home,
          away,
          doubleheaderNo: dh,
          status: cancelled ? "cancelled" : "final",
          revision: 1,
          batting: [] as Line[],
          pitching: [] as Line[],
          events: [] as { batter: string; pitcher: string; outcome: string }[],
          homeRuns: 0,
          awayRuns: 0,
        };
        if (!cancelled)
          for (const team of [home, away]) {
            const opposing = team === home ? away : home;
            const batters = players
              .filter(
                (p) =>
                  p.listedRoles[0] === "batter" &&
                  teamAt(p, day) === team &&
                  !(p.playerId === "demo_0_01" && day >= 5 && day <= 10),
              )
              .slice(0, 9);
            const pitchers = players.filter(
              (p) => p.teamId === opposing && p.listedRoles[0] !== "batter",
            );
            const selected = [
              pitchers[day % 3],
              day % 3 !== 2 && day % 2 === 0
                ? pitchers[2]
                : pitchers[3 + (dh % 2)],
            ];
            const pitching = selected.map((p, i) => ({
              ...blank(p, opposing),
              role: i === 0 ? ("STARTER" as const) : ("RELIEVER" as const),
            }));
            const batting = batters.map((p) => blank(p, team));
            // Solo home runs and outs: bases always empty, exactly 27 outs per side.
            let outs = 0,
              pa = 0;
            while (outs < 27) {
              const b = batting[pa % batting.length],
                p = pitching[outs < 18 ? 0 : 1];
              const hr = random(6) === 0 && pa < 60;
              let outcome = hr ? "home_run" : "out";
              b.pa++;
              b.ab++;
              p.bf++;
              if (hr) {
                b.h++;
                b.hr++;
                b.r++;
                b.rbi++;
                p.h++;
                p.hr++;
                p.r++;
                p.er++;
              } else {
                outs++;
                p.outsRecorded++;
                if (random(3) === 0) {
                  b.so++;
                  p.so++;
                  outcome = "strikeout";
                }
              }
              game.events.push({
                batter: b.playerId,
                pitcher: p.playerId,
                outcome,
              });
              pa++;
            }
            game.batting.push(...batting);
            game.pitching.push(...pitching);
            const runs = batting.reduce((n, b) => n + b.r, 0);
            if (team === home) game.homeRuns = runs;
            else game.awayRuns = runs;
            for (const p of players.filter(
              (p) =>
                teamAt(p, day) === team &&
                !batting.some((b) => b.playerId === p.playerId) &&
                p.listedRoles[0] === "batter",
            ))
              if (
                !absences.some(
                  (a) => a.playerId === p.playerId && a.date === date(day),
                )
              )
                absences.push({
                  playerId: p.playerId,
                  date: date(day),
                  reason: "did_not_play",
                });
          }
        games.push(game);
      }
  }
  // Keep before/after evidence; only corrected lines enter season aggregates.
  const corrected = games.find((g) =>
    g.events.some((e) => e.outcome === "strikeout"),
  )!;
  const eventIndex = corrected.events.findIndex(
    (e) => e.outcome === "strikeout",
  );
  const event = corrected.events[eventIndex];
  const batter = corrected.batting.find((b) => b.playerId === event.batter)!;
  const pitcher = corrected.pitching.find((p) => p.playerId === event.pitcher)!;
  const corrections = [
    {
      gameId: corrected.gameId,
      eventIndex,
      before: { ...event },
      after: { ...event, outcome: "out" },
      reason: "가상 기록원 삼진 분류 정정",
      correctedAt: AS_OF,
      previousRevision: 1,
      revision: 2,
    },
  ];
  event.outcome = "out";
  batter.so--;
  pitcher.so--;
  corrected.revision = 2;
  const summaries = players.map((p) => {
    const lines = games
      .flatMap((g) => (p.listedRoles[0] === "batter" ? g.batting : g.pitching))
      .filter((b) => b.playerId === p.playerId);
    const stats = lines.reduce(
      (s, b) => {
        for (const key of Object.keys(s) as (keyof typeof s)[])
          s[key] += b[key];
        return s;
      },
      {
        ab: 0,
        h: 0,
        hr: 0,
        r: 0,
        rbi: 0,
        so: 0,
        pa: 0,
        bb: 0,
        outsRecorded: 0,
        er: 0,
        bf: 0,
      },
    );
    return { ...p, teamId: teamAt(p, 29), sampleSize: lines.length, stats };
  });
  return {
    version: "2.0.0",
    seed,
    algorithm: "LCG32 Numerical Recipes (Math.imul)",
    releaseId: "synthetic_v2",
    demo: true,
    sourceId: "synthetic_v2",
    season: 2026,
    competition: "regular",
    asOf: AS_OF,
    lastUpdatedAt: AS_OF,
    teams,
    players: summaries,
    games,
    absences,
    trades: [
      {
        playerId: "demo_0_00",
        from: "sample_0",
        to: "sample_1",
        effectiveOn: date(15),
      },
    ],
    corrections,
  };
}
export type Fixture = ReturnType<typeof generate>;
