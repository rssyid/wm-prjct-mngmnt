import { z } from "zod";

/**
 * Validasi input pembuatan ProgressLog baru (B6):
 * - workPackageId & weekNo wajib
 * - logDate tidak boleh masa depan
 * - progressPct 0-100%
 */
export const progressCreateSchema = z.object({
  workPackageId: z.string().min(1, "Paket kerja wajib dipilih"),
  weekNo: z.coerce.number().int().min(1, "Nomor minggu minimal 1").optional(),
  logDate: z.coerce
    .date()
    .refine((d) => d <= new Date(new Date().setHours(23, 59, 59, 999)), {
      message: "Tanggal log tidak boleh di masa depan",
    })
    .default(() => new Date()),
  progressPct: z.coerce
    .number()
    .min(0, "Progres minimal 0%")
    .max(100, "Progres maksimal 100%"),
  volumeAchieved: z.coerce.number().min(0, "Volume tidak boleh negatif").optional().nullable(),
  volumeUnit: z.string().trim().optional().nullable(),
  workDescription: z.string().trim().optional().nullable(),
  weatherCondition: z.string().trim().optional().nullable(),
  waterLevelCm: z.coerce.number().optional().nullable(),
  photos: z.array(z.string().trim()).optional().default([]),
});

export type ProgressCreateInput = z.infer<typeof progressCreateSchema>;

/**
 * Validasi update ProgressLog (hanya boleh pada minggu berjalan):
 * workPackageId & weekNo tidak boleh diubah
 */
export const progressUpdateSchema = z.object({
  logDate: z.coerce
    .date()
    .refine((d) => d <= new Date(new Date().setHours(23, 59, 59, 999)), {
      message: "Tanggal log tidak boleh di masa depan",
    })
    .optional(),
  progressPct: z.coerce
    .number()
    .min(0, "Progres minimal 0%")
    .max(100, "Progres maksimal 100%"),
  volumeAchieved: z.coerce.number().min(0, "Volume tidak boleh negatif").optional().nullable(),
  volumeUnit: z.string().trim().optional().nullable(),
  workDescription: z.string().trim().optional().nullable(),
  weatherCondition: z.string().trim().optional().nullable(),
  waterLevelCm: z.coerce.number().optional().nullable(),
  photos: z.array(z.string().trim()).optional().default([]),
});

export type ProgressUpdateInput = z.infer<typeof progressUpdateSchema>;
