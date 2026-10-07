import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireRole, requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  folderCategorySchema,
  holidaySchema,
  itemSchema,
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
 * GET /api/master?type=[uom|vendor|category|structure|variant|holiday|item]&search=...
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession(); // Seluruh user terautentikasi dapat melihat master

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.trim() || "";

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
        const data = await prisma.item.findMany({
          where: search
            ? {
                OR: [
                  { itemCode: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              }
            : undefined,
          include: {
            uom: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: { itemCode: "asc" },
        });
        return apiSuccess(data);
      }

      case "company": {
        const data = await prisma.company.findMany({
          where: {
            isActive: true,
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
            estates: {
              where: { isActive: true },
              include: {
                blocks: {
                  where: { isActive: true },
                  orderBy: { blockCode: "asc" },
                },
              },
              orderBy: { code: "asc" },
            },
          },
          orderBy: { code: "asc" },
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
        await prisma.unitOfMeasurement.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "vendor": {
        await prisma.vendor.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "category": {
        await prisma.folderCategory.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "structure": {
        await prisma.structureType.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "variant": {
        await prisma.structureVariant.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "holiday": {
        await prisma.holiday.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      case "item": {
        await prisma.item.delete({ where: { id } });
        return apiSuccess({ deleted: true });
      }

      default:
        return apiError(`Tipe master '${type}' tidak didukung`, 400);
    }
  } catch (error) {
    return handleApiError(error, "Gagal menghapus data master");
  }
}
