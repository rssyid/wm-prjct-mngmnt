import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { recycleBinActionSchema } from "@/lib/validations/project.schema";
import { requireRole } from "@/server/auth-guard";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/deleted
 * Mengambil daftar proyek yang berada di recycle bin (deletedAt != null).
 * Otorisasi: Khusus SUPER_ADMIN.
 */
export async function GET() {
  try {
    await requireRole(Role.SUPER_ADMIN);

    const deletedProjects = await prisma.project.findMany({
      where: {
        deletedAt: { not: null },
      },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        displayName: true,
        status: true,
        statusIndicator: true,
        progressPct: true,
        totalBudgetAmount: true,
        deletedAt: true,
        company: { select: { id: true, code: true, name: true } },
        estate: { select: { id: true, code: true, name: true } },
      },
      orderBy: {
        deletedAt: "desc",
      },
    });

    return apiSuccess(deletedProjects);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil daftar proyek terhapus");
  }
}

/**
 * POST /api/projects/deleted
 * Melakukan restore (pemulihan berantai B11) atau purge (hard delete).
 * Otorisasi: Khusus SUPER_ADMIN.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN);

    const body = await request.json();
    const { id, action } = recycleBinActionSchema.parse(body);

    const project = await prisma.project.findFirst({
      where: { id, deletedAt: { not: null } },
      select: { id: true, projectCode: true },
    });

    if (!project) {
      throw new AppError("Proyek tidak ditemukan di recycle bin", 404);
    }

    if (action === "RESTORE") {
      await prisma.$transaction(async (tx) => {
        // 1. Pulihkan Project
        await tx.project.update({
          where: { id },
          data: { deletedAt: null },
        });

        // 2. Pulihkan relasi anak
        await tx.workPackage.updateMany({
          where: { projectId: id },
          data: { deletedAt: null },
        });

        await tx.progressLog.updateMany({
          where: { projectId: id },
          data: { deletedAt: null },
        });

        await tx.heavyEquipmentLog.updateMany({
          where: { projectId: id },
          data: { deletedAt: null },
        });

        await tx.packageDelivery.updateMany({
          where: { workPackage: { projectId: id } },
          data: { deletedAt: null },
        });

        await tx.bastDocument.updateMany({
          where: { projectId: id },
          data: { deletedAt: null },
        });

        // 3. Catat AuditLog
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            entity: "Project",
            entityId: id,
            action: "RESTORE",
            diff: { projectCode: project.projectCode },
          },
        });
      });

      return apiSuccess({ message: `Proyek ${project.projectCode} berhasil dipulihkan` });
    }

    if (action === "PURGE") {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            entity: "Project",
            entityId: id,
            action: "PURGE",
            diff: { projectCode: project.projectCode },
          },
        });

        // Hapus permanen
        await tx.project.delete({
          where: { id },
        });
      });

      return apiSuccess({
        message: `Proyek ${project.projectCode} berhasil dihapus permanen`,
      });
    }

    throw new AppError("Aksi recycle bin tidak valid", 400);
  } catch (error) {
    return handleApiError(error, "Gagal memproses aksi recycle bin");
  }
}
