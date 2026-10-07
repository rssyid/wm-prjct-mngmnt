import { apiSuccess, handleApiError } from "@/lib/api-error";
import { packageDocumentInputSchema } from "@/lib/validations/package.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  createPackageDocument,
  listPackageDocuments,
} from "@/server/services/package.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
    packageId: string;
  };
}

/**
 * GET /api/projects/[id]/packages/[packageId]/documents
 * Mengambil daftar berkas dokumen untuk paket kerja tertentu
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();
    const docs = await listPackageDocuments(params.packageId);
    return apiSuccess(docs);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil dokumen paket");
  }
}

/**
 * POST /api/projects/[id]/packages/[packageId]/documents
 * Menambahkan dokumen baru (PR, PO, DO, Invoice, etc) ke paket kerja
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validated = packageDocumentInputSchema.parse(body);

    const doc = await createPackageDocument(
      params.packageId,
      validated,
      session.user.id
    );

    return apiSuccess(doc, undefined, 201);
  } catch (error) {
    return handleApiError(error, "Gagal menyimpan dokumen paket");
  }
}
