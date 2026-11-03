import "server-only";
import type { PlayerRepository } from "../ports/players";
import { metaSchema, playerSchema } from "../../contracts/api";
import {
  publishGate,
  ProviderError,
  type RightsRegistry,
} from "../ingest/gate";
// DB projector must enforce published batch + current rights inside its transaction.
// No raw SQL or browser-provided order expressions cross this port.
export function createDatabaseRepository(
  projector: PlayerRepository,
  publication?: { currentBatch(): unknown; registry: RightsRegistry },
): PlayerRepository {
  const authorize = () => {
    if (!publication)
      throw new ProviderError(
        "RIGHTS_DENIED",
        "게시 배치 및 권리 registry가 필요합니다.",
      );
    const batch = publishGate(publication.currentBatch(), publication.registry);
    // The current public DTO supports DEMO only. Real data needs a separate release integration.
    if (batch.mode !== "DEMO")
      throw new ProviderError(
        "RIGHTS_DENIED",
        "실제 데이터 공개 경로가 활성화되지 않았습니다.",
      );
  };
  return {
    async metadata(scope) {
      authorize();
      return metaSchema.parse(await projector.metadata(scope));
    },
    async list(query, after) {
      authorize();
      return (await projector.list(query, after)).map((row) =>
        playerSchema.parse(row),
      );
    },
    async find(id, meta) {
      authorize();
      const row = await projector.find(id, meta);
      return row ? playerSchema.parse(row) : null;
    },
  };
}
