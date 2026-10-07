import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Endpoint pemanas pra-jam kerja untuk database Neon:
 * - Memvalidasi header Authorization: Bearer <CRON_SECRET> (bila CRON_SECRET terkonfigurasi)
 * - Menjalankan SELECT 1 untuk verifikasi koneksi DB dan memanaskan compute instance
 * - Mengembalikan { ok: true }
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Jalankan SELECT 1 untuk verifikasi koneksi DB dan memanaskan Neon instance
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Database unreachable",
      },
      { status: 503 }
    );
  }
}
