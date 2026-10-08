import { EquipmentOwnership } from "@prisma/client";
import { z } from "zod";

/**
 * Validasi log alat berat (HeavyEquipmentLog):
 * - hmEnd >= hmStart via Zod refinement
 * - logDate tidak boleh masa depan
 */
export const equipmentLogSchema = z
  .object({
    workPackageId: z.string().trim().optional().nullable(),
    logDate: z.coerce
      .date()
      .refine((d) => d <= new Date(new Date().setHours(23, 59, 59, 999)), {
        message: "Tanggal log tidak boleh di masa depan",
      })
      .default(() => new Date()),
    unitCode: z.string().trim().min(1, "Kode unit wajib diisi"),
    equipmentType: z.string().trim().min(1, "Jenis alat wajib diisi"),
    ownership: z.nativeEnum(EquipmentOwnership).default(EquipmentOwnership.OWNED),
    hmStart: z.coerce.number().min(0, "HM Awal minimal 0").optional().nullable(),
    hmEnd: z.coerce.number().min(0, "HM Akhir minimal 0").optional().nullable(),
    fuelLiters: z.coerce.number().min(0, "BBM tidak boleh negatif").optional().nullable(),
    workVolume: z.coerce
      .number({ required_error: "Volume kerja wajib diisi" })
      .min(0.01, "Volume kerja wajib diisi dan lebih dari 0"),
    volumeUnit: z.string().trim().min(1, "Satuan volume wajib dipilih"),
    workDescription: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.hmStart !== undefined &&
        data.hmStart !== null &&
        data.hmEnd !== undefined &&
        data.hmEnd !== null
      ) {
        return data.hmEnd >= data.hmStart;
      }
      return true;
    },
    {
      message: "HM Akhir (hmEnd) harus lebih besar atau sama dengan HM Awal (hmStart)",
      path: ["hmEnd"],
    }
  );

export type EquipmentLogInput = z.infer<typeof equipmentLogSchema>;
