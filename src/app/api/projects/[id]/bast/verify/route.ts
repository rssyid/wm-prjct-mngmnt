import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { bastVerifySchema } from "@/lib/validations/bast.schema";
import { requireRole } from "@/server/auth-guard";
import { onBastVerifiedTrigger } from "@/server/services/project-transition.service";
import { ProjectStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[id]/bast/verify
 * Memverifikasi BAST dan menutup proyek menjadi COMPLETED (T8):
 * - Otorisasi: Khusus SUPER_ADMIN (403 untuk selain SUPER_ADMIN)
 * - Prasyarat: Proyek wajib berstatus WAITING_BAST (409 bila status lain)
 * - Prasyarat: Dokumen BAST wajib ada dan memiliki berkas lampiran
 * - Aturan B8: Independen dari status pelunasan pembayaran paket kerja
 * - Aturan B9: Proyek menjadi read-only secara permanen
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN);

    const project = await prisma.project.findFirst({
      where: { id: params.id, deletedAt: null },
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

    if (!project.bastDocument.bastFileUrl || !project.bastDocument.bastFileUrl.trim()) {
      throw new AppError(
        "Dokumen BAST belum memiliki berkas lampiran (bastFileUrl wajib terisi)",
        400
      );
    }

    if (project.bastDocument.verifiedAt) {
      throw new AppError("Dokumen BAST sudah diverifikasi sebelumnya", 409);
    }

    let notes: string | undefined;
    try {
      const body = await request.json();
      const validated = bastVerifySchema.parse(body);
      if (validated.notes) {
        notes = validated.notes;
      }
    } catch {
      // Body opsional jika tidak ada catatan verifikasi tambahan
    }

    const verifiedDate = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedBast = await tx.bastDocument.update({
        where: { projectId: params.id },
        data: {
          verifiedAt: verifiedDate,
          verifiedById: session.user.id,
          ...(notes ? { notes } : {}),
        },
        include: {
          verifiedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Transisi status proyek T8: WAITING_BAST -> COMPLETED
      await onBastVerifiedTrigger(params.id, session.user.id, session.user.role, tx);

      return updatedBast;
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal memverifikasi dokumen BAST");
  }
}
