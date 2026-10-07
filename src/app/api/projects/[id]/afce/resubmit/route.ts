import { apiSuccess, handleApiError } from "@/lib/api-error";
import { requireRole } from "@/server/auth-guard";
import { resubmitAfceDocument } from "@/server/services/afce.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/projects/[id]/afce/resubmit
 * Mengajukan ulang dokumen AFCE setelah REJECTED (B4):
 * - currentAttempt increment (+1)
 * - Snapshot baru dibuat dengan status WAITING
 * - History snapshot attempt lama TIDAK disentuh sama sekali
 * - AfceStatus kembali ke PENDING
 * - Status proyek kembali ke WAITING_AFCE_AR via transition service
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const result = await resubmitAfceDocument(params.id, session.user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal mengajukan ulang dokumen AFCE");
  }
}
