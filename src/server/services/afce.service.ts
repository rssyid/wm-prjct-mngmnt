import { AppError } from "@/lib/api-error";
import { normalizeApprovalRoleCode } from "@/lib/constants/status";
import { prisma } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/redis";
import {
  onAfceApprovedTrigger,
  onAfceRejectedTrigger,
  onEmailSubmittedTrigger,
  onRabReadyTrigger,
} from "@/server/services/project-transition.service";
import { AfceStatus, ApprovalDocType, ProjectStatus } from "@prisma/client";

export interface ApprovalSnapshotInput {
  approvalLevel: number;
  role: string;
  personName?: string | null;
  status: "WAITING" | "APPROVED" | "REJECTED";
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  notes?: string | null;
  evidenceDocUrl?: string | null;
}

export interface AfceUpsertInput {
  noAr?: string | null;
  arType?: string | null;
  budgetType?: string | null;
  approvedAmount: number;
  drawingReady: boolean;
  rabReady: boolean;
  mapReady: boolean;
  emailSubmitted: boolean;
  emailSubmittedDate?: string | null;
  mcaApprovalDate?: string | null;
  approvals: ApprovalSnapshotInput[];
}

export async function getAfceDocument(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
  }

  return prisma.afceDocument.findUnique({
    where: { projectId },
    include: {
      approvals: {
        orderBy: [{ attemptNo: "asc" }, { approvalLevel: "asc" }],
      },
    },
  });
}

export async function upsertAfceDocument(
  projectId: string,
  input: AfceUpsertInput,
  actorId: string
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
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

  // Validasi Aturan B2: Approval harus berurutan ketat (melewati level TIDAK_PERLU)
  const sortedApprovals = [...input.approvals].sort(
    (a, b) => a.approvalLevel - b.approvalLevel
  );

  for (let i = 0; i < sortedApprovals.length; i++) {
    const current = sortedApprovals[i];
    const isCurrentNotRequired =
      current.notes === "TIDAK_PERLU" ||
      current.notes?.startsWith("[TIDAK_PERLU]");

    if (isCurrentNotRequired) {
      continue;
    }

    if (current.status === "APPROVED") {
      for (let j = 0; j < i; j++) {
        const prev = sortedApprovals[j];
        const isPrevNotRequired =
          prev.notes === "TIDAK_PERLU" ||
          prev.notes?.startsWith("[TIDAK_PERLU]");

        if (!isPrevNotRequired && prev.status !== "APPROVED") {
          throw new AppError("Approval harus berurutan", 400);
        }
      }
    }
  }

  // Tentukan AfceStatus berdasarkan status approvals pada attempt aktif
  let targetAfceStatus: AfceStatus = AfceStatus.PENDING;
  if (sortedApprovals.length > 0) {
    const hasRejected = sortedApprovals.some((a) => a.status === "REJECTED");
    const requiredApprovals = sortedApprovals.filter(
      (a) =>
        a.notes !== "TIDAK_PERLU" &&
        !a.notes?.startsWith("[TIDAK_PERLU]")
    );
    const allApproved =
      requiredApprovals.length > 0 &&
      requiredApprovals.every((a) => a.status === "APPROVED");

    if (hasRejected) {
      targetAfceStatus = AfceStatus.REJECTED;
    } else if (allApproved) {
      targetAfceStatus = AfceStatus.APPROVED;
    } else {
      targetAfceStatus = AfceStatus.PENDING;
    }
  }

  // Otomatis sinkronisasi mcaApprovalDate dari baris approval MCA jika status APPROVED
  const mcaApproval = sortedApprovals.find(
    (a) => normalizeApprovalRoleCode(a.role) === "MCA" && a.status === "APPROVED"
  );
  const resolvedMcaDate = mcaApproval?.approvedAt
    ? new Date(mcaApproval.approvedAt)
    : null;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Cek atau buat AfceDocument
    const existingAfce = await tx.afceDocument.findUnique({
      where: { projectId },
    });

    const currentAttempt = existingAfce?.currentAttempt || 1;

    const afce = await tx.afceDocument.upsert({
      where: { projectId },
      create: {
        projectId,
        noAr: input.noAr || null,
        arType: input.arType || null,
        budgetType: input.budgetType || null,
        approvedAmount: input.approvedAmount,
        drawingReady: input.drawingReady,
        rabReady: input.rabReady,
        mapReady: input.mapReady,
        emailSubmitted: input.emailSubmitted,
        emailSubmittedDate: input.emailSubmittedDate
          ? new Date(input.emailSubmittedDate)
          : null,
        mcaApprovalDate: resolvedMcaDate,
        currentAttempt: 1,
        status: targetAfceStatus,
      },
      update: {
        noAr: input.noAr || null,
        arType: input.arType || null,
        budgetType: input.budgetType || null,
        approvedAmount: input.approvedAmount,
        drawingReady: input.drawingReady,
        rabReady: input.rabReady,
        mapReady: input.mapReady,
        emailSubmitted: input.emailSubmitted,
        emailSubmittedDate: input.emailSubmittedDate
          ? new Date(input.emailSubmittedDate)
          : null,
        mcaApprovalDate: resolvedMcaDate,
        status: targetAfceStatus,
      },
    });

    // 2. Simpan snapshot approvals HANYA untuk attempt aktif saat ini (B4)
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
    if (input.rabReady) {
      await onRabReadyTrigger(projectId, actorId, tx);
    }

    if (input.emailSubmitted) {
      await onEmailSubmittedTrigger(projectId, actorId, tx);
    }

    if (targetAfceStatus === AfceStatus.APPROVED) {
      await onAfceApprovedTrigger(projectId, actorId, tx);
    }

    if (targetAfceStatus === AfceStatus.REJECTED) {
      await onAfceRejectedTrigger(projectId, actorId, tx);
    }

    return tx.afceDocument.findUnique({
      where: { id: afce.id },
      include: {
        approvals: {
          orderBy: [{ attemptNo: "asc" }, { approvalLevel: "asc" }],
        },
      },
    });
  });

  // Invalidasi cache dashboard setelah mutasi domain AFCE
  await invalidateDashboardCache();

  return result;
}

export async function resubmitAfceDocument(projectId: string, actorId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
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
    where: { projectId },
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

    // 1. Ambil snapshot attempt saat ini sebagai template attempt baru
    const currentSnapshots = await tx.approvalSnapshot.findMany({
      where: {
        afceDocumentId: afce.id,
        attemptNo: currentAttempt,
      },
      orderBy: { approvalLevel: "asc" },
    });

    // 2. Buat snapshot baru untuk nextAttempt dengan status reset ke WAITING
    if (currentSnapshots.length > 0) {
      await tx.approvalSnapshot.createMany({
        data: currentSnapshots.map((item) => ({
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

    // 3. Update AfceDocument: currentAttempt naik, status kembali PENDING
    await tx.afceDocument.update({
      where: { id: afce.id },
      data: {
        currentAttempt: nextAttempt,
        status: AfceStatus.PENDING,
        mcaApprovalDate: null,
      },
    });

    // 4. Reset status proyek kembali ke WAITING_AFCE_AR
    await onEmailSubmittedTrigger(projectId, actorId, tx);

    return tx.afceDocument.findUnique({
      where: { id: afce.id },
      include: {
        approvals: {
          orderBy: [{ attemptNo: "asc" }, { approvalLevel: "asc" }],
        },
      },
    });
  });

  // Invalidasi cache dashboard setelah mutasi domain AFCE
  await invalidateDashboardCache();

  return result;
}
