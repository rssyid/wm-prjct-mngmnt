import { apiSuccess, handleApiError } from "@/lib/api-error";
import { progressCreateSchema } from "@/lib/validations/progress.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import { createProgressLog, listProgressLogs } from "@/server/services/progress.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/progress
 * Mengambil daftar riwayat progres mingguan pada proyek
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();
    const logs = await listProgressLogs(params.id);
    return apiSuccess(logs);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil daftar log progres");
  }
}

/**
 * POST /api/projects/[id]/progress
 * Membuat log progres mingguan:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - workPackageId + weekNo wajib
 * - Duplikat (workPackageId, weekNo) -> 409
 * - logDate tidak boleh di masa depan
 * - Foto = array URL
 * - Recalculate progres paket & proyek di dalam transaksi database
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validatedData = progressCreateSchema.parse(body);

    const created = await createProgressLog(
      {
        projectId: params.id,
        workPackageId: validatedData.workPackageId,
        logDate: validatedData.logDate,
        weekNo: validatedData.weekNo,
        progressPct: validatedData.progressPct,
        volumeAchieved: validatedData.volumeAchieved,
        volumeUnit: validatedData.volumeUnit,
        workDescription: validatedData.workDescription,
        weatherCondition: validatedData.weatherCondition,
        waterLevelCm: validatedData.waterLevelCm,
        photos: validatedData.photos,
      },
      session.user.id
    );

    return apiSuccess(created, undefined, 201);
  } catch (error) {
    return handleApiError(error, "Gagal menyimpan log progres mingguan");
  }
}
