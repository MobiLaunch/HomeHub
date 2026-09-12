import { spawnSync } from "node:child_process";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL;

if (databaseUrl) {
  console.log("HomeHub: applying Prisma migrations...");
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} else {
  console.warn(
    "HomeHub: no database connection variable is available during the Vercel build; skipping Prisma migrations. Runtime APIs still require a configured Postgres connection.",
  );
}

for (const [command, args] of [
  ["npx", ["prisma", "generate"]],
  ["npx", ["next", "build"]],
]) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
