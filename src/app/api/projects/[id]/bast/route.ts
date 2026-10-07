import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { bastUpsertSchema } from "@/lib/validations/bast.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import { ProjectStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/bast
 * Mengambil detail dokumen BAST beserta informasi verifikator.
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

    const bast = await prisma.bastDocument.findFirst({
      where: { projectId: params.id, deletedAt: null },
      include: {
        verifiedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return apiSuccess(bast);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data dokumen BAST");
  }
}

/**
 * PUT /api/projects/[id]/bast
 * Upsert draf dokumen BAST:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - Guard Imutabilitas B9: Tolak dengan 409 jika proyek COMPLETED / CANCELLED
 * - Guard BAST terverifikasi: Tolak dengan 409 jika BAST sudah memiliki verifiedAt
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

    const existingBast = await prisma.bastDocument.findFirst({
      where: { projectId: params.id, deletedAt: null },
    });

    if (existingBast?.verifiedAt) {
      throw new AppError("Dokumen BAST sudah diverifikasi dan tidak dapat diubah lagi", 409);
    }

    const body = await request.json();
    const validated = bastUpsertSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const bast = await tx.bastDocument.upsert({
        where: { projectId: params.id },
        update: {
          bastNumber: validated.bastNumber,
          bastDate: validated.bastDate,
          hoInspectorName: validated.hoInspectorName || null,
          contractorRepName: validated.contractorRepName || null,
          notes: validated.notes || null,
          bastFileUrl: validated.bastFileUrl?.trim() || "",
        },
        create: {
          projectId: params.id,
          bastNumber: validated.bastNumber,
          bastDate: validated.bastDate,
          hoInspectorName: validated.hoInspectorName || null,
          contractorRepName: validated.contractorRepName || null,
          notes: validated.notes || null,
          bastFileUrl: validated.bastFileUrl?.trim() || "",
        },
        include: {
          verifiedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entity: "BastDocument",
          entityId: bast.id,
          action: existingBast ? "UPDATE" : "CREATE",
          diff: {
            bastNumber: validated.bastNumber,
            bastDate: validated.bastDate.toISOString(),
            bastFileUrl: validated.bastFileUrl || null,
          },
        },
      });

      return bast;
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menyimpan draf dokumen BAST");
  }
}
