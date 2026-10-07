import { z } from "zod";

export const approvalSnapshotItemSchema = z.object({
  id: z.string().optional(),
  approvalLevel: z.coerce.number().int().min(1, "Level minimal 1"),
  role: z.string().trim().min(1, "Jabatan / Role approver wajib diisi"),
  personName: z.string().trim().nullable().optional(),
  status: z.enum(["WAITING", "APPROVED", "REJECTED"]).default("WAITING"),
  submittedAt: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  evidenceDocUrl: z.string().trim().nullable().optional(),
});

export const afceUpsertSchema = z
  .object({
    noAr: z.string().trim().nullable().optional(),
    arType: z.string().trim().nullable().optional(),
    budgetType: z.string().trim().nullable().optional(),
    approvedAmount: z.coerce
      .number()
      .min(0, "Nominal yang disetujui tidak boleh negatif")
      .default(0),
    drawingReady: z.boolean().default(false),
    rabReady: z.boolean().default(false),
    mapReady: z.boolean().default(false),
    emailSubmitted: z.boolean().default(false),
    emailSubmittedDate: z.string().nullable().optional(),
    mcaApprovalDate: z.string().nullable().optional(),
    approvals: z.array(approvalSnapshotItemSchema).default([]),
  })
  .refine(
    (data) => {
      if (data.emailSubmitted) {
        return !!data.noAr && data.noAr.trim().length > 0;
      }
      return true;
    },
    {
      message: "Nomor AR wajib diisi saat email pengajuan telah dikirim",
      path: ["noAr"],
    }
  )
  .refine(
    (data) => {
      if (data.emailSubmitted) {
        return !!data.emailSubmittedDate;
      }
      return true;
    },
    {
      message: "Tanggal pengajuan email wajib diisi saat email pengajuan telah dikirim",
      path: ["emailSubmittedDate"],
    }
  );

export const supplementaryArInputSchema = z.object({
  noAr: z.string().trim().min(1, "Nomor AR tambahan wajib diisi"),
  amount: z.coerce
    .number()
    .positive("Nominal AR tambahan harus lebih besar dari 0"),
  notes: z.string().trim().nullable().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
});

export type ApprovalSnapshotItemInput = z.infer<typeof approvalSnapshotItemSchema>;
export type AfceUpsertInput = z.infer<typeof afceUpsertSchema>;
export type SupplementaryArInput = z.infer<typeof supplementaryArInputSchema>;
