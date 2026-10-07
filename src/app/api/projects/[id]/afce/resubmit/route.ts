import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth-guard";
import { onEmailSubmittedTrigger } from "@/server/services/project-transition.service";
import { AfceStatus, ApprovalDocType, ProjectStatus, Role } from "@prisma/client";
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

    const project = await prisma.project.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!project) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    if (project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    const afce = await prisma.afceDocument.findUnique({
      where: { projectId: params.id },
    });

    if (!afce) {
      throw new AppError("Dokumen AFCE belum dibuat", 404);
    }

    if (afce.status !== AfceStatus.REJECTED) {
      throw new AppError(
        "Pengajuan ulang hanya dapat dilakukan saat status AFCE adalah REJECTED",
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentAttempt = afce.currentAttempt;
      const nextAttempt = currentAttempt + 1;

      // Ambil template approver dari attempt aktif saat ini
      const prevSnapshots = await tx.approvalSnapshot.findMany({
        where: {
          afceDocumentId: afce.id,
          attemptNo: currentAttempt,
        },
        orderBy: { approvalLevel: "asc" },
      });

      // Buat snapshot baru untuk attemptNo: nextAttempt (B4: attempt lama utuh)
      if (prevSnapshots.length > 0) {
        await tx.approvalSnapshot.createMany({
          data: prevSnapshots.map((item) => ({
            afceDocumentId: afce.id,
            attemptNo: nextAttempt,
            documentType: ApprovalDocType.AR,
            approvalLevel: item.approvalLevel,
            role: item.role,
            personName: item.personName,
            status: "WAITING",
            submittedAt: new Date(),
            approvedAt: null,
            rejectedAt: null,
            notes: null,
            evidenceDocUrl: null,
          })),
        });
      }

      // Perbarui AfceDocument
      const updatedAfce = await tx.afceDocument.update({
        where: { id: afce.id },
        data: {
          currentAttempt: nextAttempt,
          status: AfceStatus.PENDING,
          emailSubmitted: true,
          emailSubmittedDate: new Date(),
        },
        include: {
          approvals: {
            orderBy: [{ attemptNo: "asc" }, { approvalLevel: "asc" }],
          },
        },
      });

      // Pemicu transisi status: proyek kembali ke WAITING_AFCE_AR
      await onEmailSubmittedTrigger(params.id, session.user.id, tx);

      return updatedAfce;
    });

    return apiSuccess(result, { message: "Pengajuan ulang AFCE berhasil dibuat" });
  } catch (error) {
    return handleApiError(error, "Gagal mengajukan ulang dokumen AFCE");
  }
}
