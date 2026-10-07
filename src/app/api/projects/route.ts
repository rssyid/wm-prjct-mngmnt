import { apiSuccess, handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import {
  projectInputSchema,
  projectQuerySchema,
} from "@/lib/validations/project.schema";
import { requireRole, requireSession } from "@/server/auth-guard";
import { createProject } from "@/server/services/project.service";
import { Prisma, Role } from "@prisma/client";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects
 * Paginasi server-side, pencarian dengan debounce, filter status, statusIndicator, companyId, sort.
 * WAJIB filter deletedAt: null dan select seperlunya.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSession(); // Seluruh user terautentikasi dapat melihat daftar proyek

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = projectQuerySchema.parse(searchParams);

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.statusIndicator ? { statusIndicator: query.statusIndicator } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
    };

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { projectName: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { projectCode: { contains: search, mode: "insensitive" } },
      ];
    }

    // Penentuan sorting
    let orderBy: Prisma.ProjectOrderByWithRelationInput = { updatedAt: "desc" };
    if (query.sort) {
      const isDesc = query.sort.startsWith("-");
      const field = isDesc ? query.sort.substring(1) : query.sort;
      if (
        [
          "updatedAt",
          "createdAt",
          "projectName",
          "projectCode",
          "progressPct",
          "totalBudgetAmount",
        ].includes(field)
      ) {
        orderBy = { [field]: isDesc ? "desc" : "asc" };
      }
    }

    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          displayName: true,
          status: true,
          statusIndicator: true,
          progressPct: true,
          totalBudgetAmount: true,
          budgetType: true,
          targetStartDate: true,
          targetEndDate: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { id: true, code: true, name: true } },
          estate: { select: { id: true, code: true, name: true } },
          folderCategory: { select: { id: true, code: true, name: true } },
          structureType: { select: { id: true, name: true } },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.project.count({ where }),
    ]);

    const totalPages = Math.ceil(total / query.pageSize);

    return apiSuccess(projects, {
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
    });
  } catch (error) {
    return handleApiError(error, "Gagal mengambil daftar proyek");
  }
}

/**
 * POST /api/projects
 * Membuat proyek baru:
 * - Otorisasi: SUPER_ADMIN, WM_HO_SPECIALIST
 * - Validasi Zod (projectInputSchema)
 * - Kode unik otomatis abadi dari ProjectCodeCounter dalam transaksi
 * - Status awal DRAFT
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

    const body = await request.json();
    const validatedData = projectInputSchema.parse(body);

    const project = await createProject(validatedData, session.user.id);

    return apiSuccess(project, undefined, 201);
  } catch (error) {
    return handleApiError(error, "Gagal membuat proyek baru");
  }
}
