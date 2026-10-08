import { AppError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { EquipmentLogInput } from "@/lib/validations/equipment.schema";
import { EquipmentOwnership, Prisma, ProjectStatus } from "@prisma/client";

/**
 * Mengambil daftar seluruh log alat berat pada proyek
 */
export async function listEquipmentLogs(projectId: string) {
  return prisma.heavyEquipmentLog.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    include: {
      workPackage: {
        select: {
          id: true,
          packageName: true,
        },
      },
    },
    orderBy: { logDate: "desc" },
  });
}

/**
 * Membuat log alat berat baru:
 * - hmEnd >= hmStart
 * - hmHours dihitung server: hmEnd - hmStart
 * - Guard B9: Proyek tidak boleh COMPLETED / CANCELLED (409)
 */
export async function createEquipmentLog(
  projectId: string,
  data: EquipmentLogInput,
  actorId: string,
  txClient?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true, deletedAt: true },
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

    if (data.workPackageId) {
      const wp = await tx.workPackage.findFirst({
        where: { id: data.workPackageId, projectId, deletedAt: null },
      });
      if (!wp) {
        throw new AppError("Paket kerja tidak ditemukan pada proyek ini", 404);
      }
    }

    const hasHm =
      data.hmStart !== undefined &&
      data.hmStart !== null &&
      data.hmEnd !== undefined &&
      data.hmEnd !== null;

    if (hasHm && (data.hmEnd as number) < (data.hmStart as number)) {
      throw new AppError("HM Akhir harus lebih besar atau sama dengan HM Awal", 400);
    }

    const hmStart = data.hmStart ?? 0;
    const hmEnd = data.hmEnd ?? 0;
    const hmHours = hasHm
      ? Math.round(((data.hmEnd as number) - (data.hmStart as number)) * 100) / 100
      : 0;
    const logDate = data.logDate ? new Date(data.logDate) : new Date();

    const equipmentLog = await tx.heavyEquipmentLog.create({
      data: {
        projectId,
        workPackageId: data.workPackageId || null,
        logDate,
        unitCode: data.unitCode,
        equipmentType: data.equipmentType,
        ownership: data.ownership || EquipmentOwnership.OWNED,
        hmStart,
        hmEnd,
        hmHours,
        fuelLiters: data.fuelLiters ?? null,
        workVolume: data.workVolume,
        volumeUnit: data.volumeUnit,
        workDescription: data.workDescription || null,
      },
    });

    // Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "HeavyEquipmentLog",
        entityId: equipmentLog.id,
        action: "CREATE",
        diff: {
          unitCode: data.unitCode,
          equipmentType: data.equipmentType,
          hmHours,
        },
      },
    });

    return equipmentLog;
  };

  if (txClient) return runner(txClient);
  return prisma.$transaction(async (tx) => runner(tx));
}

/**
 * Mengubah log alat berat:
 * - hmEnd >= hmStart
 * - hmHours dihitung ulang di server
 * - Guard B9
 */
export async function updateEquipmentLog(
  logId: string,
  data: EquipmentLogInput,
  actorId: string,
  txClient?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const existingLog = await tx.heavyEquipmentLog.findUnique({
      where: { id: logId },
      include: {
        project: { select: { id: true, status: true, deletedAt: true } },
      },
    });

    if (!existingLog || existingLog.deletedAt) {
      throw new AppError("Log alat berat tidak ditemukan", 404);
    }

    if (existingLog.project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (existingLog.project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    if (data.workPackageId) {
      const wp = await tx.workPackage.findFirst({
        where: { id: data.workPackageId, projectId: existingLog.projectId, deletedAt: null },
      });
      if (!wp) {
        throw new AppError("Paket kerja tidak ditemukan pada proyek ini", 404);
      }
    }

    const hasHm =
      data.hmStart !== undefined &&
      data.hmStart !== null &&
      data.hmEnd !== undefined &&
      data.hmEnd !== null;

    if (hasHm && (data.hmEnd as number) < (data.hmStart as number)) {
      throw new AppError("HM Akhir harus lebih besar atau sama dengan HM Awal", 400);
    }

    const hmStart = data.hmStart ?? (hasHm ? 0 : existingLog.hmStart);
    const hmEnd = data.hmEnd ?? (hasHm ? 0 : existingLog.hmEnd);
    const hmHours = hasHm
      ? Math.round(((data.hmEnd as number) - (data.hmStart as number)) * 100) / 100
      : existingLog.hmHours;

    const updatedLog = await tx.heavyEquipmentLog.update({
      where: { id: logId },
      data: {
        workPackageId: data.workPackageId || null,
        logDate: data.logDate ? new Date(data.logDate) : undefined,
        unitCode: data.unitCode,
        equipmentType: data.equipmentType,
        ownership: data.ownership,
        hmStart,
        hmEnd,
        hmHours,
        fuelLiters: data.fuelLiters ?? null,
        workVolume: data.workVolume,
        volumeUnit: data.volumeUnit,
        workDescription: data.workDescription || null,
      },
    });

    // Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "HeavyEquipmentLog",
        entityId: logId,
        action: "UPDATE",
        diff: {
          unitCode: data.unitCode,
          hmHours,
        },
      },
    });

    return updatedLog;
  };

  if (txClient) return runner(txClient);
  return prisma.$transaction(async (tx) => runner(tx));
}

/**
 * Menghapus log alat berat (soft delete B11):
 * - Guard B9
 */
export async function deleteEquipmentLog(
  logId: string,
  actorId: string,
  txClient?: Prisma.TransactionClient
) {
  const runner = async (tx: Prisma.TransactionClient) => {
    const existingLog = await tx.heavyEquipmentLog.findUnique({
      where: { id: logId },
      include: {
        project: { select: { id: true, status: true, deletedAt: true } },
      },
    });

    if (!existingLog || existingLog.deletedAt) {
      throw new AppError("Log alat berat tidak ditemukan", 404);
    }

    if (existingLog.project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (existingLog.project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    await tx.heavyEquipmentLog.update({
      where: { id: logId },
      data: { deletedAt: new Date() },
    });

    // Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "HeavyEquipmentLog",
        entityId: logId,
        action: "DELETE",
        diff: {
          unitCode: existingLog.unitCode,
          hmHours: existingLog.hmHours,
        },
      },
    });

    return { success: true };
  };

  if (txClient) return runner(txClient);
  return prisma.$transaction(async (tx) => runner(tx));
}
