import { apiSuccess, handleApiError } from "@/lib/api-error";
import { packageCreateSchema } from "@/lib/validations/package.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  createPackage,
  listProjectPackages,
} from "@/server/services/package.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/packages
 * Mengambil seluruh paket pengadaan pada proyek
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();
    const packages = await listProjectPackages(params.id);
    return apiSuccess(packages);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil daftar paket kerja");
  }
}

/**
 * POST /api/projects/[id]/packages
 * Membuat paket pengadaan baru:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - Gerbang B3: Dokumen AFCE wajib APPROVED (403 jika belum)
 * - Memicu transisi T5 ke status PROCUREMENT jika paket pertama
 * - Validasi tanggal prUspkDate <= poSpkDate via Zod
 * - Validasi bobot total paket per proyek <= 100% (400)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validatedData = packageCreateSchema.parse(body);

    const created = await createPackage(
      params.id,
      validatedData,
      session.user.id
    );

    return apiSuccess(created, undefined, 201);
  } catch (error) {
    return handleApiError(error, "Gagal membuat paket kerja pengadaan");
  }
}
