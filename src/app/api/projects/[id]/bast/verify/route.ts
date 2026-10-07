import { apiSuccess, handleApiError } from "@/lib/api-error";
import { bastVerifySchema } from "@/lib/validations/bast.schema";
import { requireRole } from "@/server/auth-guard";
import { verifyBast } from "@/server/services/bast.service";
import { Role } from "@prisma/client";
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

    const result = await verifyBast(
      params.id,
      { notes },
      session.user.id,
      session.user.role
    );

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal memverifikasi dokumen BAST");
  }
}
