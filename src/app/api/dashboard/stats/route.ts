import { apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";
import { requireSession } from "@/server/auth-guard";
import {
  AfceStatus,
  PackageStatus,
  PaymentStatus,
  ProjectStatus,
  StatusIndicator,
} from "@prisma/client";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * Mengambil ringkasan statistik KPI proyek, early warning system (EWS),
 * proyek DELAYED teratas, ringkasan pengadaan outstanding, dan hitungan notifikasi.
 * Di-cache di Upstash Redis dengan TTL 60 detik (key: dash:global atau dash:company:{id}).
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const companyId = request.nextUrl.searchParams.get("companyId") || undefined;
    const cacheKey = companyId ? `dash:company:${companyId}` : "dash:global";

    // 1. Cek cache Upstash Redis
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return apiSuccess(cached);
        }
      } catch (cacheErr) {
        console.error("[Upstash Redis] Gagal membaca cache dashboard:", cacheErr);
      }
    }

    // Filter per company bila ada
    const baseProjectWhere = {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const basePackageWhere = {
      deletedAt: null,
      ...(companyId ? { project: { companyId, deletedAt: null } } : {}),
    };

    const [
      projectStatusGroups,
      indicatorGroups,
      totalProjects,
      activeProjectsCount,
      completedProjectsCount,
      topDelayedProjects,
      topAtRiskProjects,
      totalPackages,
      packageStatusGroups,
      outstandingPackagesCount,
      unpaidPackagesCount,
      undeliveredPackagesCount,
      rejectedArCount,
      waitingApprovalCount,
      holidaysThisYearCount,
    ] = await Promise.all([
      // 1. Total proyek per status
      prisma.project.groupBy({
        by: ["status"],
        where: baseProjectWhere,
        _count: { id: true },
      }),

      // 2. Total proyek per statusIndicator
      prisma.project.groupBy({
        by: ["statusIndicator"],
        where: baseProjectWhere,
        _count: { id: true },
      }),

      // 3. Total semua proyek aktif/non-aktif
      prisma.project.count({
        where: baseProjectWhere,
      }),

      // 4. Proyek aktif (bukan COMPLETED atau CANCELLED)
      prisma.project.count({
        where: {
          ...baseProjectWhere,
          status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
        },
      }),

      // 5. Proyek tuntas
      prisma.project.count({
        where: {
          ...baseProjectWhere,
          status: ProjectStatus.COMPLETED,
        },
      }),

      // 6. Proyek DELAYED teratas (maksimal 10)
      prisma.project.findMany({
        where: {
          ...baseProjectWhere,
          statusIndicator: StatusIndicator.DELAYED,
          status: { not: ProjectStatus.COMPLETED },
        },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          displayName: true,
          status: true,
          statusIndicator: true,
          progressPct: true,
          targetStartDate: true,
          targetEndDate: true,
          updatedAt: true,
          company: { select: { id: true, code: true, name: true } },
          estate: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ targetEndDate: "asc" }, { progressPct: "asc" }],
        take: 10,
      }),

      // 7. Proyek AT_RISK teratas (maksimal 10)
      prisma.project.findMany({
        where: {
          ...baseProjectWhere,
          statusIndicator: StatusIndicator.AT_RISK,
          status: { not: ProjectStatus.COMPLETED },
        },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          displayName: true,
          status: true,
          statusIndicator: true,
          progressPct: true,
          targetStartDate: true,
          targetEndDate: true,
          updatedAt: true,
          company: { select: { id: true, code: true, name: true } },
          estate: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ targetEndDate: "asc" }, { progressPct: "asc" }],
        take: 10,
      }),

      // 8. Total paket pengadaan
      prisma.workPackage.count({
        where: basePackageWhere,
      }),

      // 9. Paket pengadaan per status
      prisma.workPackage.groupBy({
        by: ["status"],
        where: basePackageWhere,
        _count: { id: true },
      }),

      // 10. Paket outstanding (belum tiba lengkap ATAU belum lunas, pada proyek yang tidak CANCELLED)
      prisma.workPackage.count({
        where: {
          ...basePackageWhere,
          status: { not: PackageStatus.CANCELLED },
          project: {
            ...(basePackageWhere.project || {}),
            status: { not: ProjectStatus.CANCELLED },
          },
          OR: [
            { paymentStatus: { not: PaymentStatus.LUNAS } },
            { status: { notIn: [PackageStatus.DELIVERED, PackageStatus.COMPLETED] } },
          ],
        },
      }),

      // 11. Paket belum lunas (BELUM_LUNAS atau DALAM_PROSES)
      prisma.workPackage.count({
        where: {
          ...basePackageWhere,
          status: { not: PackageStatus.CANCELLED },
          project: {
            ...(basePackageWhere.project || {}),
            status: { not: ProjectStatus.CANCELLED },
          },
          paymentStatus: { not: PaymentStatus.LUNAS },
        },
      }),

      // 11b. Paket belum tiba lengkap (belum DELIVERED / COMPLETED)
      prisma.workPackage.count({
        where: {
          ...basePackageWhere,
          status: {
            notIn: [
              PackageStatus.DELIVERED,
              PackageStatus.COMPLETED,
              PackageStatus.CANCELLED,
            ],
          },
          project: {
            ...(basePackageWhere.project || {}),
            status: { not: ProjectStatus.CANCELLED },
          },
        },
      }),

      // 12. Notifikasi: AFCE ditolak
      prisma.afceDocument.count({
        where: {
          status: AfceStatus.REJECTED,
          project: baseProjectWhere,
        },
      }),

      // 13. Notifikasi: Menunggu approval AR
      prisma.project.count({
        where: {
          ...baseProjectWhere,
          status: ProjectStatus.WAITING_AFCE_AR,
        },
      }),

      // 14. Master Hari Libur tahun berjalan
      prisma.holiday.count({
        where: {
          year: new Date().getFullYear(),
        },
      }),
    ]);

    // Format map proyek per status
    const projectsByStatus: Record<ProjectStatus, number> = {
      DRAFT: 0,
      SURVEY: 0,
      RAB_READY: 0,
      WAITING_AFCE_AR: 0,
      AFCE_AR_APPROVED: 0,
      PROCUREMENT: 0,
      EXECUTION: 0,
      WAITING_BAST: 0,
      COMPLETED: 0,
      ON_HOLD: 0,
      CANCELLED: 0,
    };
    for (const item of projectStatusGroups) {
      projectsByStatus[item.status] = item._count.id;
    }

    // Format map proyek per statusIndicator
    const projectsByIndicator: Record<StatusIndicator, number> = {
      ON_TRACK: 0,
      AT_RISK: 0,
      DELAYED: 0,
      COMPLETED: 0,
    };
    for (const item of indicatorGroups) {
      projectsByIndicator[item.statusIndicator] = item._count.id;
    }

    // Format map paket per status
    const packagesByStatus: Record<PackageStatus, number> = {
      DRAFT: 0,
      PR_SUBMITTED: 0,
      PO_ISSUED: 0,
      IN_DELIVERY: 0,
      PARTIALLY_DELIVERED: 0,
      DELIVERED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const item of packageStatusGroups) {
      packagesByStatus[item.status] = item._count.id;
    }

    const delayedProjectsCount = projectsByIndicator.DELAYED || 0;
    const atRiskProjectsCount = projectsByIndicator.AT_RISK || 0;
    const onTrackProjectsCount = projectsByIndicator.ON_TRACK || 0;

    const stats = {
      totalProjects,
      activeProjectsCount,
      completedProjectsCount,
      projectsByStatus,
      projectsByIndicator,
      topDelayedProjects,
      topAtRiskProjects,
      procurementSummary: {
        totalPackages,
        outstandingPackagesCount,
        unpaidPackagesCount,
        undeliveredPackagesCount,
        packagesByStatus,
      },
      // Kompatibilitas single source of truth untuk Navbar & Dashboard
      rejectedArCount,
      waitingApprovalCount,
      delayedProjectsCount,
      atRiskProjectsCount,
      onTrackProjectsCount,
      holidaysThisYearCount,
      totalPendingNotifications:
        rejectedArCount + waitingApprovalCount + delayedProjectsCount,
    };

    // 2. Simpan ke Upstash Redis dengan TTL 60 detik
    if (redis) {
      try {
        await redis.set(cacheKey, stats, { ex: 60 });
      } catch (cacheSetErr) {
        console.error("[Upstash Redis] Gagal menyimpan cache dashboard:", cacheSetErr);
      }
    }

    return apiSuccess(stats);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil statistik dashboard");
  }
}
