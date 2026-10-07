import { apiSuccess, handleApiError } from "@/lib/api-error";
import { packageDeliveryInputSchema } from "@/lib/validations/package.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import {
  listPackageDeliveries,
  recordPackageDelivery,
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
 * GET /api/projects/[id]/packages/[packageId]/deliveries
 * Mengambil riwayat seluruh kedatangan barang (deliveries) untuk paket ini
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireSession();
    const deliveries = await listPackageDeliveries(params.id, params.packageId);
    return apiSuccess(deliveries);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil riwayat pengiriman");
  }
}

/**
 * POST /api/projects/[id]/packages/[packageId]/deliveries
 * Mencatat pengiriman barang baru (kedatangan berulang B7):
 * - Menyimpan PackageDelivery dan PackageDeliveryItem
 * - Akumulasi PackageItem.qtyReceived
 * - actualDeliveryDate = kiriman terakhir
 * - Evaluasi status: IN_DELIVERY / PARTIALLY_DELIVERED / DELIVERED
 * - Hitung deliveryDelayDays
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);
    const body = await request.json();
    const validatedData = packageDeliveryInputSchema.parse(body);

    const result = await recordPackageDelivery(
      params.id,
      params.packageId,
      validatedData,
      session.user.id
    );

    return apiSuccess(result, undefined, 201);
  } catch (error) {
    return handleApiError(error, "Gagal mencatat pengiriman barang");
  }
}
