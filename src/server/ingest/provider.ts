import "server-only";
import { type DataProvider, type DataSource, sourceSchema } from "./contracts";
import { assertRights, ProviderError, type RightsRegistry } from "./gate";
/** Canonical JSON adapter. Vendor-specific parsers implement the same DataProvider port. */
export function createProvider(
  sourceInput: DataSource,
  registry: RightsRegistry,
): DataProvider {
  const source = sourceSchema.parse(sourceInput);
  const configured = () => {
    if (source.mode === "LICENSED_API")
      throw new ProviderError(
        "NOT_CONFIGURED",
        "LICENSED_API not configured: 실제 인증 및 계약 범위가 미설정입니다.",
      );
  };
  return {
    describeSource: () => structuredClone(source),
    async listAvailableSeasons() {
      configured();
      // No remote discovery or unverified season claims.
      return [];
    },
    async parseBatch(input) {
      configured();
      if (typeof input === "string") {
        if (Buffer.byteLength(input, "utf8") > 5 * 1024 * 1024)
          throw new ProviderError("INVALID_BATCH", "입력 한도는 5MiB입니다.");
        try {
          input = JSON.parse(input);
        } catch {
          throw new ProviderError(
            "INVALID_BATCH",
            "JSON 파일이 유효하지 않습니다.",
          );
        }
      } else if (
        Buffer.byteLength(JSON.stringify(input) ?? "", "utf8") >
        5 * 1024 * 1024
      ) {
        throw new ProviderError("INVALID_BATCH", "입력 한도는 5MiB입니다.");
      }
      const batch = assertRights(input, registry, "ingest");
      if (batch.sourceId !== source.sourceId || batch.mode !== source.mode)
        throw new ProviderError(
          "RIGHTS_DENIED",
          "공급자와 배치 출처가 다릅니다.",
        );
      return batch;
    },
  };
}
export async function ingest(
  provider: DataProvider,
  input: unknown,
  registry: RightsRegistry,
) {
  const description = sourceSchema.parse(provider.describeSource());
  if (description.mode === "LICENSED_API")
    throw new ProviderError("NOT_CONFIGURED", "LICENSED_API not configured");
  const batch = assertRights(
    await provider.parseBatch(input),
    registry,
    "ingest",
  );
  if (
    batch.sourceId !== description.sourceId ||
    batch.mode !== description.mode
  )
    throw new ProviderError("RIGHTS_DENIED", "공급자 출처 불일치");
  return batch;
}
