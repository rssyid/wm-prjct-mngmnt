import { BudgetType, LocationType, ProjectStatus, StatusIndicator } from "@prisma/client";
import { z } from "zod";

// Helper untuk menormalisasi string kosong "" menjadi null
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

export const boqItemSchema = z.object({
  itemCode: z.string().min(1, "Kode item wajib diisi"),
  name: z.string().min(1, "Nama item wajib diisi"),
  uom: z.string().min(1, "Satuan ukuran wajib diisi"),
  qty: z.coerce.number().min(0, "Kuantitas tidak boleh negatif"),
  unitPrice: z.coerce.number().min(0, "Harga satuan tidak boleh negatif").optional().default(0),
});

export const projectInputSchema = z
  .object({
    projectName: z.string().min(3, "Nama proyek minimal 3 karakter"),
    displayName: z.string().min(2, "Display name minimal 2 karakter"),
    folderCategoryId: z.string().min(1, "Kategori proyek wajib dipilih"),
    structureTypeId: z.string().min(1, "Tipe struktur air wajib dipilih"),
    structureVariantId: emptyToNull,
    companyId: z.string().min(1, "Perusahaan wajib dipilih"),
    estateId: z.string().min(1, "Estate wajib dipilih"),
    blockId: emptyToNull,
    picId: emptyToNull,
    picName: emptyToNull,
    latitude: emptyNumberToNull,
    longitude: emptyNumberToNull,
    geoCoordinates: z.any().optional(),
    locationType: z.nativeEnum(LocationType).default(LocationType.POINT),
    budgetType: z.nativeEnum(BudgetType).default(BudgetType.CAPEX_BUDGETED),
    totalBudgetAmount: z.coerce
      .number()
      .min(0, "Total anggaran tidak boleh negatif")
      .default(0),
    targetQuantity: emptyNumberToNull,
    uom: emptyToNull,
    targetStartDate: emptyDateToNull,
    targetEndDate: emptyDateToNull,
    constructionPlanStartDate: emptyDateToNull,
    constructionPlanEndDate: emptyDateToNull,
    boqItems: z.array(boqItemSchema).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.targetStartDate && data.targetEndDate) {
        return data.targetStartDate <= data.targetEndDate;
      }
      return true;
    },
    {
      message: "Target tanggal mulai harus sebelum atau sama dengan tanggal selesai",
      path: ["targetEndDate"],
    }
  )
  .refine(
    (data) => {
      if (data.constructionPlanStartDate && data.constructionPlanEndDate) {
        return data.constructionPlanStartDate <= data.constructionPlanEndDate;
      }
      return true;
    },
    {
      message:
        "Rencana mulai konstruksi harus sebelum atau sama dengan rencana selesai konstruksi",
      path: ["constructionPlanEndDate"],
    }
  );

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  statusIndicator: z.nativeEnum(StatusIndicator).optional(),
  companyId: z.string().optional(),
  sort: z.string().default("-updatedAt"),
});

export type ProjectQueryParams = z.infer<typeof projectQuerySchema>;

export const recycleBinActionSchema = z.object({
  id: z.string().min(1, "ID proyek wajib diisi"),
  action: z.enum(["RESTORE", "PURGE"]),
});
