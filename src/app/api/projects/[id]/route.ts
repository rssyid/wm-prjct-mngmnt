import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { calculateProjectSla } from "@/lib/sla";
import { projectInputSchema } from "@/lib/validations/project.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import { getProjectCurrentWeek } from "@/server/services/progress.service";
import { Prisma, ProjectStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/projects/[id]
 * Mengambil detail lengkap proyek beserta relasinya.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
      },
      include: {
        company: { select: { id: true, code: true, name: true } },
        estate: { select: { id: true, code: true, name: true } },
        block: { select: { id: true, blockCode: true, name: true } },
        folderCategory: { select: { id: true, code: true, name: true } },
        structureType: { select: { id: true, name: true } },
        structureVariant: { select: { id: true, code: true, name: true, defaultBoqItems: true } },
        pic: { select: { id: true, name: true, roleTitle: true, phone: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        afceDocument: true,
        bastDocument: true,
        workPackages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!project) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    const currentWeek = getProjectCurrentWeek(project);

    return apiSuccess({
      ...project,
      currentWeek,
    });
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data proyek");
  }
}

/**
 * PUT /api/projects/[id]
 * Memperbarui data proyek:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - Guard B9: Status COMPLETED/CANCELLED menolak perubahan dengan 409
 * - Status proyek TIDAK BOLEH diubah di sini (hanya melalui project-transition.service.ts)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

    const existingProject = await prisma.project.findFirst({
      where: { id: params.id, deletedAt: null },
      select: {
        id: true,
        status: true,
        statusIndicator: true,
        progressPct: true,
      },
    });

    if (!existingProject) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    // Guard Imutabilitas B9
    if (existingProject.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (existingProject.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    const body = await request.json();
    const validatedData = projectInputSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const holidays = await tx.holiday.findMany({
        select: { holidayDate: true },
      });

      const updatedSla = calculateProjectSla({
        status: existingProject.status,
        currentIndicator: existingProject.statusIndicator,
        progressPct: existingProject.progressPct,
        targetStartDate: validatedData.targetStartDate,
        targetEndDate: validatedData.targetEndDate,
        holidays: holidays.map((h) => h.holidayDate),
        asOfDate: new Date(),
      });

      const updatedProject = await tx.project.update({
        where: { id: params.id },
        data: {
          projectName: validatedData.projectName,
          displayName: validatedData.displayName,
          folderCategoryId: validatedData.folderCategoryId,
          structureTypeId: validatedData.structureTypeId,
          structureVariantId: validatedData.structureVariantId || null,
          companyId: validatedData.companyId,
          estateId: validatedData.estateId,
          blockId: validatedData.blockId || null,
          picId: validatedData.picId || null,
          picName: validatedData.picName || null,
          latitude: validatedData.latitude || null,
          longitude: validatedData.longitude || null,
          geoCoordinates: validatedData.geoCoordinates || Prisma.JsonNull,
          locationType: validatedData.locationType,
          budgetType: validatedData.budgetType,
          totalBudgetAmount: new Prisma.Decimal(validatedData.totalBudgetAmount),
          targetQuantity: validatedData.targetQuantity || null,
          uom: validatedData.uom || null,
          targetStartDate: validatedData.targetStartDate,
          targetEndDate: validatedData.targetEndDate,
          constructionPlanStartDate: validatedData.constructionPlanStartDate,
          constructionPlanEndDate: validatedData.constructionPlanEndDate,
          sitePlanUrl: validatedData.sitePlanUrl || null,
          drawingUrl: validatedData.drawingUrl || null,
          statusIndicator: updatedSla.indicator,
          boqItems: validatedData.boqItems
            ? (validatedData.boqItems as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entity: "Project",
          entityId: params.id,
          action: "UPDATE",
          diff: {
            projectName: validatedData.projectName,
            displayName: validatedData.displayName,
            totalBudgetAmount: validatedData.totalBudgetAmount,
          },
        },
      });

      return updatedProject;
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui data proyek");
  }
}

/**
 * DELETE /api/projects/[id]
 * Soft delete berantai sesuai Aturan B11:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - Guard B9: Proyek COMPLETED tidak dapat dihapus (409)
 * - Mengisi deletedAt pada Project dan seluruh entitas anak
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!project || project.deletedAt) {
      throw new AppError("Proyek tidak ditemukan atau sudah dihapus", 404);
    }

    // Guard Imutabilitas B9
    if (project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Soft delete Project
      await tx.project.update({
        where: { id: params.id },
        data: { deletedAt: now },
      });

      // 2. Soft delete WorkPackages anak
      await tx.workPackage.updateMany({
        where: { projectId: params.id, deletedAt: null },
        data: { deletedAt: now },
      });

      // 3. Soft delete ProgressLogs anak
      await tx.progressLog.updateMany({
        where: { projectId: params.id, deletedAt: null },
        data: { deletedAt: now },
      });

      // 4. Soft delete HeavyEquipmentLogs anak
      await tx.heavyEquipmentLog.updateMany({
        where: { projectId: params.id, deletedAt: null },
        data: { deletedAt: now },
      });

      // 5. Soft delete PackageDelivery anak
      await tx.packageDelivery.updateMany({
        where: { workPackage: { projectId: params.id }, deletedAt: null },
        data: { deletedAt: now },
      });

      // 6. Soft delete BastDocument
      await tx.bastDocument.updateMany({
        where: { projectId: params.id, deletedAt: null },
        data: { deletedAt: now },
      });

      // 7. Catat AuditLog
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entity: "Project",
          entityId: params.id,
          action: "DELETE",
          diff: {
            deletedAt: now.toISOString(),
            status: project.status,
          },
        },
      });
    });

    return apiSuccess({
      id: params.id,
      message: "Proyek dan seluruh data terkait berhasil dipindahkan ke recycle bin",
    });
  } catch (error) {
    return handleApiError(error, "Gagal menghapus proyek");
  }
}

/**
 * PATCH /api/projects/[id]
 * Pembaruan parsial dokumen proyek (sitePlanUrl, drawingUrl)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

    const existingProject = await prisma.project.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!existingProject) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    if (existingProject.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (existingProject.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    const body = await request.json();
    const patchSchema = z.object({
      sitePlanUrl: z.string().nullable().optional(),
      drawingUrl: z.string().nullable().optional(),
    });
    const validated = patchSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id: params.id },
        data: {
          ...(validated.sitePlanUrl !== undefined ? { sitePlanUrl: validated.sitePlanUrl } : {}),
          ...(validated.drawingUrl !== undefined ? { drawingUrl: validated.drawingUrl } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entity: "Project",
          entityId: params.id,
          action: "UPDATE",
          diff: validated,
        },
      });

      return proj;
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui dokumen proyek");
  }
}

