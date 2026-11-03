import "server-only";
import type { Meta, Player, PlayersQuery } from "../../contracts/api";
export interface PlayerRepository {
  metadata(scope: Pick<PlayersQuery, "season" | "competition">): Promise<Meta>;
  list(
    query: PlayersQuery,
    after: { name: string; id: string } | null,
  ): Promise<Player[]>;
  find(playerId: string, meta: Meta): Promise<Player | null>;
}
