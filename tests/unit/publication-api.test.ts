import { expect, it, vi } from "vitest";
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (String(args[0]).endsWith("/pipeline/state.json"))
        return JSON.stringify({ version: 1, revision: 1, records: {} });
      return actual.readFileSync(...args);
    },
  };
});
import { GET as meta } from "../../src/app/api/v1/meta/route";
import { GET as home } from "../../src/app/api/v1/home/route";
import { GET as players } from "../../src/app/api/v1/players/route";
import { GET as player } from "../../src/app/api/v1/players/[id]/route";
import { GET as directory } from "../../src/app/api/v1/player-directory/route";
import { GET as batting } from "../../src/app/api/v1/players/[id]/batting/route";
import { GET as pitching } from "../../src/app/api/v1/players/[id]/pitching/route";
import { GET as momentum } from "../../src/app/api/v1/players/[id]/momentum/route";
import { GET as rankings } from "../../src/app/api/v1/rankings/route";
import { GET as published } from "../../src/app/api/v1/published/route";
import { GET as scope } from "../../src/app/api/v1/scope/route";
const context = { params: Promise.resolve({ id: "demo_0_00" }) };
for (const [name, run] of Object.entries({
  meta,
  home,
  players,
  directory,
  rankings,
  published,
  scope,
  player: (request: Request) => player(request, context),
  batting: (request: Request) => batting(request, context),
  pitching: (request: Request) => pitching(request, context),
  momentum: (request: Request) => momentum(request, context),
})) {
  it(`${name} blocks unlinked releases without caching or leaking records`, async () => {
    const query = ["rankings", "momentum"].includes(name) ? "?role=hitter" : "";
    const response = await run(
      new Request(`http://localhost/api/v1/test${query}`),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(await response.json())).toContain(
      "게시 릴리스 연결 대기",
    );
  });
}
