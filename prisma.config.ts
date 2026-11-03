// Dependency-free configuration; Prisma CLI is not installed in this DEMO phase.
const config = {
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
};

export default config;
