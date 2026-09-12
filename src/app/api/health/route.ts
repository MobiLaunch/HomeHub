import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function hasDatabaseUrl() {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL,
  );
}

export async function GET() {
  const startedAt = Date.now();

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: false,
        service: "api",
        database: "not_configured",
        error: "No Postgres connection variable is configured.",
      },
      { status: 503 },
    );
  }

  try {
    await db.$queryRaw`SELECT 1`;
    await db.household.findUnique({ where: { id: "default" } });

    return NextResponse.json({
      ok: true,
      service: "api",
      database: "connected",
      schema: "available",
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;

    return NextResponse.json(
      {
        ok: false,
        service: "api",
        database: "error",
        code,
        error: message,
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
