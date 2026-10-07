import { AppError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/redis";
import { calculateProjectSla } from "@/lib/sla";
import { Prisma, ProjectStatus } from "@prisma/client";

/**
 * Menghitung minggu berjalan proyek:
 * Berdasarkan selisih hari antara hari ini dengan constructionPlanStartDate (atau targetStartDate / createdAt).
 * Minggu 1 = hari ke 0-6 setelah tanggal acuan.
 */
export function getProjectCurrentWeek(
  project: {
    constructionPlanStartDate?: Date | string | null;
    targetStartDate?: Date | string | null;
    createdAt: Date | string;
  },
  referenceDate: Date = new Date()
): number {
  const startDateRaw =
    project.constructionPlanStartDate ??
    project.targetStartDate ??
    project.createdAt;

  const startDate = new Date(startDateRaw);
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const diffMs = ref.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Menghitung ulang agregasi progres proyek tertimbang:
 * Progres Proyek = Σ (wp.progressPct × wp.weightPct / 100)
 * Wajib dieksekusi di dalam transaksi database setiap kali terjadi mutasi
 * pada WorkPackage (bobot/progres) atau ProgressLog.
 * Sekaligus menyinkronkan statusIndicator EWS melalui calculateProjectSla (Aturan SLA tunggal).
 */
export async function recalculateProjectProgress(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<number> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      statusIndicator: true,
      targetStartDate: true,
      targetEndDate: true,
      deletedAt: true,
    },
  });

  if (!project) {
    throw new AppError("Proyek tidak ditemukan", 404);
  }

  if (project.deletedAt) {
    throw new AppError("Proyek telah dihapus", 400);
  }

  // Aturan B9: Proyek COMPLETED read-only
  if (project.status === ProjectStatus.COMPLETED) {
    throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
  }

  // Ambil semua paket kerja yang aktif (tidak terhapus)
  const workPackages = await tx.workPackage.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      progressPct: true,
      weightPct: true,
    },
  });

  // Hitung total progres tertimbang
  let totalProgress = 0;
  for (const wp of workPackages) {
    const wpProgress = wp.progressPct || 0;
    const wpWeight = wp.weightPct || 0;
    totalProgress += (wpProgress * wpWeight) / 100;
  }

  // Pembulatan 2 desimal dan batasi rentang 0–100
  const normalizedProgress = Math.min(100, Math.max(0, Math.round(totalProgress * 100) / 100));

  // Ambil hari libur untuk kalkulasi SLA terpusat
  const holidays = await tx.holiday.findMany({
    select: { holidayDate: true },
  });

  const slaResult = calculateProjectSla({
    status: project.status,
    currentIndicator: project.statusIndicator,
    progressPct: normalizedProgress,
    targetStartDate: project.targetStartDate,
    targetEndDate: project.targetEndDate,
    holidays: holidays.map((h) => h.holidayDate),
    asOfDate: new Date(),
  });

  await tx.project.update({
    where: { id: projectId },
    data: {
      progressPct: normalizedProgress,
      statusIndicator: slaResult.indicator,
    },
  });

  return normalizedProgress;
}

export interface CreateProgressLogInput {
  projectId: string;
  workPackageId: string;
  logDate?: Date | string;
  weekNo: number;
  progressPct: number;
  volumeAchieved?: number | null;
  volumeUnit?: string | null;
  workDescription?: string | null;
  weatherCondition?: string | null;
  waterLevelCm?: number | null;
  photos?: string[];
}

/**
 * Mencatat log progres mingguan baru (aturan B6):
 * 1. Menolak jika proyek COMPLETED (B9).
 * 2. Menolak jika sudah ada log untuk workPackageId & weekNo yang sama (409).
 * 3. Memperbarui progressPct pada paket kerja.
 * 4. Menghitung ulang progressPct proyek secara atomik di transaksi.
 */
export async function createProgressLog(
  data: CreateProgressLogInput,
  actorId: string,
  txClient?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: data.projectId },
      select: {
        status: true,
        deletedAt: true,
        constructionPlanStartDate: true,
        targetStartDate: true,
        createdAt: true,
      },
    });

    if (!project || project.deletedAt) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    if (project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    const workPackage = await tx.workPackage.findFirst({
      where: {
        id: data.workPackageId,
        projectId: data.projectId,
        deletedAt: null,
      },
    });

    if (!workPackage) {
      throw new AppError("Paket kerja tidak ditemukan pada proyek ini", 404);
    }

    // Aturan B6: 1 log per paket per minggu
    const existingLog = await tx.progressLog.findUnique({
      where: {
        workPackageId_weekNo: {
          workPackageId: data.workPackageId,
          weekNo: data.weekNo,
        },
      },
    });

    if (existingLog) {
      throw new AppError(
        `Log progres untuk paket kerja ini pada minggu ke-${data.weekNo} sudah pernah diisi.`,
        409
      );
    }

    const logDate = data.logDate ? new Date(data.logDate) : new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (logDate > todayEnd) {
      throw new AppError("Tanggal log tidak boleh di masa depan", 400);
    }

    const progressLog = await tx.progressLog.create({
      data: {
        projectId: data.projectId,
        workPackageId: data.workPackageId,
        logDate,
        weekNo: data.weekNo,
        progressPct: data.progressPct,
        volumeAchieved: data.volumeAchieved || null,
        volumeUnit: data.volumeUnit || null,
        workDescription: data.workDescription || null,
        weatherCondition: data.weatherCondition || null,
        waterLevelCm: data.waterLevelCm || null,
        photos: data.photos && data.photos.length > 0 ? data.photos : Prisma.JsonNull,
        createdById: actorId,
      },
    });

    // Update progressPct paket kerja ke progres terbaru (berdasarkan weekNo tertinggi)
    const latestLog = await tx.progressLog.findFirst({
      where: {
        workPackageId: data.workPackageId,
        deletedAt: null,
      },
      orderBy: { weekNo: "desc" },
    });

    if (latestLog) {
      await tx.workPackage.update({
        where: { id: data.workPackageId },
        data: {
          progressPct: latestLog.progressPct,
          volumeAchieved: latestLog.volumeAchieved || workPackage.volumeAchieved,
        },
      });
    }

    // Hitung ulang progres tertimbang proyek
    await recalculateProjectProgress(tx, data.projectId);

    // Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "ProgressLog",
        entityId: progressLog.id,
        action: "CREATE",
        diff: {
          workPackageId: data.workPackageId,
          weekNo: data.weekNo,
          progressPct: data.progressPct,
        },
      },
    });

    return progressLog;
  };

  let result;
  if (txClient) {
    result = await runner(txClient);
  } else {
    result = await prisma.$transaction(async (tx) => {
      return runner(tx);
    });
  }

  await invalidateDashboardCache();
  return result;
}

export interface UpdateProgressLogInput {
  logDate?: Date | string;
  progressPct: number;
  volumeAchieved?: number | null;
  volumeUnit?: string | null;
  workDescription?: string | null;
  weatherCondition?: string | null;
  waterLevelCm?: number | null;
  photos?: string[];
}

/**
 * Mengubah log progres mingguan (aturan B6):
 * Hanya log pada minggu berjalan (weekNo == getProjectCurrentWeek) yang boleh diubah.
 * Log minggu lampau menghasilkan 409.
 */
export async function updateProgressLog(
  logId: string,
  data: UpdateProgressLogInput,
  actorId: string,
  txClient?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const existingLog = await tx.progressLog.findUnique({
      where: { id: logId },
      include: {
        project: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
            constructionPlanStartDate: true,
            targetStartDate: true,
            createdAt: true,
          },
        },
      },
    });

    if (!existingLog || existingLog.deletedAt) {
      throw new AppError("Log progres tidak ditemukan", 404);
    }

    if (existingLog.project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (existingLog.project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    // Aturan B6: hanya minggu berjalan yang boleh diubah
    const currentWeek = getProjectCurrentWeek(existingLog.project);
    if (existingLog.weekNo !== currentWeek) {
      throw new AppError(
        `Hanya log progres pada minggu berjalan (Minggu ke-${currentWeek}) yang dapat diubah. Log minggu ke-${existingLog.weekNo} bersifat read-only.`,
        409
      );
    }

    if (data.logDate) {
      const logDate = new Date(data.logDate);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      if (logDate > todayEnd) {
        throw new AppError("Tanggal log tidak boleh di masa depan", 400);
      }
    }

    const updatedLog = await tx.progressLog.update({
      where: { id: logId },
      data: {
        logDate: data.logDate ? new Date(data.logDate) : undefined,
        progressPct: data.progressPct,
        volumeAchieved: data.volumeAchieved !== undefined ? data.volumeAchieved : undefined,
        volumeUnit: data.volumeUnit !== undefined ? data.volumeUnit : undefined,
        workDescription: data.workDescription !== undefined ? data.workDescription : undefined,
        weatherCondition: data.weatherCondition !== undefined ? data.weatherCondition : undefined,
        waterLevelCm: data.waterLevelCm !== undefined ? data.waterLevelCm : undefined,
        photos: data.photos && data.photos.length > 0 ? data.photos : Prisma.JsonNull,
      },
    });

    // Ambil log dengan weekNo tertinggi untuk paket kerja tersebut
    const latestLog = await tx.progressLog.findFirst({
      where: {
        workPackageId: existingLog.workPackageId,
        deletedAt: null,
      },
      orderBy: { weekNo: "desc" },
    });

    if (latestLog) {
      await tx.workPackage.update({
        where: { id: existingLog.workPackageId },
        data: {
          progressPct: latestLog.progressPct,
          volumeAchieved: latestLog.volumeAchieved,
        },
      });
    }

    // Hitung ulang progres proyek tertimbang
    await recalculateProjectProgress(tx, existingLog.projectId);

    // AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "ProgressLog",
        entityId: logId,
        action: "UPDATE",
        diff: {
          weekNo: existingLog.weekNo,
          workPackageId: existingLog.workPackageId,
          oldProgressPct: existingLog.progressPct,
          newProgressPct: data.progressPct,
        },
      },
    });

    return updatedLog;
  };

  let result;
  if (txClient) {
    result = await runner(txClient);
  } else {
    result = await prisma.$transaction(async (tx) => {
      return runner(tx);
    });
  }

  await invalidateDashboardCache();
  return result;
}

/**
 * Menghapus log progres mingguan (aturan B6: koreksi minggu berjalan).
 * Log minggu lampau menghasilkan 409.
 */
export async function deleteProgressLog(
  logId: string,
  actorId: string,
  txClient?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const log = await tx.progressLog.findUnique({
      where: { id: logId },
      include: {
        project: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
            constructionPlanStartDate: true,
            targetStartDate: true,
            createdAt: true,
          },
        },
      },
    });

    if (!log) {
      throw new AppError("Log progres tidak ditemukan", 404);
    }

    if (log.project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (log.project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    // Aturan B6: hanya minggu berjalan yang boleh dihapus
    const currentWeek = getProjectCurrentWeek(log.project);
    if (log.weekNo !== currentWeek) {
      throw new AppError(
        `Hanya log progres pada minggu berjalan (Minggu ke-${currentWeek}) yang dapat dihapus. Log minggu ke-${log.weekNo} bersifat read-only.`,
        409
      );
    }

    // Hapus log
    await tx.progressLog.delete({
      where: { id: logId },
    });

    // Cari log progres terakhir untuk paket kerja tersebut
    const latestRemainingLog = await tx.progressLog.findFirst({
      where: {
        workPackageId: log.workPackageId,
        deletedAt: null,
      },
      orderBy: { weekNo: "desc" },
    });

    const newWpProgress = latestRemainingLog ? latestRemainingLog.progressPct : 0;
    const newWpVolume = latestRemainingLog ? latestRemainingLog.volumeAchieved : null;

    await tx.workPackage.update({
      where: { id: log.workPackageId },
      data: {
        progressPct: newWpProgress,
        volumeAchieved: newWpVolume,
      },
    });

    // Hitung ulang progres proyek
    await recalculateProjectProgress(tx, log.projectId);

    // Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "ProgressLog",
        entityId: logId,
        action: "DELETE",
        diff: {
          deletedWeekNo: log.weekNo,
          workPackageId: log.workPackageId,
        },
      },
    });

    return { success: true };
  };

  let result;
  if (txClient) {
    result = await runner(txClient);
  } else {
    result = await prisma.$transaction(async (tx) => {
      return runner(tx);
    });
  }

  await invalidateDashboardCache();
  return result;
}

/**
 * Mengambil daftar seluruh log progres pada suatu proyek
 */
export async function listProgressLogs(projectId: string) {
  return prisma.progressLog.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    include: {
      workPackage: {
        select: {
          id: true,
          packageName: true,
          category: true,
          weightPct: true,
          progressPct: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ weekNo: "desc" }, { logDate: "desc" }],
  });
}
