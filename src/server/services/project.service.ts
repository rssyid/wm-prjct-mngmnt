import { AppError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { calculateProjectSla } from "@/lib/sla";
import {
  BudgetType,
  LocationType,
  Prisma,
  ProjectStatus,
  StatusIndicator,
} from "@prisma/client";

export interface CreateProjectInput {
  projectName: string;
  displayName: string;
  folderCategoryId: string;
  structureTypeId: string;
  companyId: string;
  estateId: string;
  structureVariantId?: string | null;
  blockId?: string | null;
  picId?: string | null;
  picName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geoCoordinates?: Prisma.InputJsonValue | null;
  locationType?: LocationType;
  budgetType?: BudgetType;
  totalBudgetAmount?: number | string | Prisma.Decimal;
  targetQuantity?: number | null;
  uom?: string | null;
  targetStartDate?: Date | string | null;
  targetEndDate?: Date | string | null;
  constructionPlanStartDate?: Date | string | null;
  constructionPlanEndDate?: Date | string | null;
  boqItems?: Prisma.InputJsonValue | null;
  year?: number;
}

/**
 * Menghasilkan kode proyek abadi sesuai aturan B10:
 * Format: WM-{COMPANY_CODE}-{YYYY}-{SEQ4} (misal: WM-CMP01-2026-0001)
 * Wajib dijalankan di dalam Prisma Transaction dengan upsert & increment atomik.
 */
export async function generateProjectCode(
  tx: Prisma.TransactionClient,
  companyId: string,
  year: number
): Promise<string> {
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { code: true },
  });

  if (!company) {
    throw new AppError("Perusahaan tidak ditemukan untuk pembuatan kode proyek", 404);
  }

  // Atomic upsert + increment pada tabel ProjectCodeCounter
  const counter = await tx.projectCodeCounter.upsert({
    where: {
      companyId_year: {
        companyId,
        year,
      },
    },
    create: {
      companyId,
      year,
      lastSeq: 1,
    },
    update: {
      lastSeq: {
        increment: 1,
      },
    },
  });

  const seqStr = String(counter.lastSeq).padStart(4, "0");
  return `WM-${company.code.toUpperCase()}-${year}-${seqStr}`;
}

/**
 * Membuat Project baru di dalam transaksi database:
 * 1. Menghasilkan kode proyek otomatis (B10).
 * 2. Menyimpan Project dengan status awal DRAFT.
 * 3. Menulis AuditLog penciptaan (CREATE).
 */
export async function createProject(
  data: CreateProjectInput,
  actorId: string,
  txClient?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const year = data.year || new Date().getFullYear();
    const projectCode = await generateProjectCode(tx, data.companyId, year);

    const holidays = await tx.holiday.findMany({
      select: { holidayDate: true },
    });

    const initialSla = calculateProjectSla({
      status: ProjectStatus.DRAFT,
      currentIndicator: StatusIndicator.ON_TRACK,
      progressPct: 0,
      targetStartDate: data.targetStartDate,
      targetEndDate: data.targetEndDate,
      holidays: holidays.map((h) => h.holidayDate),
      asOfDate: new Date(),
    });

    const project = await tx.project.create({
      data: {
        projectCode,
        projectName: data.projectName,
        displayName: data.displayName,
        folderCategoryId: data.folderCategoryId,
        structureTypeId: data.structureTypeId,
        companyId: data.companyId,
        estateId: data.estateId,
        structureVariantId: data.structureVariantId || null,
        blockId: data.blockId || null,
        picId: data.picId || null,
        picName: data.picName || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        geoCoordinates: data.geoCoordinates || Prisma.JsonNull,
        locationType: data.locationType || LocationType.POINT,
        budgetType: data.budgetType || BudgetType.CAPEX_BUDGETED,
        totalBudgetAmount: data.totalBudgetAmount
          ? new Prisma.Decimal(data.totalBudgetAmount)
          : new Prisma.Decimal(0),
        targetQuantity: data.targetQuantity || null,
        uom: data.uom || null,
        targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
        targetEndDate: data.targetEndDate ? new Date(data.targetEndDate) : null,
        constructionPlanStartDate: data.constructionPlanStartDate
          ? new Date(data.constructionPlanStartDate)
          : null,
        constructionPlanEndDate: data.constructionPlanEndDate
          ? new Date(data.constructionPlanEndDate)
          : null,
        boqItems: data.boqItems ? (data.boqItems as Prisma.InputJsonValue) : Prisma.JsonNull,
        progressPct: 0,
        status: ProjectStatus.DRAFT,
        statusIndicator: initialSla.indicator,
        createdById: actorId,
      },
      include: {
        company: { select: { id: true, code: true, name: true } },
        estate: { select: { id: true, code: true, name: true } },
        folderCategory: { select: { id: true, code: true, name: true } },
        structureType: { select: { id: true, name: true } },
      },
    });

    // Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "Project",
        entityId: project.id,
        action: "CREATE",
        diff: {
          projectCode: project.projectCode,
          projectName: project.projectName,
          companyId: project.companyId,
          totalBudgetAmount: project.totalBudgetAmount.toString(),
        },
      },
    });

    return project;
  };

  if (txClient) {
    return runner(txClient);
  }

  return prisma.$transaction(async (tx) => {
    return runner(tx);
  });
}
