import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/server/auth-guard";
import {
  Prisma,
  ProjectStatus,
  StatusIndicator,
} from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reportQuerySchema = z.object({
  type: z.enum([
    "project-status",
    "procurement-outstanding",
    "budget-realization",
    "approval-matrix",
    "project-progress",
  ]),
  companyId: z.string().optional(),
  companyIds: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  approvalStatus: z.string().optional(),
  statusIndicator: z.nativeEnum(StatusIndicator).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

/**
 * GET /api/reports
 * Endpoint read-only untuk SUPER_ADMIN, WM_HO_SPECIALIST, dan MANAGEMENT_VIEWER
 * Menyediakan data laporan terpadu:
 * 1. project-status: KPI ringkas + daftar proyek lengkap
 * 2. procurement-outstanding: paket pekerjaan belum LUNAS atau belum DELIVERED
 * 3. budget-realization: totalBudgetAmount vs Σ contractOrPoAmount vs Σ paidAmount per proyek
 * 4. approval-matrix: matriks persetujuan dokumen AR per level approver per proyek
 * 5. project-progress: rekapitulasi siklus hidup (Survei s/d BAST) & rincian paket kerja
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = reportQuerySchema.parse(searchParams);

    // Multi-select company IDs parsing
    const selectedCompanyIds = query.companyIds
      ? query.companyIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : query.companyId && query.companyId !== "ALL"
      ? [query.companyId]
      : [];

    // Filter proyek aktif (mengabaikan soft delete)
    const projectWhere: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(selectedCompanyIds.length > 0
        ? { companyId: { in: selectedCompanyIds } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.statusIndicator
        ? { statusIndicator: query.statusIndicator }
        : {}),
    };

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      projectWhere.OR = [
        { projectCode: { contains: s, mode: "insensitive" } },
        { projectName: { contains: s, mode: "insensitive" } },
        { displayName: { contains: s, mode: "insensitive" } },
      ];
    }

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

    if (query.type === "approval-matrix") {
      // 4. Laporan Matriks Persetujuan AR per Proyek
      const projects = await prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          displayName: true,
          status: true,
          totalBudgetAmount: true,
          company: {
            select: {
              id: true,
              code: true,
              name: true,
              region: { select: { id: true, code: true, name: true } },
            },
          },
          afceDocument: {
            select: {
              id: true,
              noAr: true,
              approvedAmount: true,
              status: true,
              currentAttempt: true,
              emailSubmittedDate: true,
              mcaApprovalDate: true,
              approvals: {
                orderBy: [{ attemptNo: "asc" }, { approvalLevel: "asc" }],
                select: {
                  id: true,
                  attemptNo: true,
                  approvalLevel: true,
                  role: true,
                  personName: true,
                  status: true,
                  submittedAt: true,
                  approvedAt: true,
                  rejectedAt: true,
                  notes: true,
                },
              },
            },
          },
          supplementaryArs: {
            select: {
              id: true,
              noAr: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: [{ company: { name: "asc" } }, { projectCode: "asc" }],
      });

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const items = projects.map((p) => {
        const afce = p.afceDocument;
        const currentAttempt = afce?.currentAttempt || 1;
        const allApprovals = afce?.approvals || [];
        const currentSnapshots = allApprovals.filter(
          (a) => a.attemptNo === currentAttempt
        );

        // Cari snapshot yang sedang WAITING pertama kali (abaikan level TIDAK_PERLU)
        const waitingSnap = currentSnapshots.find(
          (s) =>
            s.status === "WAITING" &&
            s.notes !== "TIDAK_PERLU" &&
            !s.notes?.startsWith("[TIDAK_PERLU]")
        );
        let activeWaitingDays = 0;
        if (waitingSnap && waitingSnap.submittedAt) {
          const subDate = new Date(waitingSnap.submittedAt);
          subDate.setHours(0, 0, 0, 0);
          activeWaitingDays = Math.max(
            0,
            Math.ceil((now.getTime() - subDate.getTime()) / (1000 * 60 * 60 * 24))
          );
        }

        const hasRejection = allApprovals.some((a) => a.status === "REJECTED");

        const snapshotsData = currentSnapshots.map((s) => {
          const isNotRequired =
            s.notes === "TIDAK_PERLU" || s.notes?.startsWith("[TIDAK_PERLU]");

          let waitDays = 0;
          if (s.status === "WAITING" && s.submittedAt && !isNotRequired) {
            const sub = new Date(s.submittedAt);
            sub.setHours(0, 0, 0, 0);
            waitDays = Math.max(
              0,
              Math.ceil((now.getTime() - sub.getTime()) / (1000 * 60 * 60 * 24))
            );
          }
          return {
            level: s.approvalLevel,
            role: s.role,
            personName: s.personName,
            status: isNotRequired ? "TIDAK_PERLU" : s.status,
            submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
            approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
            rejectedAt: s.rejectedAt ? s.rejectedAt.toISOString() : null,
            notes: s.notes,
            waitingDays: waitDays,
          };
        });

        return {
          id: p.id,
          projectCode: p.projectCode,
          projectName: p.displayName || p.projectName,
          companyId: p.company.id,
          companyName: p.company.name,
          companyCode: p.company.code,
          regionName: p.company.region?.name || "Wilayah Lainnya / Tanpa Region",
          status: p.status,
          noAr: afce?.noAr || "-",
          approvedAmount: Number(afce?.approvedAmount || p.totalBudgetAmount || 0),
          currentAttempt,
          afceStatus: afce?.status || "PENDING",
          emailSubmittedDate: afce?.emailSubmittedDate
            ? afce.emailSubmittedDate.toISOString()
            : null,
          mcaApprovalDate: afce?.mcaApprovalDate
            ? afce.mcaApprovalDate.toISOString()
            : null,
          snapshots: snapshotsData,
          activeWaitingRole: waitingSnap ? waitingSnap.role : null,
          activeWaitingDays,
          hasRejection,
          supplementaryCount: p.supplementaryArs.length,
        };
      });

      // Filter by approval status if specified
      let filteredItems = items;
      if (query.approvalStatus && query.approvalStatus !== "ALL") {
        if (query.approvalStatus === "WAITING") {
          filteredItems = items.filter((it) => it.activeWaitingRole !== null);
        } else if (query.approvalStatus === "APPROVED") {
          filteredItems = items.filter((it) => it.afceStatus === "APPROVED");
        } else if (query.approvalStatus === "REJECTED") {
          filteredItems = items.filter((it) => it.hasRejection || it.afceStatus === "REJECTED");
        }
      }

      // Hitung KPI
      const totalProjects = filteredItems.length;
      const waitingCount = filteredItems.filter((i) => i.activeWaitingRole !== null).length;
      const approvedCount = filteredItems.filter((i) => i.afceStatus === "APPROVED").length;
      const rejectedCount = filteredItems.filter((i) => i.hasRejection).length;
      const waitingItemsWithDays = filteredItems.filter((i) => i.activeWaitingDays > 0);
      const avgReviewDays =
        waitingItemsWithDays.length > 0
          ? Number(
              (
                waitingItemsWithDays.reduce((acc, i) => acc + i.activeWaitingDays, 0) /
                waitingItemsWithDays.length
              ).toFixed(1)
            )
          : 0;

      return apiSuccess({
        kpi: {
          totalProjects,
          waitingCount,
          approvedCount,
          rejectedCount,
          avgReviewDays,
        },
        items: filteredItems,
      });
    }

    if (query.type === "project-progress") {
      // 5. Laporan Siklus Hidup & Rincian Paket Kerja
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
          targetQuantity: true,
          uom: true,
          targetStartDate: true,
          targetEndDate: true,
          folderCategory: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          company: {
            select: {
              id: true,
              code: true,
              name: true,
              region: { select: { id: true, code: true, name: true } },
            },
          },
          afceDocument: {
            select: {
              id: true,
              noAr: true,
              rabReady: true,
              drawingReady: true,
              emailSubmitted: true,
              emailSubmittedDate: true,
              status: true,
            },
          },
          workPackages: {
            where: { deletedAt: null },
            select: {
              id: true,
              packageName: true,
              category: true,
              vendorName: true,
              vendor: { select: { name: true } },
              weightPct: true,
              progressPct: true,
              targetQuantity: true,
              volumeAchieved: true,
              uom: true,
              status: true,
              paymentStatus: true,
              hasPhysicalWork: true,
              procurementPlanStartDate: true,
              procurementPlanEndDate: true,
              procurementRevisedEndDate: true,
              planStartDate: true,
              planEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              revisedEndDate: true,
              noPoSpk: true,
              poSpkDate: true,
              noPrUspk: true,
              prUspkDate: true,
              estDeliveryDate: true,
              actualDeliveryDate: true,
            },
            orderBy: { packageName: "asc" },
          },
          bastDocument: {
            select: {
              id: true,
              bastNumber: true,
              bastDate: true,
              verifiedAt: true,
            },
          },
        },
        orderBy: [
          { folderCategory: { name: "asc" } },
          { company: { name: "asc" } },
          { projectCode: "asc" },
        ],
      });

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const items = projects.map((p) => {
        const afce = p.afceDocument;
        const bast = p.bastDocument;
        const packages = p.workPackages;

        // Hitung Milestone Stages
        let surveyStatus: "DONE" | "IN_PROGRESS" | "PENDING" = "PENDING";
        if (p.status !== "DRAFT" && p.status !== "SURVEY") {
          surveyStatus = "DONE";
        } else if (p.status === "SURVEY" || afce?.drawingReady) {
          surveyStatus = "IN_PROGRESS";
        }

        let rabStatus: "READY" | "DRAFT" | "PENDING" = "PENDING";
        if (
          afce?.rabReady ||
          [
            "WAITING_AFCE_AR",
            "AFCE_AR_APPROVED",
            "PROCUREMENT",
            "EXECUTION",
            "WAITING_BAST",
            "COMPLETED",
          ].includes(p.status)
        ) {
          rabStatus = "READY";
        } else if (p.status === "SURVEY" || p.status === "RAB_READY") {
          rabStatus = "DRAFT";
        }

        let approvalStatus: "APPROVED" | "WAITING" | "REJECTED" | "PENDING" = "PENDING";
        if (
          afce?.status === "APPROVED" ||
          [
            "AFCE_AR_APPROVED",
            "PROCUREMENT",
            "EXECUTION",
            "WAITING_BAST",
            "COMPLETED",
          ].includes(p.status)
        ) {
          approvalStatus = "APPROVED";
        } else if (afce?.status === "REJECTED") {
          approvalStatus = "REJECTED";
        } else if (p.status === "WAITING_AFCE_AR" || afce?.emailSubmitted) {
          approvalStatus = "WAITING";
        }

        const totalPackages = packages.length;
        const deliveredPackages = packages.filter((pkg) =>
          ["DELIVERED", "COMPLETED"].includes(pkg.status)
        ).length;
        let procStatus: "DELIVERED" | "PO_ISSUED" | "PR_SUBMITTED" | "PENDING" = "PENDING";
        if (totalPackages > 0 && deliveredPackages === totalPackages) {
          procStatus = "DELIVERED";
        } else if (
          packages.some((pkg) =>
            ["PO_ISSUED", "IN_DELIVERY", "PARTIALLY_DELIVERED"].includes(pkg.status)
          )
        ) {
          procStatus = "PO_ISSUED";
        } else if (packages.some((pkg) => pkg.status === "PR_SUBMITTED")) {
          procStatus = "PR_SUBMITTED";
        } else if (
          ["PROCUREMENT", "EXECUTION", "WAITING_BAST", "COMPLETED"].includes(p.status)
        ) {
          procStatus = "PO_ISSUED";
        }

        let execStatus: "IN_PROGRESS" | "COMPLETED" | "PENDING" = "PENDING";
        if (p.progressPct >= 100 || p.status === "COMPLETED") {
          execStatus = "COMPLETED";
        } else if (
          p.progressPct > 0 ||
          p.status === "EXECUTION" ||
          p.status === "WAITING_BAST"
        ) {
          execStatus = "IN_PROGRESS";
        }

        let bastStatus: "VERIFIED" | "WAITING_VERIFICATION" | "NOT_SUBMITTED" =
          "NOT_SUBMITTED";
        if (bast?.verifiedAt || p.status === "COMPLETED") {
          bastStatus = "VERIFIED";
        } else if (bast || p.status === "WAITING_BAST") {
          bastStatus = "WAITING_VERIFICATION";
        }

        const wpItems = packages.map((pkg) => {
          let isDelayed = false;
          if (pkg.estDeliveryDate) {
            const est = new Date(pkg.estDeliveryDate);
            est.setHours(0, 0, 0, 0);
            if (pkg.actualDeliveryDate) {
              const act = new Date(pkg.actualDeliveryDate);
              act.setHours(0, 0, 0, 0);
              isDelayed = act.getTime() > est.getTime();
            } else if (
              now.getTime() > est.getTime() &&
              !["DELIVERED", "COMPLETED"].includes(pkg.status)
            ) {
              isDelayed = true;
            }
          }

          return {
            id: pkg.id,
            packageName: pkg.packageName,
            category: pkg.category,
            vendorName: pkg.vendorName || pkg.vendor?.name || "-",
            weightPct: pkg.weightPct,
            progressPct: pkg.progressPct,
            targetQuantity: pkg.targetQuantity,
            volumeAchieved: pkg.volumeAchieved,
            uom: pkg.uom,
            status: pkg.status,
            paymentStatus: pkg.paymentStatus,
            hasPhysicalWork: pkg.hasPhysicalWork !== false,
            procurementPlanStartDate: pkg.procurementPlanStartDate
              ? pkg.procurementPlanStartDate.toISOString()
              : null,
            procurementPlanEndDate: pkg.procurementPlanEndDate
              ? pkg.procurementPlanEndDate.toISOString()
              : null,
            procurementRevisedEndDate: pkg.procurementRevisedEndDate
              ? pkg.procurementRevisedEndDate.toISOString()
              : null,
            planStartDate: pkg.planStartDate ? pkg.planStartDate.toISOString() : null,
            planEndDate: pkg.planEndDate ? pkg.planEndDate.toISOString() : null,
            revisedEndDate: pkg.revisedEndDate ? pkg.revisedEndDate.toISOString() : null,
            actualStartDate: pkg.actualStartDate ? pkg.actualStartDate.toISOString() : null,
            actualEndDate: pkg.actualEndDate ? pkg.actualEndDate.toISOString() : null,
            noPoSpk: pkg.noPoSpk || null,
            poSpkDate: pkg.poSpkDate ? pkg.poSpkDate.toISOString() : null,
            noPrUspk: pkg.noPrUspk || null,
            prUspkDate: pkg.prUspkDate ? pkg.prUspkDate.toISOString() : null,
            estDeliveryDate: pkg.estDeliveryDate ? pkg.estDeliveryDate.toISOString() : null,
            actualDeliveryDate: pkg.actualDeliveryDate
              ? pkg.actualDeliveryDate.toISOString()
              : null,
            isDelayed,
          };
        });

        return {
          id: p.id,
          projectCode: p.projectCode,
          projectName: p.displayName || p.projectName,
          folderCategoryId: p.folderCategory?.id,
          folderCategoryName: p.folderCategory?.name || "Tanpa Kategori",
          folderCategoryCode: p.folderCategory?.code || "-",
          companyId: p.company.id,
          companyName: p.company.name,
          companyCode: p.company.code,
          regionName: p.company.region?.name || "Wilayah Lainnya / Tanpa Region",
          status: p.status,
          statusIndicator: p.statusIndicator,
          progressPct: p.progressPct || 0,
          targetQuantity: p.targetQuantity,
          uom: p.uom,
          targetStartDate: p.targetStartDate ? p.targetStartDate.toISOString() : null,
          targetEndDate: p.targetEndDate ? p.targetEndDate.toISOString() : null,
          milestones: {
            survey: { status: surveyStatus, date: null },
            rab: { status: rabStatus },
            approval: { status: approvalStatus, noAr: afce?.noAr || undefined },
            procurement: {
              status: procStatus,
              totalPackages,
              deliveredPackages,
            },
            execution: {
              status: execStatus,
              progressPct: p.progressPct || 0,
            },
            bast: {
              status: bastStatus,
              bastNumber: bast?.bastNumber,
              verifiedAt: bast?.verifiedAt ? bast.verifiedAt.toISOString() : null,
            },
          },
          workPackages: wpItems,
        };
      });

      const totalProjects = items.length;
      const activeProjects = items.filter(
        (i) => !["COMPLETED", "CANCELLED"].includes(i.status)
      ).length;
      const sumProgress = items.reduce((acc, i) => acc + (i.progressPct || 0), 0);
      const avgProgress =
        totalProjects > 0 ? Number((sumProgress / totalProjects).toFixed(1)) : 0;
      const completedBastCount = items.filter(
        (i) => i.milestones.bast.status === "VERIFIED"
      ).length;
      const delayedCount = items.filter(
        (i) => i.statusIndicator === "DELAYED"
      ).length;

      return apiSuccess({
        kpi: {
          totalProjects,
          activeProjects,
          avgProgress,
          completedBastCount,
          delayedCount,
        },
        items,
      });
    }

    return apiError("Jenis laporan tidak dikenali", 400);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data laporan");
  }
}
