import { apiSuccess, handleApiError } from "@/lib/api-error";
import { packageUpdateSchema } from "@/lib/validations/package.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  deletePackage,
  getPackageById,
  updatePackage,
} from "@/server/services/package.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
    packageId: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/packages/[packageId]
 * Mengambil detail satu paket pengadaan beserta item dan riwayat pengiriman
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();
    const pkg = await getPackageById(params.id, params.packageId);
    return apiSuccess(pkg);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data paket kerja");
  }
}

/**
 * PUT /api/projects/[id]/packages/[packageId]
 * Memperbarui data paket kerja:
 * - Update nomor PR & PO dengan update status otomatis (PR_SUBMITTED / PO_ISSUED)
 * - Sinkronisasi line items dari Master Item
 * - Validasi uang Decimal & bobot total <= 100%
 * - Update status dan nilai pembayaran
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validatedData = packageUpdateSchema.parse(body);

    const updated = await updatePackage(
      params.id,
      params.packageId,
      validatedData,
      session.user.id
    );

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui paket kerja");
  }
}

/**
 * DELETE /api/projects/[id]/packages/[packageId]
 * Soft delete paket kerja (mengisi deletedAt) dan menghitung ulang progres tertimbang
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const result = await deletePackage(
      params.id,
      params.packageId,
      session.user.id
    );

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menghapus paket kerja");
  }
}
