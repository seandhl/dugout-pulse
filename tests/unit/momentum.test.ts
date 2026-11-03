import { describe, expect, it } from "vitest";
import {
  extractMomentumBaseline,
  momentumConfig,
  median,
  robustNormalize,
  shrinkage,
  scoreMomentum,
  splitWindows,
  type Input,
  type Row,
  type Role,
} from "../../src/stats/momentum";

import { fixture } from "../../fixtures/stats/momentum-input";
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
function changeTarget(input: Input, fn: (r: Row) => Row): Input {
  return {
    ...input,
    rows: input.rows.map((r) => (r.playerId === "target" ? fn(r) : r)),
  };
}
function ready(input = fixture()) {
  const result = scoreMomentum(input);
  expect(result.status).toBe("ready");
  if (
    result.status !== "ready" ||
    !result.explanation ||
    !("terms" in result.explanation)
  )
    throw Error("Expected ready");
  return result;
}

describe("robust numeric primitives", () => {
  it("even median", () => expect(median([4, 1, 3, 2])).toBe(2.5));
  it("odd median", () => expect(median([100, 2, 1])).toBe(2));
  it("empty median", () => expect(median([])).toBeNull());
  it.each([NaN, Infinity, -Infinity])("invalid median %s", (x) =>
    expect(median([x])).toBeNull(),
  );
  it.each([NaN, Infinity, -Infinity])("invalid normalize %s", (x) =>
    expect(robustNormalize(x, 0, 1)).toBeNull(),
  );
  it("zero scale", () => expect(robustNormalize(1, 0, 0)).toBeNull());
  it("negative direction", () =>
    expect(robustNormalize(0.1, 0.2, 0.02, -1)).toBe(3));
  it("extreme finite subtraction clips", () =>
    expect(robustNormalize(Number.MAX_VALUE, -Number.MAX_VALUE, 0.01)).toBe(3));
  it("zero opportunity is real zero", () => expect(shrinkage(0, 40)).toBe(0));
  it("n/(n+tau)", () => expect(shrinkage(40, 40)).toBe(0.5));
  it("invalid tau", () => expect(shrinkage(40, 0)).toBeNull());
  it("overflow safe shrinkage", () =>
    expect(shrinkage(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(0.5));
});
describe("raw-row model", () => {
  it.each(["hitter", "starting_pitcher", "relief_pitcher"] as const)(
    "finite %s and zero MAD floor",
    (role) => {
      const r = ready(fixture(role));
      expect(Number.isFinite(r.rawScore)).toBe(true);
      expect(
        r.explanation.terms.every((t) => t.scale! > 0 && t.mad === 0),
      ).toBe(true);
    },
  );
  it("ties stay exactly neutral with delta zero", () => {
    const r = ready();
    expect(r.rawScore).toBe(50);
    expect(r.delta).toBe(0);
  });
  it("does not round", () => {
    const r = ready(
      changeTarget(fixture(), (r) => ({ ...r, counts: { ...r.counts, h: 2 } })),
    );
    expect(r.rawScore).not.toBe(Math.round(r.rawScore! * 10) / 10);
  });
  it("high average in 3 AB is insufficient", () => {
    const f = fixture();
    f.rows = [
      {
        ...row("target", 20),
        asOf: "2026-10-21T13:00:00Z",
        counts: { ...counts, pa: 3, ab: 3, h: 3, so: 0 },
      },
    ];
    expect(scoreMomentum(f).status).toBe("insufficient_sample");
  });
  it("one game with many PA still fails appearances", () => {
    const f = fixture();
    f.rows = f.rows.filter(
      (r) => r.playerId !== "target" || r.gameId === "g20",
    );
    expect(scoreMomentum(f).status).toBe("insufficient_sample");
  });
  it("starter 0.2 IP means two outs, never decimal innings", () => {
    const f = changeTarget(fixture("starting_pitcher"), (r) => ({
      ...r,
      counts: { ...r.counts, outsRecorded: 2 },
    }));
    expect(scoreMomentum(f).status).toBe("insufficient_sample");
  });
  it("zero runs and ER are valid and not scoring features", () => {
    const r = ready(fixture("starting_pitcher"));
    expect(r.explanation.terms.map((t) => t.id)).not.toContain("ERA");
  });
  it("complete no-hit batting yields finite below-neutral score", () => {
    const r = ready(
      changeTarget(fixture(), (r) => ({ ...r, counts: { ...r.counts, h: 0 } })),
    );
    expect(r.rawScore).toBeLessThan(50);
  });
  it("long absence is inactive, no zero penalty", () => {
    const f = fixture();
    f.cutoffAt = "2026-11-10T00:00:00Z";
    const r = scoreMomentum(f);
    expect(r.status).toBe("inactive");
    expect(r.rawScore).toBeNull();
  });
  it("rest notice does not change score", () => {
    const f = fixture();
    f.cutoffAt = "2026-10-26T00:00:00Z";
    const r = ready(f);
    expect(r.flags).toContain("rest_gap");
    expect(r.rawScore).toBe(50);
  });
  it("unregistered roster explains absence without degrading score", () => {
    const f = fixture();
    f.roster.status = "unregistered";
    f.roster.reason = "명시된 말소";
    expect(ready(f).rawScore).toBe(50);
  });
  it.each([null, undefined])("missing PA %s is not zero", (pa) => {
    expect(
      scoreMomentum(
        changeTarget(fixture(), (r) => ({ ...r, counts: { ...r.counts, pa } })),
      ).status,
    ).toBe("missing_data");
  });
  it("zero PA is insufficient rather than missing", () => {
    const f = changeTarget(fixture(), (r) => ({
      ...r,
      counts: { ...counts, pa: 0, ab: 0, h: 0, so: 0 },
    }));
    expect(scoreMomentum(f).status).toBe("insufficient_sample");
  });
  it("baseline insufficient", () => {
    const f = fixture();
    f.rows = f.rows.filter((r) => r.playerId === "target");
    expect(scoreMomentum(f).status).toBe("baseline_unavailable");
  });
  it("one missing feature redistributes original weights", () => {
    const r = ready(
      changeTarget(fixture(), (r) => ({
        ...r,
        counts: { ...r.counts, so: null },
      })),
    );
    expect(r.flags).toContain("weights_redistributed");
    expect(r.explanation.terms.map((t) => t.weight)).toEqual([
      0.4 / 0.75,
      0.35 / 0.75,
    ]);
  });
  it("two missing features withhold", () => {
    expect(
      scoreMomentum(
        changeTarget(fixture(), (r) => ({
          ...r,
          counts: { ...r.counts, so: null, doubles: null },
        })),
      ).status,
    ).toBe("missing_data");
  });
  it("one missing row poisons whole feature, not row deletion", () => {
    const r = ready(
      changeTarget(fixture(), (r) =>
        r.gameId === "g20" ? { ...r, counts: { ...r.counts, so: null } } : r,
      ),
    );
    expect(r.explanation.terms.map((t) => t.id)).not.toContain("KRate");
  });
  it("W/S disjoint and V intentional overlap", () => {
    const f = fixture();
    const w = splitWindows(
      f.rows.filter((r) => r.playerId === "target"),
      "hitter",
    );
    expect(w.W.length).toBe(10);
    expect(w.S.length).toBe(1);
    expect(w.S.some((s) => w.W.some((r) => r.gameId === s.gameId))).toBe(false);
    expect(
      w.V.filter((v) => w.W.some((r) => r.gameId === v.gameId)).length,
    ).toBe(9);
  });
  it("different season cannot fill cohort", () => {
    const f = fixture();
    f.rows = f.rows.map((r) =>
      r.playerId === "target" ? r : { ...r, season: 2025 },
    );
    expect(scoreMomentum(f).status).toBe("baseline_unavailable");
  });
  it("different competition cannot fill cohort", () => {
    const f = fixture();
    f.rows = f.rows.map((r) =>
      r.playerId === "target" ? r : { ...r, competition: "postseason" },
    );
    expect(scoreMomentum(f).status).toBe("baseline_unavailable");
  });
  it("baseline uses only strict preceding boundary", () => {
    const f = fixture();
    f.rows = f.rows.map((r) =>
      r.playerId === "target" ? r : { ...r, playedOn: "2026-10-21" },
    );
    expect(scoreMomentum(f).status).toBe("baseline_unavailable");
  });
  it("no appearances", () => {
    const f = fixture();
    f.rows = [];
    expect(scoreMomentum(f).status).toBe("no_appearances");
  });
  it("coverage missing", () =>
    expect(
      scoreMomentum({ ...fixture(), coverageComplete: false }).status,
    ).toBe("missing_data"));
  it("last date unknown", () =>
    expect(
      scoreMomentum({ ...fixture(), lastAppearanceDate: null }).status,
    ).toBe("missing_data"));
  it("last date mismatch", () =>
    expect(
      scoreMomentum({ ...fixture(), lastAppearanceDate: "2026-10-20" }).status,
    ).toBe("invalid_input"));
  it.each([NaN, Infinity, -1, 0.5])("invalid count %s", (h) =>
    expect(
      scoreMomentum(
        changeTarget(fixture(), (r) => ({ ...r, counts: { ...r.counts, h } })),
      ).status,
    ).toBe("invalid_input"),
  );
  it("duplicate game rejected", () => {
    const f = fixture();
    f.rows = [...f.rows, f.rows.at(-1)!];
    expect(scoreMomentum(f).status).toBe("invalid_input");
  });
  it("unresolved revisions rejected", () =>
    expect(
      scoreMomentum({ ...fixture(), revisionsResolved: false }).status,
    ).toBe("invalid_input"));
  it("rights denied", () =>
    expect(
      scoreMomentum({ ...fixture(), demo: false } as unknown as Input).status,
    ).toBe("rights_denied"));
  it("future corrections excluded", () => {
    const f = fixture();
    f.rows = f.rows.map((r) => ({ ...r, asOf: "2026-12-01T00:00:00Z" }));
    expect(scoreMomentum(f).status).toBe("no_appearances");
  });
  it("deterministic independent of input order", () => {
    const f = fixture();
    expect(scoreMomentum({ ...f, rows: [...f.rows].reverse() })).toEqual(
      scoreMomentum(f),
    );
  });
  it("does not mutate frozen input", () => {
    const f = fixture();
    f.rows.forEach((r) => {
      Object.freeze(r.counts);
      Object.freeze(r);
    });
    Object.freeze(f.rows);
    Object.freeze(f);
    expect(scoreMomentum(f)).toEqual(scoreMomentum(f));
  });
  it("previous window failure disables ALL P terms", () => {
    const f = fixture();
    f.rows = f.rows.filter(
      (r) =>
        r.playerId !== "target" || ["g18", "g19", "g20"].includes(r.gameId),
    );
    const r = ready(f);
    expect(r.previousValue).toBeNull();
    expect(r.explanation.terms.every((t) => t.P === 0)).toBe(true);
  });
});

describe("policy regression and replay", () => {
  it("hand-calculated clipped OBP + shrinkage + sigmoid", () => {
    const r = ready(
      changeTarget(fixture(), (r) => ({ ...r, counts: { ...r.counts, h: 2 } })),
    );
    const expected = 100 / (1 + Math.exp(-0.5 * 0.4 * 0.55 * 3));
    expect(r.rawScore).toBeCloseTo(expected, 12);
    expect(r.explanation.rW).toBe(0.5);
  });
  it("cohort is one observation per player and leaves target out", () => {
    const r = extractMomentumBaseline(fixture());
    expect(r.status).toBe("ready");
    expect(
      r.artifact?.features.every(
        (f) =>
          f.count === 20 && f.included.every((c) => c.playerId !== "target"),
      ),
    ).toBe(true);
  });
  it("a cohort extreme outlier does not move median or MAD", () => {
    const f = fixture();
    f.rows = f.rows.map((r) =>
      r.playerId === "cohort0"
        ? { ...r, counts: { ...r.counts, h: 4, so: 0, hr: 4 } }
        : r,
    );
    const b = extractMomentumBaseline(f).artifact!.features;
    expect(b.find((f) => f.id === "OBP")?.median).toBe(0.25);
    expect(b.find((f) => f.id === "OBP")?.mad).toBe(0);
    expect(ready(f).rawScore).toBe(50);
  });
  it("exact stale threshold allowed, next day inactive", () => {
    const f = fixture();
    f.cutoffAt = "2026-11-04T00:00:00Z";
    expect(scoreMomentum(f).status).toBe("ready");
    f.cutoffAt = "2026-11-05T00:00:00Z";
    expect(scoreMomentum(f).status).toBe("inactive");
  });
  it("KST calendar rollover controls staleness", () => {
    const f = fixture();
    f.cutoffAt = "2026-11-04T14:59:59Z";
    expect(scoreMomentum(f).status).toBe("ready");
    f.cutoffAt = "2026-11-04T15:00:00Z";
    expect(scoreMomentum(f).status).toBe("inactive");
  });
  it("different role cannot fill baseline", () => {
    const f = fixture("starting_pitcher");
    f.rows = f.rows.map((r) =>
      r.playerId === "target" ? r : { ...r, role: "relief_pitcher" },
    );
    expect(scoreMomentum(f).status).toBe("baseline_unavailable");
  });
  it("different release cannot fill baseline", () => {
    const f = fixture();
    f.rows = f.rows.map((r) =>
      r.playerId === "target" ? r : { ...r, releaseId: "other" },
    );
    expect(scoreMomentum(f).status).toBe("baseline_unavailable");
  });
  it("zero outs is known sample, not missing", () => {
    const f = changeTarget(fixture("relief_pitcher"), (r) => ({
      ...r,
      counts: { ...r.counts, outsRecorded: 0 },
    }));
    expect(scoreMomentum(f).status).toBe("insufficient_sample");
  });
  it("negative K-BB is a valid transformed feature", () => {
    const f = changeTarget(fixture("starting_pitcher"), (r) => ({
      ...r,
      counts: { ...r.counts, so: 0, bb: 5 },
    }));
    const r = ready(f);
    expect(r.explanation.terms.find((f) => f.id === "KMinusBB")?.current).toBe(
      -0.2,
    );
  });
  it("retaining two features below .60 weight is insufficient", () => {
    const f = changeTarget(fixture("relief_pitcher"), (r) => ({
      ...r,
      counts: { ...r.counts, so: null },
    }));
    expect(scoreMomentum(f).status).toBe("missing_data");
  });
  it("unknown BB convention rejects pitching input", () => {
    expect(
      scoreMomentum(
        changeTarget(fixture("starting_pitcher"), (r) => ({
          ...r,
          walkDefinition: undefined,
        })),
      ).status,
    ).toBe("invalid_input");
  });
  it("PA event mismatch rejects input", () => {
    expect(
      scoreMomentum(
        changeTarget(fixture(), (r) => ({
          ...r,
          counts: { ...r.counts, pa: 5 },
        })),
      ).status,
    ).toBe("invalid_input");
  });
  it("personal baseline becomes eligible without double counting W", () => {
    const f = fixture();
    f.rows = [
      ...f.rows,
      ...Array.from({ length: 10 }, (_, i) => ({
        ...row("target", i),
        asOf: "2026-10-21T13:00:00Z",
      })),
    ];
    const r = ready(f);
    expect(r.explanation.summaries.S.appearances).toBe(11);
    expect(r.explanation.terms.every((f) => f.rS > 0)).toBe(true);
    expect(r.explanation.previousOverlapsS).toBe(true);
  });
  it("strict ASCII game ID order resolves same-day DH", () => {
    const a = row("target", 1),
      b = { ...a, gameId: "A" },
      c = { ...a, gameId: "a" };
    const w = splitWindows([c, b], "hitter");
    expect(w.W.map((r) => r.gameId)).toEqual(["A", "a"]);
  });
  it("returned config mutation cannot change policy", () => {
    const c = momentumConfig("hitter");
    c.min[1] = 0;
    c.features[0].weight = 0.4;
    expect(momentumConfig("hitter").min[1]).toBe(12);
  });
  it("all numeric output recursively finite", () => {
    const check = (x: unknown): void => {
      if (typeof x === "number") expect(Number.isFinite(x)).toBe(true);
      else if (x && typeof x === "object") Object.values(x).forEach(check);
    };
    for (const role of [
      "hitter",
      "starting_pitcher",
      "relief_pitcher",
    ] as const)
      check(scoreMomentum(fixture(role)));
  });
});

it("normalize avoids subtraction overflow even when scale is large", () => {
  expect(
    robustNormalize(Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE),
  ).toBe(2);
});
it("timezone-free timestamp is rejected", () => {
  expect(
    scoreMomentum({ ...fixture(), cutoffAt: "2026-10-21T14:00:00" }).status,
  ).toBe("invalid_input");
});
it("invalid calendar timestamp is rejected", () => {
  expect(
    scoreMomentum({ ...fixture(), cutoffAt: "2026-02-30T14:00:00Z" }).status,
  ).toBe("invalid_input");
});

it("window helper refuses mixed-season source rows", () => {
  expect(() =>
    splitWindows(
      [row("target", 1), { ...row("target", 2), season: 2025 }],
      "hitter",
    ),
  ).toThrow("one player/scope/release");
});
