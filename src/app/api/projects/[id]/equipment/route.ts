import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { equipmentLogSchema } from "@/lib/validations/equipment.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  createEquipmentLog,
  deleteEquipmentLog,
  listEquipmentLogs,
  updateEquipmentLog,
} from "@/server/services/equipment.service";
import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/equipment
 * Mengambil seluruh log alat berat pada proyek
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();
    const logs = await listEquipmentLogs(params.id);
    return apiSuccess(logs);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil daftar log alat berat");
  }
}

/**
 * POST /api/projects/[id]/equipment
 * Mencatat log alat berat baru:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - hmEnd >= hmStart via Zod
 * - hmHours dihitung di server
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validatedData = equipmentLogSchema.parse(body);

    const created = await createEquipmentLog(
      params.id,
      validatedData,
      session.user.id
    );

    return apiSuccess(created, undefined, 201);
  } catch (error) {
    return handleApiError(error, "Gagal membuat log alat berat");
  }
}

/**
 * PUT /api/projects/[id]/equipment
 * Update log alat berat dengan id yang diberikan dalam body
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const equipmentId = body.id || body.equipmentId;

    if (!equipmentId) {
      throw new AppError("ID log alat berat wajib disertakan", 400);
    }

    const validatedData = equipmentLogSchema.parse(body);
    const updated = await updateEquipmentLog(
      equipmentId,
      validatedData,
      session.user.id
    );

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui log alat berat");
  }
}

/**
 * DELETE /api/projects/[id]/equipment
 * Hapus log alat berat dengan id dari search params atau body
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const url = new URL(request.url);
    const searchId = url.searchParams.get("id") || url.searchParams.get("equipmentId");
    let equipmentId = searchId;

    if (!equipmentId) {
      try {
        const body = await request.json();
        equipmentId = body?.id || body?.equipmentId;
      } catch {
        // body might be empty
      }
    }

    if (!equipmentId) {
      throw new AppError("ID log alat berat wajib disertakan", 400);
    }

    const result = await deleteEquipmentLog(equipmentId, session.user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Gagal menghapus log alat berat");
  }
}
