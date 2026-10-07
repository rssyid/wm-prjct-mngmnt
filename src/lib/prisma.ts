import { Pool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Node 20 (runtime Vercel) belum punya WebSocket global — dibutuhkan Pool Neon.
neonConfig.webSocketConstructor = ws;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diset");
  }

  // Runtime selalu lewat driver serverless Neon (HTTP/WebSocket), bukan TCP langsung (STACK.md §2).
  const adapter = new PrismaNeon(new Pool({ connectionString }));

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
