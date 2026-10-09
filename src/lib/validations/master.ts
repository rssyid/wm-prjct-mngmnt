import { PackageCategory } from "@prisma/client";
import { z } from "zod";

// 1. Unit of Measurement (UoM)
export const uomSchema = z.object({
  code: z
    .string()
    .min(1, "Kode satuan wajib diisi")
    .max(20, "Kode satuan maksimal 20 karakter")
    .transform((v) => v.trim()),
  name: z.string().min(1, "Nama satuan wajib diisi").transform((v) => v.trim()),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type UomInput = z.infer<typeof uomSchema>;

// 2. Vendor
export const vendorSchema = z.object({
  name: z.string().min(1, "Nama vendor wajib diisi").transform((v) => v.trim()),
  category: z.nativeEnum(PackageCategory, {
    errorMap: () => ({ message: "Kategori vendor tidak valid" }),
  }),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Format email vendor tidak valid").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type VendorInput = z.infer<typeof vendorSchema>;

// 3. FolderCategory
export const folderCategorySchema = z.object({
  code: z
    .string()
    .min(1, "Kode kategori wajib diisi")
    .max(20, "Kode kategori maksimal 20 karakter")
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Nama kategori wajib diisi").transform((v) => v.trim()),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type FolderCategoryInput = z.infer<typeof folderCategorySchema>;

// 4. StructureType & StructureVariant
export const structureTypeSchema = z.object({
  name: z.string().min(1, "Nama tipe struktur wajib diisi").transform((v) => v.trim()),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type StructureTypeInput = z.infer<typeof structureTypeSchema>;

export const boqItemTemplateSchema = z.object({
  itemCode: z.string().min(1, "Kode item wajib diisi"),
  name: z.string().min(1, "Nama item wajib diisi"),
  uom: z.string().min(1, "Satuan wajib diisi"),
  qty: z.coerce.number().positive("Volume/Qty harus lebih dari 0"),
});

export const structureVariantSchema = z.object({
  structureTypeId: z.string().min(1, "Tipe struktur wajib dipilih"),
  code: z
    .string()
    .min(1, "Kode varian wajib diisi")
    .max(30, "Kode varian maksimal 30 karakter")
    .transform((v) => v.trim()),
  name: z.string().min(1, "Nama varian wajib diisi").transform((v) => v.trim()),
  description: z.string().optional().nullable(),
  defaultBoqItems: z.array(boqItemTemplateSchema).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type StructureVariantInput = z.infer<typeof structureVariantSchema>;

// 5. Holiday
export const holidaySchema = z.object({
  holidayDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
    .transform((v) => v.trim()),
  name: z.string().min(1, "Nama hari libur wajib diisi").transform((v) => v.trim()),
  year: z.coerce.number().int().min(2020).max(2050),
  description: z.string().optional().nullable(),
});

export type HolidayInput = z.infer<typeof holidaySchema>;

// 6. Item (Master Material)
export const itemSchema = z.object({
  itemCode: z
    .string()
    .min(1, "Kode item wajib diisi")
    .max(50, "Kode item maksimal 50 karakter")
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Nama item wajib diisi").transform((v) => v.trim()),
  category: z.nativeEnum(PackageCategory, {
    errorMap: () => ({ message: "Kategori paket/item tidak valid" }),
  }),
  uomId: z.string().min(1, "Satuan ukuran (UoM) wajib dipilih"),
  specification: z.string().optional().nullable(),
  standardPrice: z.coerce.number().min(0, "Harga standar minimal 0").default(0),
  isActive: z.boolean().default(true),
});

export type ItemInput = z.infer<typeof itemSchema>;

// 7. Master Lokasi (Region, Company, Estate, Block)
export const regionSchema = z.object({
  code: z
    .string()
    .min(1, "Kode region wajib diisi")
    .max(30, "Kode region maksimal 30 karakter")
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Nama region wajib diisi").transform((v) => v.trim()),
  ops: z.string().optional().nullable(),
  order: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type RegionInput = z.infer<typeof regionSchema>;

export const companySchema = z.object({
  code: z
    .string()
    .min(1, "Kode perusahaan wajib diisi")
    .max(30, "Kode perusahaan maksimal 30 karakter")
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Nama perusahaan wajib diisi").transform((v) => v.trim()),
  alias: z.string().optional().nullable(),
  ops: z.string().optional().nullable(),
  order: z.coerce.number().int().default(0),
  regionId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CompanyInput = z.infer<typeof companySchema>;

export const estateSchema = z.object({
  companyId: z.string().min(1, "Perusahaan wajib dipilih"),
  code: z
    .string()
    .min(1, "Kode estate wajib diisi")
    .max(30, "Kode estate maksimal 30 karakter")
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Nama estate wajib diisi").transform((v) => v.trim()),
  ops: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  group: z.string().optional().nullable(),
  estateNew: z.string().optional().nullable(),
  legacyCode: z.string().optional().nullable(),
  order: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type EstateInput = z.infer<typeof estateSchema>;

export const blockSchema = z.object({
  estateId: z.string().min(1, "Estate wajib dipilih"),
  blockCode: z
    .string()
    .min(1, "Kode blok wajib diisi")
    .max(20, "Kode blok maksimal 20 karakter")
    .transform((v) => v.trim().toUpperCase()),
  name: z.string().min(1, "Nama blok wajib diisi").transform((v) => v.trim()),
  plantingYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  areaHectares: z.coerce.number().min(0, "Luas hektar minimal 0").optional().nullable(),
  isActive: z.boolean().default(true),
});

export type BlockInput = z.infer<typeof blockSchema>;

// 8. Bulk Holiday & Excel Item Import Batch
export const holidayBulkSchema = z.array(
  z.object({
    holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
    name: z.string().min(1, "Nama hari libur wajib diisi"),
    year: z.coerce.number().int().min(2020).max(2050),
    description: z.string().optional().nullable(),
  })
);

export const itemImportBatchSchema = z.array(
  z.object({
    itemCode: z.string().min(1, "Kode item wajib diisi"),
    name: z.string().min(1, "Nama item wajib diisi"),
    category: z.nativeEnum(PackageCategory, {
      errorMap: () => ({ message: "Kategori item tidak valid" }),
    }),
    uomId: z.string().min(1, "Satuan UoM wajib dipilih"),
    specification: z.string().optional().nullable(),
    standardPrice: z.coerce.number().min(0).default(0),
    isActive: z.boolean().default(true),
  })
);

