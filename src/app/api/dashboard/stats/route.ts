import { apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth-guard";
import { AfceStatus, ProjectStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * Mengambil ringkasan statistik KPI proyek dan hitungan notifikasi:
 * - rejectedArCount: jumlah AFCE berstatus REJECTED
 * - waitingApprovalCount: jumlah proyek WAITING_AFCE_AR
 * - totalPendingNotifications: jumlah AR ditolak + menunggu approval
 */
export async function GET() {
  try {
    await requireSession();

    const [
      rejectedArCount,
      waitingApprovalCount,
      activeProjectsCount,
      completedProjectsCount,
    ] = await Promise.all([
      prisma.afceDocument.count({
        where: {
          status: AfceStatus.REJECTED,
          project: { deletedAt: null },
        },
      }),
      prisma.project.count({
        where: {
          status: ProjectStatus.WAITING_AFCE_AR,
          deletedAt: null,
        },
      }),
      prisma.project.count({
        where: {
          deletedAt: null,
        },
      }),
      prisma.project.count({
        where: {
          status: ProjectStatus.COMPLETED,
          deletedAt: null,
        },
      }),
    ]);

    const stats = {
      rejectedArCount,
      waitingApprovalCount,
      totalPendingNotifications: rejectedArCount + waitingApprovalCount,
      activeProjectsCount,
      completedProjectsCount,
    };

    return apiSuccess(stats);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil statistik dashboard");
  }
}
