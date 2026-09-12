import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getConnectionString(): string | undefined {
  // DATABASE_URL is the canonical setting, but Vercel Postgres commonly
  // exposes the same database through POSTGRES_PRISMA_URL/POSTGRES_URL.
  // Supporting those names prevents every API route from failing with a
  // database connection error when the storage integration is configured.
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

// Keep client creation lazy. Next.js imports route modules during build-time
// page-data collection, while deployment secrets may only be available at
// runtime. The first real database operation creates the client.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});
