import { AppError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/redis";
import { BastUpsertInput, BastVerifyInput } from "@/lib/validations/bast.schema";
import { onBastVerifiedTrigger } from "@/server/services/project-transition.service";
import { ProjectStatus, Role } from "@prisma/client";

export async function getBastDocument(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });

  if (!project) {
    throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
  }

  return prisma.bastDocument.findFirst({
    where: { projectId, deletedAt: null },
    include: {
      verifiedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function upsertBastDraft(
  projectId: string,
  input: BastUpsertInput,
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

  const existingBast = await prisma.bastDocument.findFirst({
    where: { projectId, deletedAt: null },
  });

  if (existingBast?.verifiedAt) {
    throw new AppError(
      "Dokumen BAST sudah diverifikasi dan tidak dapat diubah lagi",
      409
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const bast = await tx.bastDocument.upsert({
      where: { projectId },
      update: {
        bastNumber: input.bastNumber,
        bastDate: input.bastDate,
        hoInspectorName: input.hoInspectorName || null,
        contractorRepName: input.contractorRepName || null,
        notes: input.notes || null,
        bastFileUrl: input.bastFileUrl?.trim() || "",
      },
      create: {
        projectId,
        bastNumber: input.bastNumber,
        bastDate: input.bastDate,
        hoInspectorName: input.hoInspectorName || null,
        contractorRepName: input.contractorRepName || null,
        notes: input.notes || null,
        bastFileUrl: input.bastFileUrl?.trim() || "",
      },
      include: {
        verifiedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "BastDocument",
        entityId: bast.id,
        action: existingBast ? "UPDATE" : "CREATE",
        diff: {
          bastNumber: input.bastNumber,
          bastDate: input.bastDate.toISOString(),
          bastFileUrl: input.bastFileUrl || null,
        },
      },
    });

    return bast;
  });

  // Invalidasi cache dashboard setelah mutasi domain BAST
  await invalidateDashboardCache();

  return result;
}

export async function verifyBast(
  projectId: string,
  input: BastVerifyInput,
  actorId: string,
  actorRole: Role
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      bastDocument: {
        select: {
          id: true,
          bastNumber: true,
          bastFileUrl: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!project) {
    throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
  }

  if (project.status !== ProjectStatus.WAITING_BAST) {
    throw new AppError(
      `Verifikasi BAST hanya dapat dilakukan saat proyek berstatus WAITING_BAST (status saat ini: ${project.status})`,
      409
    );
  }

  if (!project.bastDocument) {
    throw new AppError(
      "Dokumen BAST belum dibuat. Harap simpan draf BAST terlebih dahulu sebelum verifikasi.",
      400
    );
  }

  if (
    !project.bastDocument.bastFileUrl ||
    !project.bastDocument.bastFileUrl.trim()
  ) {
    throw new AppError(
      "Dokumen BAST belum memiliki berkas lampiran (bastFileUrl wajib terisi)",
      400
    );
  }

  if (project.bastDocument.verifiedAt) {
    throw new AppError("Dokumen BAST sudah diverifikasi sebelumnya", 409);
  }

  const verifiedDate = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedBast = await tx.bastDocument.update({
      where: { projectId },
      data: {
        verifiedAt: verifiedDate,
        verifiedById: actorId,
        ...(input.notes ? { notes: input.notes } : {}),
      },
      include: {
        verifiedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Transisi status proyek T8: WAITING_BAST -> COMPLETED
    await onBastVerifiedTrigger(projectId, actorId, actorRole, tx);

    return updatedBast;
  });

  // Invalidasi cache dashboard setelah mutasi domain BAST
  await invalidateDashboardCache();

  return result;
}
