import { PackageCategory, PackageDocType, PaymentStatus } from "@prisma/client";
import { z } from "zod";

// Helper untuk normalisasi input
const emptyToNull = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === undefined || val === null) return null;
    const trimmed = typeof val === "string" ? val.trim() : "";
    return trimmed === "" ? null : trimmed;
  });

const emptyNumberToNull = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === undefined || val === null || val === "") return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  });

const emptyDateToNull = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === undefined || val === null || val === "") return null;
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date;
  });

/**
 * Validasi untuk Line Item (Master Material) di dalam Paket
 */
export const packageItemInputSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().min(1, "Master material wajib dipilih"),
  qtyPlanned: z.coerce
    .number()
    .positive("Kuantitas rencana harus lebih besar dari 0"),
  unitPrice: z.coerce
    .number()
    .min(0, "Harga satuan tidak boleh negatif")
    .default(0),
});

export type PackageItemInput = z.infer<typeof packageItemInputSchema>;

/**
 * Validasi pembuatan paket baru
 */
export const packageCreateSchema = z
  .object({
    packageName: z.string().min(2, "Nama paket minimal 2 karakter"),
    category: z.nativeEnum(PackageCategory).default(PackageCategory.MATERIAL),
    vendorId: emptyToNull,
    vendorName: emptyToNull,
    picName: emptyToNull,
    weightPct: z.coerce
      .number()
      .min(0, "Bobot minimal 0%")
      .max(100, "Bobot maksimal 100%")
      .default(0),
    targetQuantity: emptyNumberToNull,
    uom: emptyToNull,
    noPrUspk: emptyToNull,
    prUspkDate: emptyDateToNull,
    noPoSpk: emptyToNull,
    poSpkDate: emptyDateToNull,
    contractOrPoAmount: z.coerce
      .number()
      .min(0, "Nilai kontrak/PO tidak boleh negatif")
      .default(0),
    estDeliveryDate: emptyDateToNull,
    planStartDate: emptyDateToNull,
    planEndDate: emptyDateToNull,
    actualStartDate: emptyDateToNull,
    actualEndDate: emptyDateToNull,
    paymentStatus: z
      .nativeEnum(PaymentStatus)
      .default(PaymentStatus.BELUM_LUNAS),
    paidAmount: emptyNumberToNull,
    paidDate: emptyDateToNull,
    remarks: emptyToNull,
    items: z.array(packageItemInputSchema).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.prUspkDate && data.poSpkDate) {
        return data.prUspkDate <= data.poSpkDate;
      }
      return true;
    },
    {
      message: "Tanggal PR/USPK harus lebih awal atau sama dengan tanggal PO/SPK",
      path: ["poSpkDate"],
    }
  );

export type PackageCreateInput = z.infer<typeof packageCreateSchema>;

/**
 * Validasi pembaruan paket
 */
export const packageUpdateSchema = z
  .object({
    packageName: z.string().min(2, "Nama paket minimal 2 karakter").optional(),
    category: z.nativeEnum(PackageCategory).optional(),
    vendorId: emptyToNull.optional(),
    vendorName: emptyToNull.optional(),
    picName: emptyToNull.optional(),
    weightPct: z.coerce
      .number()
      .min(0, "Bobot minimal 0%")
      .max(100, "Bobot maksimal 100%")
      .optional(),
    targetQuantity: emptyNumberToNull.optional(),
    uom: emptyToNull.optional(),
    noPrUspk: emptyToNull.optional(),
    prUspkDate: emptyDateToNull.optional(),
    noPoSpk: emptyToNull.optional(),
    poSpkDate: emptyDateToNull.optional(),
    contractOrPoAmount: z.coerce
      .number()
      .min(0, "Nilai kontrak/PO tidak boleh negatif")
      .optional(),
    estDeliveryDate: emptyDateToNull.optional(),
    planStartDate: emptyDateToNull.optional(),
    planEndDate: emptyDateToNull.optional(),
    actualStartDate: emptyDateToNull.optional(),
    actualEndDate: emptyDateToNull.optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    paidAmount: emptyNumberToNull.optional(),
    paidDate: emptyDateToNull.optional(),
    remarks: emptyToNull.optional(),
    items: z.array(packageItemInputSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.prUspkDate && data.poSpkDate) {
        return data.prUspkDate <= data.poSpkDate;
      }
      return true;
    },
    {
      message: "Tanggal PR/USPK harus lebih awal atau sama dengan tanggal PO/SPK",
      path: ["poSpkDate"],
    }
  );

export type PackageUpdateInput = z.infer<typeof packageUpdateSchema>;

/**
 * Validasi pencatatan pengiriman kedatangan barang (Deliveries)
 */
export const packageDeliveryInputSchema = z
  .object({
    deliveryDate: z.coerce.date({
      required_error: "Tanggal pengiriman wajib diisi",
    }),
    deliveryOrderNo: emptyToNull.optional(),
    notes: emptyToNull.optional(),
    items: z
      .array(
        z.object({
          packageItemId: z.string().min(1, "Item paket wajib ditentukan"),
          qtyReceived: z.coerce
            .number()
            .min(0, "Kuantitas diterima tidak boleh negatif"),
        })
      )
      .min(1, "Minimal satu item harus dicatat dalam pengiriman"),
    manualDeliveredOverride: z.boolean().optional().default(false),
    remarks: emptyToNull.optional(),
  })
  .refine(
    (data) => {
      if (data.manualDeliveredOverride && (!data.remarks || !data.remarks.trim())) {
        return false;
      }
      return true;
    },
    {
      message:
        "Alasan (remarks) wajib diisi jika melakukan override manual ke status DELIVERED",
      path: ["remarks"],
    }
  );

export type PackageDeliveryInput = z.infer<typeof packageDeliveryInputSchema>;

/**
 * Validasi form pembayaran paket
 */
export const packagePaymentInputSchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus),
  paidAmount: z.coerce
    .number()
    .min(0, "Jumlah bayar tidak boleh negatif")
    .default(0),
  paidDate: emptyDateToNull.optional(),
});

export type PackagePaymentInput = z.infer<typeof packagePaymentInputSchema>;

/**
 * Validasi penambahan dokumen paket pengadaan (PR, PO, DO, INVOICE, OTHER)
 */
export const packageDocumentInputSchema = z.object({
  docType: z.nativeEnum(PackageDocType, {
    required_error: "Tipe dokumen wajib dipilih",
  }),
  docNumber: emptyToNull.optional(),
  docDate: emptyDateToNull.optional(),
  fileUrl: z.string().trim().min(1, "URL berkas wajib diisi"),
  notes: emptyToNull.optional(),
});

export type PackageDocumentInput = z.infer<typeof packageDocumentInputSchema>;
