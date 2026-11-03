import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { id, type PlayersQuery } from "../../contracts/api";
import type { PlayerRepository } from "../ports/players";
import { ApiError } from "../http/errors";
const cursorSchema = z
  .object({ scope: z.string(), name: z.string().max(100), id })
  .strict();
export function createPlayerService(
  repository: PlayerRepository,
  cursorKey: string,
) {
  const sign = (body: string) =>
    createHmac("sha256", cursorKey).update(body).digest("base64url");
  return {
    meta: repository.metadata.bind(repository),
    async list(query: PlayersQuery) {
      const meta = await repository.metadata(query);
      const scope = JSON.stringify([
        meta,
        query.role,
        query.q?.normalize("NFC"),
        query.sort,
        query.limit,
      ]);
      let after = null;
      if (query.cursor) {
        try {
          const [body, signature, extra] = query.cursor.split(".");
          const expected = Buffer.from(sign(body));
          const actual = Buffer.from(signature ?? "");
          if (
            extra ||
            actual.length !== expected.length ||
            !timingSafeEqual(actual, expected)
          )
            throw new Error();
          const token = cursorSchema.parse(
            JSON.parse(Buffer.from(body, "base64url").toString()),
          );
          if (token.scope !== scope) throw new Error();
          after = token;
        } catch {
          throw new ApiError(
            "BAD_INPUT",
            400,
            "커서 또는 필터가 유효하지 않습니다.",
          );
        }
      }
      const rows = await repository.list(query, after);
      const hasMore = rows.length > query.limit;
      const data = rows.slice(0, query.limit);
      const last = data.at(-1);
      const body = last
        ? Buffer.from(
            JSON.stringify({
              scope,
              name: last.displayName,
              id: last.playerId,
            }),
          ).toString("base64url")
        : null;
      return {
        data,
        meta,
        pagination: {
          limit: query.limit,
          hasMore,
          nextCursor: hasMore && body ? `${body}.${sign(body)}` : null,
        },
        error: null,
      };
    },
    async find(
      playerId: string,
      query: Pick<PlayersQuery, "season" | "competition">,
    ) {
      const meta = await repository.metadata(query);
      const data = await repository.find(playerId, meta);
      if (!data) throw new ApiError("NOT_FOUND", 404, "공개 선수가 없습니다.");
      return { data, meta, pagination: null, error: null };
    },
  };
}
