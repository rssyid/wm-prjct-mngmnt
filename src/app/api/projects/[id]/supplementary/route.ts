import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { supplementaryArInputSchema } from "@/lib/validations/afce.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import { ProjectStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/projects/[id]/supplementary
 * Mengambil daftar AR tambahan (Supplementary AR) untuk proyek.
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

    const supplementaryArs = await prisma.supplementaryAr.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(supplementaryArs);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil daftar AR tambahan");
  }
}

/**
 * POST /api/projects/[id]/supplementary
 * Menambahkan AR tambahan (Supplementary AR) secara paralel.
 * Aturan B5: Berjalan paralel, TIDAK menyentuh status proyek.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

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

    const body = await request.json();
    const validated = supplementaryArInputSchema.parse(body);

    const supplementaryAr = await prisma.supplementaryAr.create({
      data: {
        projectId: params.id,
        noAr: validated.noAr,
        amount: validated.amount,
        notes: validated.notes || null,
        status: validated.status,
      },
    });

    return apiSuccess(supplementaryAr, { message: "AR Tambahan berhasil dicatat" });
  } catch (error) {
    return handleApiError(error, "Gagal menambahkan AR tambahan");
  }
}
