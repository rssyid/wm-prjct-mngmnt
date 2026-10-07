import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { afceUpsertSchema } from "@/lib/validations/afce.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  onAfceApprovedTrigger,
  onAfceRejectedTrigger,
  onEmailSubmittedTrigger,
  onRabReadyTrigger,
} from "@/server/services/project-transition.service";
import { AfceStatus, ApprovalDocType, ProjectStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/projects/[id]/afce
 * Mengambil dokumen AFCE beserta seluruh riwayat approval snapshot.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();

    const project = await prisma.project.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true },
    });

    if (!project) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    const afce = await prisma.afceDocument.findUnique({
      where: { projectId: params.id },
      include: {
        approvals: {
          orderBy: [{ attemptNo: "asc" }, { approvalLevel: "asc" }],
        },
      },
    });

    return apiSuccess(afce);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data dokumen AFCE");
  }
}

/**
 * PUT /api/projects/[id]/afce
 * Upsert dokumen AFCE & snapshot approval pada attempt aktif (currentAttempt).
 * - rabReady memicu transisi otomatis SURVEY -> RAB_READY (T2)
 * - emailSubmitted memicu transisi otomatis RAB_READY -> WAITING_AFCE_AR (T3)
 * - Approval harus berurutan: Level N Approved mewajibkan level N-1 Approved (B2)
 * - Semua level Approved -> AfceStatus APPROVED + transisi AFCE_AR_APPROVED (T4)
 * - Ada level REJECTED -> AfceStatus REJECTED + proyek kembali RAB_READY (B4)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

    const project = await prisma.project.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!project) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    // Guard Imutabilitas B9
    if (project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    const body = await request.json();
    const validated = afceUpsertSchema.parse(body);

    // Validasi Aturan B2: Approval harus berurutan ketat
    // Urutkan snapshot berdasarkan approvalLevel ASC
    const sortedApprovals = [...validated.approvals].sort(
      (a, b) => a.approvalLevel - b.approvalLevel
    );

    for (let i = 0; i < sortedApprovals.length; i++) {
      const current = sortedApprovals[i];
      if (current.status === "APPROVED") {
        for (let j = 0; j < i; j++) {
          if (sortedApprovals[j].status !== "APPROVED") {
            throw new AppError("Approval harus berurutan", 400);
          }
        }
      }
    }

    // Tentukan AfceStatus berdasarkan status approvals pada attempt aktif
    let targetAfceStatus: AfceStatus = AfceStatus.PENDING;
    if (sortedApprovals.length > 0) {
      const hasRejected = sortedApprovals.some((a) => a.status === "REJECTED");
      const allApproved = sortedApprovals.every((a) => a.status === "APPROVED");

      if (hasRejected) {
        targetAfceStatus = AfceStatus.REJECTED;
      } else if (allApproved) {
        targetAfceStatus = AfceStatus.APPROVED;
      } else {
        targetAfceStatus = AfceStatus.PENDING;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cek atau buat AfceDocument
      const existingAfce = await tx.afceDocument.findUnique({
        where: { projectId: params.id },
      });

      const currentAttempt = existingAfce?.currentAttempt || 1;

      const afce = await tx.afceDocument.upsert({
        where: { projectId: params.id },
        create: {
          projectId: params.id,
          noAr: validated.noAr || null,
          arType: validated.arType || null,
          budgetType: validated.budgetType || null,
          approvedAmount: validated.approvedAmount,
          drawingReady: validated.drawingReady,
          rabReady: validated.rabReady,
          mapReady: validated.mapReady,
          emailSubmitted: validated.emailSubmitted,
          emailSubmittedDate: validated.emailSubmittedDate
            ? new Date(validated.emailSubmittedDate)
            : null,
          mcaApprovalDate: validated.mcaApprovalDate
            ? new Date(validated.mcaApprovalDate)
            : null,
          currentAttempt: 1,
          status: targetAfceStatus,
        },
        update: {
          noAr: validated.noAr || null,
          arType: validated.arType || null,
          budgetType: validated.budgetType || null,
          approvedAmount: validated.approvedAmount,
          drawingReady: validated.drawingReady,
          rabReady: validated.rabReady,
          mapReady: validated.mapReady,
          emailSubmitted: validated.emailSubmitted,
          emailSubmittedDate: validated.emailSubmittedDate
            ? new Date(validated.emailSubmittedDate)
            : null,
          mcaApprovalDate: validated.mcaApprovalDate
            ? new Date(validated.mcaApprovalDate)
            : null,
          status: targetAfceStatus,
        },
      });

      // 2. Simpan snapshot approvals HANYA untuk attempt aktif saat ini
      // Aturan B4: attemptNo < currentAttempt tidak pernah disentuh
      await tx.approvalSnapshot.deleteMany({
        where: {
          afceDocumentId: afce.id,
          attemptNo: currentAttempt,
        },
      });

      if (sortedApprovals.length > 0) {
        await tx.approvalSnapshot.createMany({
          data: sortedApprovals.map((item) => ({
            afceDocumentId: afce.id,
            attemptNo: currentAttempt,
            documentType: ApprovalDocType.AR,
            approvalLevel: item.approvalLevel,
            role: item.role,
            personName: item.personName || null,
            status: item.status,
            submittedAt: item.submittedAt
              ? new Date(item.submittedAt)
              : new Date(),
            approvedAt:
              item.status === "APPROVED"
                ? item.approvedAt
                  ? new Date(item.approvedAt)
                  : new Date()
                : null,
            rejectedAt:
              item.status === "REJECTED"
                ? item.rejectedAt
                  ? new Date(item.rejectedAt)
                  : new Date()
                : null,
            notes: item.notes || null,
            evidenceDocUrl: item.evidenceDocUrl || null,
          })),
        });
      }

      // 3. Pemicu transisi status otomatis via transition service
      // T2: SURVEY -> RAB_READY bila rabReady = true
      if (validated.rabReady) {
        await onRabReadyTrigger(params.id, session.user.id, tx);
      }

      // T3: RAB_READY -> WAITING_AFCE_AR bila emailSubmitted = true
      if (validated.emailSubmitted) {
        await onEmailSubmittedTrigger(params.id, session.user.id, tx);
      }

      // T4: Semua Approved -> WAITING_AFCE_AR -> AFCE_AR_APPROVED
      if (targetAfceStatus === AfceStatus.APPROVED) {
        await onAfceApprovedTrigger(params.id, session.user.id, tx);
      }

      // B4: Ada yang REJECTED -> Proyek kembali ke RAB_READY
      if (targetAfceStatus === AfceStatus.REJECTED) {
        await onAfceRejectedTrigger(params.id, session.user.id, tx);
      }

      // Ambil data akhir lengkap
      return tx.afceDocument.findUnique({
        where: { id: afce.id },
        include: {
          approvals: {
            orderBy: [{ attemptNo: "asc" }, { approvalLevel: "asc" }],
          },
        },
      });
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menyimpan dokumen AFCE");
  }
}
