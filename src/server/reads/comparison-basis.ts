import "server-only";
import type {
  ComparisonBasis,
  ComparisonPoint,
} from "../../contracts/comparison-basis";
import type { MomentumSnapshot } from "./momentum";
import type { PipelineState } from "../ingest/pipeline";
import type { Fixture } from "../../demo/generator";
import type { Row } from "../../stats/momentum";
import { MODEL } from "../../stats/momentum";

export function publicationBasis(
  state: PipelineState,
  s: MomentumSnapshot,
): ComparisonBasis {
  const point = (snapshot: MomentumSnapshot): ComparisonPoint => ({
    season: snapshot.season,
    competition: snapshot.competition,
    role: snapshot.role,
    window: snapshot.window,
    modelVersion: snapshot.modelVersion,
    snapshotId: snapshot.id,
    asOf: snapshot.asOf,
    sourceIds: snapshot.sourceIds,
    inputRefs: snapshot.inputRefs,
  });
  const previous = s.previousSnapshotId
    ? state.momentumSnapshots?.[s.previousSnapshotId]
    : null;
  return {
    kind: "previous_eligible_publication",
    current: point(s),
    previous: previous ? point(previous) : null,
  };
}

export function movingBasis(
  f: Fixture,
  role: ComparisonPoint["role"],
  window: string,
  own: Row[],
): ComparisonBasis | null {
  if (window === "season") return null;
  const n = Number(window);
  const point = (rows: Row[]): ComparisonPoint => ({
    season: f.season,
    competition: "regular",
    role,
    window: n,
    modelVersion: MODEL,
    snapshotId: f.releaseId,
    asOf: f.asOf,
    sourceIds: [...new Set(rows.map((r) => r.sourceId))],
    inputRefs: rows.map((r) => r.inputRef),
  });
  return {
    kind: "moving_appearance_window",
    current: point(own.slice(-n)),
    previous: own.length > 1 ? point(own.slice(0, -1).slice(-n)) : null,
  };
}
