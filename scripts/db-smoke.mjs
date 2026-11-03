// Requires generated Prisma Client; Node 26 supports TypeScript imports.
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const [row] =
    await db.$queryRaw`SELECT 17::integer AS outs_recorded, NULL::integer AS np`;
  assert.equal(row.outs_recorded, 17);
  assert.equal(row.np, null);
  await db
    .$transaction(async (tx) => {
      await tx.playerIdentity.createMany({
        data: [{ player_id: "demo_smoke_a" }, { player_id: "demo_smoke_b" }],
      });
      assert.equal(
        await tx.playerIdentity.count({
          where: {
            player_id: { in: ["demo_smoke_a", "demo_smoke_b"] },
          },
        }),
        2,
      );
      // Deliberate rollback makes this repeatable without deleting audit/history.
      throw new Error("SMOKE_ROLLBACK");
    })
    .catch((error) => {
      if (error.message !== "SMOKE_ROLLBACK") throw error;
    });
  console.log("DB smoke PASS (query, Prisma write/read, rollback)");
} finally {
  await db.$disconnect();
}
