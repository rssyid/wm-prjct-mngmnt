import { z } from "zod";

/**
 * Skema validasi untuk pembuatan / pembaruan draf dokumen BAST.
 */
export const bastUpsertSchema = z.object({
  bastNumber: z.string().trim().min(1, "Nomor BAST wajib diisi"),
  bastDate: z.coerce.date({ required_error: "Tanggal BAST wajib diisi" }),
  hoInspectorName: z.string().trim().optional().nullable(),
  contractorRepName: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  bastFileUrl: z.string().trim().optional().nullable(),
});

/**
 * Skema validasi untuk verifikasi akhir dokumen BAST oleh SUPER_ADMIN.
 */
export const bastVerifySchema = z.object({
  notes: z.string().trim().optional().nullable(),
});

export type BastUpsertInput = z.infer<typeof bastUpsertSchema>;
export type BastVerifyInput = z.infer<typeof bastVerifySchema>;
