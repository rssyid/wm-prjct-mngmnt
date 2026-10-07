import { apiSuccess, handleApiError } from "@/lib/api-error";
import { bastUpsertSchema } from "@/lib/validations/bast.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  getBastDocument,
  upsertBastDraft,
} from "@/server/services/bast.service";
import { Role } from "@prisma/client";
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
    const bast = await getBastDocument(params.id);
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
    const body = await request.json();
    const validated = bastUpsertSchema.parse(body);

    const result = await upsertBastDraft(params.id, validated, session.user.id);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menyimpan dokumen BAST");
  }
}
