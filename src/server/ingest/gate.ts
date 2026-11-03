import "server-only";
import {
  batchSchema,
  sourceSchema,
  licenseSchema,
  type IngestBatch,
} from "./contracts";
export class ProviderError extends Error {
  constructor(
    public readonly code: "NOT_CONFIGURED" | "RIGHTS_DENIED" | "INVALID_BATCH",
    message: string,
  ) {
    super(message);
  }
}
/** Resolve these records from trusted server storage, never from an uploaded file. */
export interface RightsRegistry {
  source(sourceId: string): unknown;
  license(licenseId: string): unknown;
}
export function assertRights(
  batchInput: unknown,
  registry: RightsRegistry,
  purpose: "ingest" | "publish",
  now = new Date(),
): IngestBatch {
  const parsed = batchSchema.safeParse(batchInput);
  if (!parsed.success)
    throw new ProviderError("INVALID_BATCH", "배치 계약이 유효하지 않습니다.");
  const batch = parsed.data;
  const source = sourceSchema.safeParse(registry.source(batch.sourceId));
  const license = licenseSchema.safeParse(registry.license(batch.licenseId));
  const deny = () => {
    throw new ProviderError(
      "RIGHTS_DENIED",
      "출처·라이선스 또는 허용 범위를 확인할 수 없습니다.",
    );
  };
  if (!source.success || !license.success) return deny();
  const s = source.data,
    l = license.data;
  if (s.mode === "LICENSED_API")
    throw new ProviderError(
      "NOT_CONFIGURED",
      "LICENSED_API not configured: 실제 인증 및 계약 범위가 미설정입니다.",
    );
  const uses =
    purpose === "ingest"
      ? (["collect", "store", "transform"] as const)
      : (["collect", "store", "transform", "display"] as const);
  if (
    !Number.isFinite(now.getTime()) ||
    s.sourceId !== batch.sourceId ||
    l.sourceId !== batch.sourceId ||
    l.licenseId !== batch.licenseId ||
    s.mode !== batch.mode ||
    l.mode !== batch.mode ||
    batch.namespace !== (batch.mode === "DEMO" ? "demo" : "licensed") ||
    Date.parse(batch.asOf) > now.getTime() ||
    Date.parse(batch.importedAt) > now.getTime()
  )
    return deny();
  for (const record of [s, l]) {
    if (
      record.status !== "APPROVED" ||
      Date.parse(record.validUntil) <= now.getTime() ||
      !record.transformAllowed ||
      !uses.every((u) => record.allowedUses.includes(u)) ||
      (purpose === "publish" && !record.displayAllowed)
    )
      return deny();
  }
  if (
    Date.parse(l.validFrom) > now.getTime() ||
    Date.parse(l.validFrom) >= Date.parse(l.validUntil) ||
    !l.allowedSeasons.includes(batch.season) ||
    !l.allowedCompetitions.includes(batch.competition)
  )
    return deny();
  for (const player of batch.players) {
    if (
      player.sourceId !== batch.sourceId ||
      Object.keys(player).some((field) => !l.allowedFields.includes(field))
    )
      return deny();
    if (
      player.stats &&
      Object.keys(player.stats).some(
        (field) => !l.allowedFields.includes(`stats.${field}`),
      )
    )
      return deny();
  }
  if (
    new Set(batch.players.map((p) => p.playerId)).size !== batch.players.length
  )
    return deny();
  return batch;
}
/** No persisted approval token: current rights are checked again on every read/publish. */
export function publishGate(
  batch: unknown,
  registry: RightsRegistry,
  now = new Date(),
) {
  return assertRights(batch, registry, "publish", now);
}
