import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireRole, requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  blockSchema,
  companySchema,
  estateSchema,
  folderCategorySchema,
  holidayBulkSchema,
  holidaySchema,
  itemImportBatchSchema,
  itemSchema,
  regionSchema,
  structureTypeSchema,
  structureVariantSchema,
  uomSchema,
  vendorSchema,
} from "@/lib/validations/master";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/master?type=[uom|vendor|category|structure|variant|holiday|item|region|company|estate|block]&search=...
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession(); // Seluruh user terautentikasi dapat melihat master

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.trim() || "";
    const regionId = searchParams.get("regionId");
    const companyId = searchParams.get("companyId");
    const estateId = searchParams.get("estateId");

    if (!type) {
      return apiError("Parameter 'type' wajib ditentukan", 400);
    }

    switch (type) {
      case "uom": {
        const data = await prisma.unitOfMeasurement.findMany({
          where: search
            ? {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              }
            : undefined,
          orderBy: { code: "asc" },
        });
        return apiSuccess(data);
      }

      case "vendor": {
        const data = await prisma.vendor.findMany({
          where: search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { contactPerson: { contains: search, mode: "insensitive" } },
                ],
              }
            : undefined,
          orderBy: { name: "asc" },
        });
        return apiSuccess(data);
      }

      case "category": {
        const data = await prisma.folderCategory.findMany({
          where: search
            ? {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              }
            : undefined,
          orderBy: { code: "asc" },
        });
        return apiSuccess(data);
      }

      case "structure": {
        const data = await prisma.structureType.findMany({
          where: search
            ? {
                name: { contains: search, mode: "insensitive" },
              }
            : undefined,
          include: {
            variants: {
              orderBy: { code: "asc" },
            },
          },
          orderBy: { name: "asc" },
        });
        return apiSuccess(data);
      }

      case "variant": {
        const data = await prisma.structureVariant.findMany({
          where: search
            ? {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              }
            : undefined,
          include: {
            structureType: {
              select: { id: true, name: true },
            },
          },
          orderBy: { code: "asc" },
        });
        return apiSuccess(data);
      }

      case "holiday": {
        const yearParam = searchParams.get("year");
        const year = yearParam ? parseInt(yearParam, 10) : undefined;

        const data = await prisma.holiday.findMany({
          where: {
            ...(year ? { year } : {}),
            ...(search
              ? {
                  name: { contains: search, mode: "insensitive" },
                }
              : {}),
          },
          orderBy: { holidayDate: "asc" },
        });
        return apiSuccess(data);
      }

      case "item": {
        const categoryParam = searchParams.get("category");
        const statusParam = searchParams.get("status");

        const data = await prisma.item.findMany({
          where: {
            ...(categoryParam && categoryParam !== "ALL"
              ? { category: categoryParam as Prisma.EnumPackageCategoryFilter["equals"] }
              : {}),
            ...(statusParam === "ACTIVE" ? { isActive: true } : statusParam === "INACTIVE" ? { isActive: false } : {}),
            ...(search
              ? {
                  OR: [
                    { itemCode: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                    { specification: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          include: {
            uom: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { itemCode: "asc" },
        });
        return apiSuccess(data);
      }

      case "region": {
        const data = await prisma.region.findMany({
          where: search
            ? {
                OR: [
                  { code: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              }
            : undefined,
          include: {
            _count: {
              select: { companies: true },
            },
          },
          orderBy: { code: "asc" },
        });
        return apiSuccess(data);
      }

      case "company": {
        const withHierarchy = searchParams.get("include") === "hierarchy";
        const data = await prisma.company.findMany({
          where: {
            ...(regionId ? { regionId } : {}),
            ...(search
              ? {
                  OR: [
                    { code: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          include: {
            region: {
              select: { id: true, code: true, name: true },
            },
            _count: {
              select: {
                estates: true,
                projects: true,
              },
            },
            ...(withHierarchy
              ? {
                  estates: {
                    where: { isActive: true },
                    orderBy: { code: "asc" as const },
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      blocks: {
                        where: { isActive: true },
                        orderBy: { blockCode: "asc" as const },
                        select: { id: true, blockCode: true, name: true },
                      },
                    },
                  },
                }
              : {}),
          },
          orderBy: { code: "asc" },
        });
        return apiSuccess(data);
      }

      case "estate": {
        const data = await prisma.estate.findMany({
          where: {
            ...(companyId ? { companyId } : {}),
            ...(search
              ? {
                  OR: [
                    { code: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          include: {
            company: {
              select: { id: true, code: true, name: true },
            },
            _count: {
              select: {
                blocks: true,
                projects: true,
              },
            },
          },
          orderBy: { code: "asc" },
        });
        return apiSuccess(data);
      }

      case "block": {
        const data = await prisma.block.findMany({
          where: {
            ...(estateId ? { estateId } : {}),
            ...(search
              ? {
                  OR: [
                    { blockCode: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          include: {
            estate: {
              select: {
                id: true,
                code: true,
                name: true,
                company: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
            _count: {
              select: {
                projects: true,
              },
            },
          },
          orderBy: { blockCode: "asc" },
        });
        return apiSuccess(data);
      }

      default:
        return apiError(`Tipe master '${type}' tidak didukung`, 400);
    }
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data master");
  }
}

/**
 * POST /api/master?type=...
 * Role: SUPER_ADMIN, WM_HO_SPECIALIST
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN", "WM_HO_SPECIALIST");

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    if (!type) {
      return apiError("Parameter 'type' wajib ditentukan", 400);
    }

    const body = await request.json();

    switch (type) {
      case "uom": {
        const validated = uomSchema.parse(body);
        const created = await prisma.unitOfMeasurement.create({ data: validated });
        return apiSuccess(created, undefined, 201);
      }

      case "vendor": {
        const validated = vendorSchema.parse(body);
        const created = await prisma.vendor.create({
          data: {
            ...validated,
            email: validated.email || null,
          },
        });
        return apiSuccess(created, undefined, 201);
      }

      case "category": {
        const validated = folderCategorySchema.parse(body);
        const created = await prisma.folderCategory.create({ data: validated });
        return apiSuccess(created, undefined, 201);
      }

      case "structure": {
        const validated = structureTypeSchema.parse(body);
        const created = await prisma.structureType.create({ data: validated });
        return apiSuccess(created, undefined, 201);
      }

      case "variant": {
        const validated = structureVariantSchema.parse(body);
        const created = await prisma.structureVariant.create({
          data: {
            structureTypeId: validated.structureTypeId,
            code: validated.code,
            name: validated.name,
            description: validated.description,
            defaultBoqItems: validated.defaultBoqItems ?? Prisma.JsonNull,
            isActive: validated.isActive,
          },
        });
        return apiSuccess(created, undefined, 201);
      }

      case "holiday": {
        const validated = holidaySchema.parse(body);
        const holidayDate = new Date(`${validated.holidayDate}T00:00:00.000Z`);
        const created = await prisma.holiday.create({
          data: {
            holidayDate,
            name: validated.name,
            year: validated.year,
            description: validated.description,
          },
        });
        return apiSuccess(created, undefined, 201);
      }

      case "holiday-bulk": {
        const validated = holidayBulkSchema.parse(body);
        let createdCount = 0;
        let updatedCount = 0;

        await prisma.$transaction(async (tx) => {
          for (const item of validated) {
            const holidayDate = new Date(`${item.holidayDate}T00:00:00.000Z`);
            const existing = await tx.holiday.findUnique({
              where: { holidayDate },
            });

            if (existing) {
              await tx.holiday.update({
                where: { holidayDate },
                data: {
                  name: item.name,
                  year: item.year,
                  description: item.description,
                },
              });
              updatedCount++;
            } else {
              await tx.holiday.create({
                data: {
                  holidayDate,
                  name: item.name,
                  year: item.year,
                  description: item.description,
                },
              });
              createdCount++;
            }
          }
        });

        return apiSuccess({
          total: validated.length,
          createdCount,
          updatedCount,
        }, undefined, 201);
      }

      case "item": {
        const validated = itemSchema.parse(body);
        const created = await prisma.item.create({
          data: {
            itemCode: validated.itemCode,
            name: validated.name,
            category: validated.category,
            uomId: validated.uomId,
            specification: validated.specification,
            standardPrice: new Prisma.Decimal(validated.standardPrice),
            isActive: validated.isActive,
          },
          include: {
            uom: { select: { id: true, code: true, name: true } },
          },
        });
        return apiSuccess(created, undefined, 201);
      }

      case "item-import": {
        const validated = itemImportBatchSchema.parse(body);
        let createdCount = 0;
        let updatedCount = 0;

        await prisma.$transaction(async (tx) => {
          for (const item of validated) {
            const existing = await tx.item.findUnique({
              where: { itemCode: item.itemCode },
            });

            if (existing) {
              await tx.item.update({
                where: { itemCode: item.itemCode },
                data: {
                  name: item.name,
                  category: item.category,
                  uomId: item.uomId,
                  specification: item.specification,
                  standardPrice: new Prisma.Decimal(item.standardPrice),
                  isActive: item.isActive,
                },
              });
              updatedCount++;
            } else {
              await tx.item.create({
                data: {
                  itemCode: item.itemCode,
                  name: item.name,
                  category: item.category,
                  uomId: item.uomId,
                  specification: item.specification,
                  standardPrice: new Prisma.Decimal(item.standardPrice),
                  isActive: item.isActive,
                },
              });
              createdCount++;
            }
          }
        });

        return apiSuccess({
          total: validated.length,
          createdCount,
          updatedCount,
        }, undefined, 201);
      }

      case "region": {
        const validated = regionSchema.parse(body);
        const created = await prisma.region.create({ data: validated });
        return apiSuccess(created, undefined, 201);
      }

      case "company": {
        const validated = companySchema.parse(body);
        const created = await prisma.company.create({
          data: {
            code: validated.code,
            name: validated.name,
            regionId: validated.regionId || null,
            isActive: validated.isActive,
          },
          include: {
            region: { select: { id: true, code: true, name: true } },
          },
        });
        return apiSuccess(created, undefined, 201);
      }

      case "estate": {
        const validated = estateSchema.parse(body);
        const created = await prisma.estate.create({
          data: {
            companyId: validated.companyId,
            code: validated.code,
            name: validated.name,
            region: validated.region || null,
            isActive: validated.isActive,
          },
          include: {
            company: { select: { id: true, code: true, name: true } },
          },
        });
        return apiSuccess(created, undefined, 201);
      }

      case "block": {
        const validated = blockSchema.parse(body);
        const created = await prisma.block.create({
          data: {
            estateId: validated.estateId,
            blockCode: validated.blockCode,
            name: validated.name,
            plantingYear: validated.plantingYear || null,
            areaHectares: validated.areaHectares || null,
            isActive: validated.isActive,
          },
          include: {
            estate: {
              select: {
                id: true,
                code: true,
                name: true,
                company: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });
        return apiSuccess(created, undefined, 201);
      }

      default:
        return apiError(`Tipe master '${type}' tidak didukung`, 400);
    }
  } catch (error) {
    return handleApiError(error, "Gagal menambahkan data master");
  }
}

/**
 * PUT /api/master?type=...
 * Role: SUPER_ADMIN, WM_HO_SPECIALIST
 */
export async function PUT(request: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN", "WM_HO_SPECIALIST");

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    if (!type) {
      return apiError("Parameter 'type' wajib ditentukan", 400);
    }

    const body = await request.json();
    const idSchema = z.string().min(1, "ID data wajib disertakan");
    const id = idSchema.parse(body.id);

    switch (type) {
      case "uom": {
        const validated = uomSchema.parse(body);
        const updated = await prisma.unitOfMeasurement.update({
          where: { id },
          data: validated,
        });
        return apiSuccess(updated);
      }

      case "vendor": {
        const validated = vendorSchema.parse(body);
        const updated = await prisma.vendor.update({
          where: { id },
          data: {
            ...validated,
            email: validated.email || null,
          },
        });
        return apiSuccess(updated);
      }

      case "category": {
        const validated = folderCategorySchema.parse(body);
        const updated = await prisma.folderCategory.update({
          where: { id },
          data: validated,
        });
        return apiSuccess(updated);
      }

      case "structure": {
        const validated = structureTypeSchema.parse(body);
        const updated = await prisma.structureType.update({
          where: { id },
          data: validated,
        });
        return apiSuccess(updated);
      }

      case "variant": {
        const validated = structureVariantSchema.parse(body);
        const updated = await prisma.structureVariant.update({
          where: { id },
          data: {
            structureTypeId: validated.structureTypeId,
            code: validated.code,
            name: validated.name,
            description: validated.description,
            defaultBoqItems: validated.defaultBoqItems ?? Prisma.JsonNull,
            isActive: validated.isActive,
          },
        });
        return apiSuccess(updated);
      }

      case "holiday": {
        const validated = holidaySchema.parse(body);
        const holidayDate = new Date(`${validated.holidayDate}T00:00:00.000Z`);
        const updated = await prisma.holiday.update({
          where: { id },
          data: {
            holidayDate,
            name: validated.name,
            year: validated.year,
            description: validated.description,
          },
        });
        return apiSuccess(updated);
      }

      case "item": {
        const validated = itemSchema.parse(body);
        const updated = await prisma.item.update({
          where: { id },
          data: {
            itemCode: validated.itemCode,
            name: validated.name,
            category: validated.category,
            uomId: validated.uomId,
            specification: validated.specification,
            standardPrice: new Prisma.Decimal(validated.standardPrice),
            isActive: validated.isActive,
          },
          include: {
            uom: { select: { id: true, code: true, name: true } },
          },
        });
        return apiSuccess(updated);
      }

      case "region": {
        const validated = regionSchema.parse(body);
        const updated = await prisma.region.update({
          where: { id },
          data: validated,
        });
        return apiSuccess(updated);
      }

      case "company": {
        const validated = companySchema.parse(body);
        const updated = await prisma.company.update({
          where: { id },
          data: {
            code: validated.code,
            name: validated.name,
            regionId: validated.regionId || null,
            isActive: validated.isActive,
          },
          include: {
            region: { select: { id: true, code: true, name: true } },
          },
        });
        return apiSuccess(updated);
      }

      case "estate": {
        const validated = estateSchema.parse(body);
        const updated = await prisma.estate.update({
          where: { id },
          data: {
            companyId: validated.companyId,
            code: validated.code,
            name: validated.name,
            region: validated.region || null,
            isActive: validated.isActive,
          },
          include: {
            company: { select: { id: true, code: true, name: true } },
          },
        });
        return apiSuccess(updated);
      }

      case "block": {
        const validated = blockSchema.parse(body);
        const updated = await prisma.block.update({
          where: { id },
          data: {
            estateId: validated.estateId,
            blockCode: validated.blockCode,
            name: validated.name,
            plantingYear: validated.plantingYear || null,
            areaHectares: validated.areaHectares || null,
            isActive: validated.isActive,
          },
          include: {
            estate: {
              select: {
                id: true,
                code: true,
                name: true,
                company: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });
        return apiSuccess(updated);
      }

      default:
        return apiError(`Tipe master '${type}' tidak didukung`, 400);
    }
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui data master");
  }
}

/**
 * DELETE /api/master?type=...&id=...
 * Role: SUPER_ADMIN, WM_HO_SPECIALIST
 * Memeriksa keterkaitan data Project. Jika data masih digunakan, tolak dengan 409 Conflict.
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN", "WM_HO_SPECIALIST");

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    if (!type || !id) {
      return apiError("Parameter 'type' dan 'id' wajib disertakan", 400);
    }

    switch (type) {
      case "uom": {
        const itemsUsingUom = await prisma.item.count({ where: { uomId: id } });
        if (itemsUsingUom > 0) {
          return apiError(
            `Satuan (UoM) tidak dapat dihapus karena masih digunakan oleh ${itemsUsingUom} master item/material.`,
            409
          );
        }
        await prisma.unitOfMeasurement.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "vendor": {
        await prisma.vendor.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "category": {
        const projectsUsingCategory = await prisma.project.count({ where: { folderCategoryId: id } });
        if (projectsUsingCategory > 0) {
          return apiError(
            `Kategori proyek tidak dapat dihapus karena masih digunakan oleh ${projectsUsingCategory} proyek.`,
            409
          );
        }
        await prisma.folderCategory.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "structure": {
        const projectsUsingStructure = await prisma.project.count({ where: { structureTypeId: id } });
        if (projectsUsingStructure > 0) {
          return apiError(
            `Tipe struktur tidak dapat dihapus karena masih digunakan oleh ${projectsUsingStructure} proyek.`,
            409
          );
        }
        await prisma.structureType.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "variant": {
        const projectsUsingVariant = await prisma.project.count({ where: { structureVariantId: id } });
        if (projectsUsingVariant > 0) {
          return apiError(
            `Varian struktur tidak dapat dihapus karena masih digunakan oleh ${projectsUsingVariant} proyek.`,
            409
          );
        }
        await prisma.structureVariant.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "holiday": {
        await prisma.holiday.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "item": {
        const packageItemsCount = await prisma.packageItem.count({ where: { itemId: id } });
        if (packageItemsCount > 0) {
          return apiError(
            `Item material tidak dapat dihapus karena sudah dipakai dalam ${packageItemsCount} paket pengadaan proyek.`,
            409
          );
        }
        await prisma.item.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      // --- Guard Penghapusan Master Lokasi ---
      case "region": {
        // Cek apakah region memiliki company yang dipakai proyek
        const companiesInRegion = await prisma.company.findMany({
          where: { regionId: id },
          select: { id: true, name: true },
        });

        if (companiesInRegion.length > 0) {
          const companyIds = companiesInRegion.map((c) => c.id);
          const projectCount = await prisma.project.count({
            where: { companyId: { in: companyIds } },
          });

          if (projectCount > 0) {
            return apiError(
              `Region tidak dapat dihapus karena membawahi ${companiesInRegion.length} perusahaan yang terkait dengan ${projectCount} proyek.`,
              409
            );
          }
        }

        await prisma.region.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "company": {
        const projectCount = await prisma.project.count({ where: { companyId: id } });
        if (projectCount > 0) {
          return apiError(
            `Perusahaan tidak dapat dihapus karena masih digunakan oleh ${projectCount} proyek terdaftar.`,
            409
          );
        }
        await prisma.company.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "estate": {
        const projectCount = await prisma.project.count({ where: { estateId: id } });
        if (projectCount > 0) {
          return apiError(
            `Estate tidak dapat dihapus karena masih digunakan oleh ${projectCount} proyek terdaftar.`,
            409
          );
        }
        await prisma.estate.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "block": {
        const projectCount = await prisma.project.count({ where: { blockId: id } });
        if (projectCount > 0) {
          return apiError(
            `Blok tidak dapat dihapus karena masih digunakan oleh ${projectCount} proyek terdaftar.`,
            409
          );
        }
        await prisma.block.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      default:
        return apiError(`Tipe master '${type}' tidak didukung`, 400);
    }
  } catch (error) {
    return handleApiError(error, "Gagal menghapus data master");
  }
}
