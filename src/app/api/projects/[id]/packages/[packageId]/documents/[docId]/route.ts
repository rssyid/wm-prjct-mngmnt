import { apiSuccess, handleApiError } from "@/lib/api-error";
import { requireRole } from "@/server/auth-guard";
import { deletePackageDocument } from "@/server/services/package.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
    packageId: string;
    docId: string;
  };
}

/**
 * DELETE /api/projects/[id]/packages/[packageId]/documents/[docId]
 * Soft delete dokumen paket kerja
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

    const deleted = await deletePackageDocument(params.docId, session.user.id);

    return apiSuccess({
      id: deleted.id,
      message: "Dokumen paket berhasil dihapus",
    });
  } catch (error) {
    return handleApiError(error, "Gagal menghapus dokumen paket");
  }
}
