import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth-guard";
import { Prisma, ProjectStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reportQuerySchema = z.object({
  type: z.enum(["project-status", "procurement-outstanding", "budget-realization"]),
  companyId: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /api/reports
 * Endpoint read-only untuk SUPER_ADMIN, WM_HO_SPECIALIST, dan MANAGEMENT_VIEWER
 * Menyediakan data laporan terpadu:
 * 1. project-status: KPI ringkas + daftar proyek lengkap
 * 2. procurement-outstanding: paket pekerjaan belum LUNAS atau belum DELIVERED
 * 3. budget-realization: totalBudgetAmount vs Σ contractOrPoAmount vs Σ paidAmount per proyek
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = reportQuerySchema.parse(searchParams);

    // Filter proyek aktif (mengabaikan soft delete)
    const projectWhere: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    // Filter rentang tanggal berdasarkan targetStartDate atau targetEndDate jika ada
    if (query.startDate || query.endDate) {
      projectWhere.AND = [];
      if (query.startDate) {
        const start = new Date(query.startDate);
        projectWhere.AND.push({
          OR: [
            { targetStartDate: { gte: start } },
            { targetEndDate: { gte: start } },
          ],
        });
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        // Set ke akhir hari jika date-only string
        end.setHours(23, 59, 59, 999);
        projectWhere.AND.push({
          OR: [
            { targetStartDate: { lte: end } },
            { targetEndDate: { lte: end } },
          ],
        });
      }
    }

    if (query.type === "project-status") {
      // 1. Laporan Status Proyek
      const projects = await prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          displayName: true,
          status: true,
          statusIndicator: true,
          progressPct: true,
          totalBudgetAmount: true,
          budgetType: true,
          targetStartDate: true,
          targetEndDate: true,
          company: { select: { id: true, code: true, name: true } },
          estate: { select: { id: true, code: true, name: true } },
          folderCategory: { select: { id: true, name: true } },
        },
        orderBy: [{ company: { name: "asc" } }, { projectCode: "asc" }],
      });

      // Hitung KPI ringkas
      const totalProjects = projects.length;
      let sumProgress = 0;
      const indicatorCounts = {
        ON_TRACK: 0,
        AT_RISK: 0,
        DELAYED: 0,
        COMPLETED: 0,
      };

      for (const p of projects) {
        sumProgress += p.progressPct || 0;
        if (p.statusIndicator in indicatorCounts) {
          indicatorCounts[p.statusIndicator as keyof typeof indicatorCounts]++;
        }
      }

      const avgProgress = totalProjects > 0 ? Number((sumProgress / totalProjects).toFixed(2)) : 0;

      return apiSuccess({
        kpi: {
          totalProjects,
          avgProgress,
          indicators: indicatorCounts,
        },
        projects,
      });
    }

    if (query.type === "procurement-outstanding") {
      // 2. Laporan Pengadaan Outstanding
      // Paket dengan paymentStatus != 'LUNAS' ATAU status belum DELIVERED/COMPLETED
      const packages = await prisma.workPackage.findMany({
        where: {
          deletedAt: null,
          project: projectWhere,
          OR: [
            { paymentStatus: { not: "LUNAS" } },
            { status: { notIn: ["DELIVERED", "COMPLETED"] } },
          ],
        },
        select: {
          id: true,
          packageName: true,
          category: true,
          status: true,
          paymentStatus: true,
          vendorName: true,
          vendor: { select: { id: true, name: true } },
          noPrUspk: true,
          prUspkDate: true,
          noPoSpk: true,
          poSpkDate: true,
          contractOrPoAmount: true,
          paidAmount: true,
          estDeliveryDate: true,
          actualDeliveryDate: true,
          project: {
            select: {
              id: true,
              projectCode: true,
              projectName: true,
              displayName: true,
              company: { select: { id: true, code: true, name: true } },
            },
          },
          deliveries: {
            select: {
              id: true,
              deliveryDate: true,
              deliveryOrderNo: true,
            },
            orderBy: { deliveryDate: "desc" },
            take: 1,
          },
        },
        orderBy: [{ project: { projectCode: "asc" } }, { packageName: "asc" }],
      });

      // Hitung keterlambatan hari & sisa pembayaran
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const items = packages.map((pkg) => {
        const poAmount = Number(pkg.contractOrPoAmount || 0);
        const paid = Number(pkg.paidAmount || 0);
        const remaining = Math.max(0, poAmount - paid);

        let delayDays = 0;
        if (pkg.estDeliveryDate) {
          const est = new Date(pkg.estDeliveryDate);
          est.setHours(0, 0, 0, 0);

          if (pkg.actualDeliveryDate) {
            const actual = new Date(pkg.actualDeliveryDate);
            actual.setHours(0, 0, 0, 0);
            const diffMs = actual.getTime() - est.getTime();
            delayDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          } else if (now.getTime() > est.getTime() && pkg.status !== "DELIVERED" && pkg.status !== "COMPLETED") {
            const diffMs = now.getTime() - est.getTime();
            delayDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          }
        }

        return {
          id: pkg.id,
          projectCode: pkg.project.projectCode,
          projectName: pkg.project.displayName || pkg.project.projectName,
          companyName: pkg.project.company.name,
          packageName: pkg.packageName,
          category: pkg.category,
          vendor: pkg.vendorName || pkg.vendor?.name || "-",
          noPoSpk: pkg.noPoSpk || "-",
          poSpkDate: pkg.poSpkDate,
          estDeliveryDate: pkg.estDeliveryDate,
          actualDeliveryDate: pkg.actualDeliveryDate,
          delayDays,
          packageStatus: pkg.status,
          paymentStatus: pkg.paymentStatus,
          poAmount,
          paidAmount: paid,
          remainingAmount: remaining,
        };
      });

      return apiSuccess({ packages: items });
    }

    if (query.type === "budget-realization") {
      // 3. Laporan Realisasi Anggaran
      // totalBudgetAmount vs Σ contractOrPoAmount vs Σ paidAmount per proyek
      const projects = await prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          displayName: true,
          budgetType: true,
          totalBudgetAmount: true,
          status: true,
          company: { select: { id: true, code: true, name: true } },
          estate: { select: { id: true, code: true, name: true } },
          workPackages: {
            where: { deletedAt: null },
            select: {
              id: true,
              contractOrPoAmount: true,
              paidAmount: true,
            },
          },
        },
        orderBy: [{ company: { name: "asc" } }, { projectCode: "asc" }],
      });

      const realizationList = projects.map((p) => {
        const budgetAmount = Number(p.totalBudgetAmount || 0);

        let totalPoAmount = 0;
        let totalPaidAmount = 0;

        for (const wp of p.workPackages) {
          totalPoAmount += Number(wp.contractOrPoAmount || 0);
          totalPaidAmount += Number(wp.paidAmount || 0);
        }

        const remainingBudget = budgetAmount - totalPoAmount;
        const absorptionPct =
          budgetAmount > 0 ? Number(((totalPaidAmount / budgetAmount) * 100).toFixed(2)) : 0;
        const commitmentPct =
          budgetAmount > 0 ? Number(((totalPoAmount / budgetAmount) * 100).toFixed(2)) : 0;

        return {
          id: p.id,
          projectCode: p.projectCode,
          projectName: p.displayName || p.projectName,
          companyName: p.company.name,
          estateName: p.estate.name,
          budgetType: p.budgetType,
          status: p.status,
          totalBudgetAmount: budgetAmount,
          totalPoAmount,
          totalPaidAmount,
          remainingBudget,
          absorptionPct,
          commitmentPct,
        };
      });

      return apiSuccess({ realizations: realizationList });
    }

    return apiError("Jenis laporan tidak dikenali", 400);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data laporan");
  }
}
