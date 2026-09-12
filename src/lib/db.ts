import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add a Postgres connection string (e.g. from Vercel Storage or Neon/Supabase) to your environment.",
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

// A lazy proxy rather than a real client constructed at module scope: Next's
// build-time page-data collection imports every route module (just to read
// its config), which runs this file's top-level code without ever handling
// a request. Constructing the real client there would require DATABASE_URL
// to be readable at build time — which it isn't when it's a Vercel
// "Sensitive" env var, only decrypted for the app at runtime. Deferring
// construction to first actual use means importing this module is always
// safe; only a real query needs the connection to exist.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});
