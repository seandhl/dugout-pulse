import "server-only";
import { publicationIdentity } from "./publication";
import { readDemo } from "../db/demo";
import { playerSchema, type PlayersQuery } from "../../contracts/api";
import type { PlayerRepository } from "../ports/players";
import { ApiError } from "../http/errors";
const readPlayers = () => readDemo().players.map((p) => playerSchema.parse(p));
export const demoRepository: PlayerRepository = {
  async metadata(scope) {
    const fixture = readDemo();
    if (
      scope.season !== fixture.season ||
      scope.competition !== fixture.competition
    )
      throw new ApiError(
        "DATA_UNAVAILABLE",
        503,
        "제공되지 않는 DEMO 시즌·대회입니다.",
      );
    return {
      demo: true,
      season: scope.season,
      competition: scope.competition,
      sourceMode: "DEMO",
      asOf: fixture.asOf,
      lastUpdatedAt: fixture.lastUpdatedAt,
      releaseId: fixture.releaseId,
      revision: publicationIdentity().revision,
    };
  },
  async list(query: PlayersQuery, after) {
    const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const order = (
      a: { displayName: string; playerId: string },
      b: { displayName: string; playerId: string },
    ) =>
      (query.sort === "name_asc" ? 1 : -1) *
        compare(a.displayName, b.displayName) ||
      compare(a.playerId, b.playerId);
    return readPlayers()
      .filter(
        (p) =>
          (!query.role || p.listedRoles.includes(query.role)) &&
          (!query.q || p.displayName.includes(query.q.normalize("NFC"))),
      )
      .sort(order)
      .filter(
        (p) =>
          !after ||
          order(p, { displayName: after.name, playerId: after.id }) > 0,
      )
      .slice(0, query.limit + 1);
  },
  async find(id) {
    return readPlayers().find((p) => p.playerId === id) ?? null;
  },
};
