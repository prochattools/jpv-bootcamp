import { PrismaClient } from "@prisma/client";

function buildDatasourceUrl(): string {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    // TCP keepalive: prevents Docker NAT from silently dropping idle connections
    if (!u.searchParams.has("keepalives")) u.searchParams.set("keepalives", "1");
    if (!u.searchParams.has("keepalives_idle")) u.searchParams.set("keepalives_idle", "60");
    // Fail fast on new connection attempts instead of hanging for the OS TCP timeout
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "10");
    return u.toString();
  } catch {
    return raw;
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildDatasourceUrl() } },
});

export default prisma;
