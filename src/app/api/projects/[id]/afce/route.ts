import { apiSuccess, handleApiError } from "@/lib/api-error";
import { afceUpsertSchema } from "@/lib/validations/afce.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  getAfceDocument,
  upsertAfceDocument,
} from "@/server/services/afce.service";
import { Role } from "@prisma/client";
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
    const afce = await getAfceDocument(params.id);
    return apiSuccess(afce);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data dokumen AFCE");
  }
}

/**
 * PUT /api/projects/[id]/afce
 * Upsert dokumen AFCE & snapshot approval pada attempt aktif (currentAttempt).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validated = afceUpsertSchema.parse(body);

    const result = await upsertAfceDocument(
      params.id,
      validated,
      session.user.id
    );

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menyimpan dokumen AFCE");
  }
}
