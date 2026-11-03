import { expect, it } from "vitest";
import { generate } from "../../src/demo/generator";
import {
  selectPlayerDetail,
  detailQuery,
} from "../../src/server/reads/player-detail";
it("aggregates raw counts for every window, retains missing fields, and orders doubleheaders", () => {
  const f = generate();
  for (const window of ["3", "5", "10", "20", "season"]) {
    const d = selectPlayerDetail(f, "demo_0_00", window)!;
    const h = d.games.reduce((s, g) => s + g.counts.h!, 0),
      ab = d.games.reduce((s, g) => s + g.counts.ab!, 0);
    expect(d.recent.metrics.avg.value).toBe(h / ab);
    expect(d.recent.metrics.ops.value).toBeNull();
    expect(d.recent.metrics.obp.reason).toBe("missing_fields");
    expect(d.games.at(-1)?.cumulative).toEqual(d.recent);
    expect(d.games.length).toBe(
      window === "season" ? d.season.sample.appearances : Number(window),
    );
  }
  expect(detailQuery.safeParse({ window: "4" }).success).toBe(false);
  expect(selectPlayerDetail(f, "missing", "10")).toBeNull();
});
it("handles no appearances and zero AB without inventing numbers", () => {
  const f = generate();
  f.games = [];
  const d = selectPlayerDetail(f, "demo_0_00", "3")!;
  expect(d.recent.metrics.avg.value).toBeNull();
  expect(d.games).toEqual([]);
  expect(d.momentum?.rawScore).toBeNull();
});
