import { apiSuccess, handleApiError } from "@/lib/api-error";
import { equipmentLogSchema } from "@/lib/validations/equipment.schema";
import { requireRole } from "@/server/auth-guard";
import {
  deleteEquipmentLog,
  updateEquipmentLog,
} from "@/server/services/equipment.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
    equipmentId: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * PUT /api/projects/[id]/equipment/[equipmentId]
 * Memperbarui log alat berat
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validatedData = equipmentLogSchema.parse(body);

    const updated = await updateEquipmentLog(
      params.equipmentId,
      validatedData,
      session.user.id
    );

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui log alat berat");
  }
}

/**
 * DELETE /api/projects/[id]/equipment/[equipmentId]
 * Menghapus log alat berat (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const result = await deleteEquipmentLog(params.equipmentId, session.user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menghapus log alat berat");
  }
}
