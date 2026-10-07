import { apiSuccess, handleApiError } from "@/lib/api-error";
import { progressUpdateSchema } from "@/lib/validations/progress.schema";
import { requireRole } from "@/server/auth-guard";
import { deleteProgressLog, updateProgressLog } from "@/server/services/progress.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
    logId: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * PUT /api/projects/[id]/progress/[logId]
 * Memperbarui log progres mingguan:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - Aturan B6: hanya minggu berjalan (weekNo == minggu berjalan proyek) boleh diubah; minggu lampau -> 409
 * - Progres paket & proyek dihitung ulang secara atomik di transaksi
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validatedData = progressUpdateSchema.parse(body);

    const updated = await updateProgressLog(
      params.logId,
      {
        logDate: validatedData.logDate,
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

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui log progres");
  }
}

/**
 * DELETE /api/projects/[id]/progress/[logId]
 * Menghapus log progres mingguan (koreksi):
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - Aturan B6: hanya minggu berjalan yang boleh dihapus; minggu lampau -> 409
 * - Progres paket & proyek dihitung ulang secara atomik di transaksi
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const result = await deleteProgressLog(params.logId, session.user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menghapus log progres");
  }
}
