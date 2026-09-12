import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getConnectionString(): string | undefined {
  // DATABASE_URL is the canonical setting, but Vercel Postgres commonly
  // exposes the same database through POSTGRES_PRISMA_URL/POSTGRES_URL.
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL
  );
}

function createClient() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      "No Postgres connection string is configured. Set DATABASE_URL (or POSTGRES_PRISMA_URL/POSTGRES_URL when using Vercel Postgres).",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// Keep client creation lazy so a build can import route modules without
// requiring deployment secrets. Bind Prisma methods to the real client: a
// plain Proxy forwarding an unbound method changes `this` to the Proxy and
// can make Prisma throw at runtime even when the database URL is valid.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient() as PrismaClient & Record<PropertyKey, unknown>;
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
