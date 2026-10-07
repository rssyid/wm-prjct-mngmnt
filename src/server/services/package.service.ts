import { AppError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/redis";
import {
  PackageCreateInput,
  PackageDeliveryInput,
  PackageDocumentInput,
  PackagePaymentInput,
  PackageUpdateInput,
} from "@/lib/validations/package.schema";
import { recalculateProjectProgress } from "@/server/services/progress.service";
import { onFirstWorkPackageCreatedTrigger } from "@/server/services/project-transition.service";
import {
  PackageStatus,
  PaymentStatus,
  Prisma,
  ProjectStatus,
} from "@prisma/client";

/**
 * Helper untuk menghitung hari keterlambatan:
 * Keterlambatan = kiriman terakhir − estDeliveryDate (B7)
 */
export function calculateDeliveryDelayDays(
  actualDate: Date | null | undefined,
  estDate: Date | null | undefined
): number {
  if (!actualDate || !estDate) return 0;
  const actualTime = new Date(actualDate).getTime();
  const estTime = new Date(estDate).getTime();
  const diffDays = Math.ceil((actualTime - estTime) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Mengambil seluruh paket kerja aktif pada proyek dengan data relasi lengkap
 */
export async function listProjectPackages(projectId: string) {
  const packages = await prisma.workPackage.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
    include: {
      vendor: {
        select: { id: true, name: true, contactPerson: true, phone: true },
      },
      items: {
        include: {
          item: {
            select: {
              id: true,
              itemCode: true,
              name: true,
              category: true,
              specification: true,
              standardPrice: true,
              uom: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      deliveries: {
        where: { deletedAt: null },
        orderBy: { deliveryDate: "desc" },
        include: {
          items: {
            include: {
              packageItem: {
                select: {
                  id: true,
                  itemId: true,
                  item: { select: { name: true, itemCode: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return packages.map((pkg) => {
    const totalPlannedQty = pkg.items.reduce(
      (sum, it) => sum + Number(it.qtyPlanned),
      0
    );
    const totalReceivedQty = pkg.items.reduce(
      (sum, it) => sum + Number(it.qtyReceived),
      0
    );

    const deliveryDelayDays = calculateDeliveryDelayDays(
      pkg.actualDeliveryDate,
      pkg.estDeliveryDate
    );

    const isDelayed =
      deliveryDelayDays > 0 ||
      (pkg.estDeliveryDate &&
        !pkg.actualDeliveryDate &&
        new Date().getTime() > new Date(pkg.estDeliveryDate).getTime() &&
        pkg.status !== PackageStatus.DELIVERED &&
        pkg.status !== PackageStatus.COMPLETED);

    return {
      ...pkg,
      totalPlannedQty,
      totalReceivedQty,
      deliveryDelayDays,
      isDelayed: Boolean(isDelayed),
    };
  });
}

/**
 * Mengambil detail satu paket kerja
 */
export async function getPackageById(projectId: string, packageId: string) {
  const pkg = await prisma.workPackage.findFirst({
    where: {
      id: packageId,
      projectId,
      deletedAt: null,
    },
    include: {
      vendor: {
        select: { id: true, name: true, contactPerson: true, phone: true },
      },
      items: {
        include: {
          item: {
            select: {
              id: true,
              itemCode: true,
              name: true,
              category: true,
              specification: true,
              standardPrice: true,
              uom: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      deliveries: {
        where: { deletedAt: null },
        orderBy: { deliveryDate: "desc" },
        include: {
          items: {
            include: {
              packageItem: {
                select: {
                  id: true,
                  itemId: true,
                  item: { select: { name: true, itemCode: true } },
                },
              },
            },
          },
        },
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pkg) {
    throw new AppError("Paket kerja tidak ditemukan atau telah dihapus", 404);
  }

  const totalPlannedQty = pkg.items.reduce(
    (sum, it) => sum + Number(it.qtyPlanned),
    0
  );
  const totalReceivedQty = pkg.items.reduce(
    (sum, it) => sum + Number(it.qtyReceived),
    0
  );
  const deliveryDelayDays = calculateDeliveryDelayDays(
    pkg.actualDeliveryDate,
    pkg.estDeliveryDate
  );

  return {
    ...pkg,
    totalPlannedQty,
    totalReceivedQty,
    deliveryDelayDays,
  };
}

/**
 * Membuat paket kerja baru:
 * - Memeriksa Gerbang B3 (AFCE wajib APPROVED -> 403 jika belum)
 * - Memicu transisi T5 ke PROCUREMENT jika ini paket pertama
 * - Validasi total bobot per proyek <= 100% (400)
 * - Penentuan status awal paket otomatis (PR_SUBMITTED jika noPrUspk terisi, PO_ISSUED jika noPoSpk terisi)
 * - Perhitungan ulang progres proyek tertimbang
 */
export async function createPackage(
  projectId: string,
  input: PackageCreateInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Cek keberadaan proyek dan status
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        afceDocument: { select: { status: true } },
      },
    });

    if (!project || project.deletedAt) {
      throw new AppError("Proyek tidak ditemukan atau telah dihapus", 404);
    }

    // Aturan B9: Proyek COMPLETED read-only
    if (project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }
    if (project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    // 2. Gerbang B3 & Transisi T5
    // onFirstWorkPackageCreatedTrigger memeriksa afceDocument.status === "APPROVED" (403 jika belum)
    // dan mentransisikan proyek AFCE_AR_APPROVED -> PROCUREMENT
    await onFirstWorkPackageCreatedTrigger(projectId, actorId, tx);

    // 3. Validasi bobot total paket per proyek <= 100%
    const existingPackages = await tx.workPackage.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      select: { weightPct: true },
    });

    const currentTotalWeight = existingPackages.reduce(
      (sum, p) => sum + (p.weightPct || 0),
      0
    );
    const newTotalWeight = currentTotalWeight + (input.weightPct || 0);

    if (newTotalWeight > 100.001) {
      throw new AppError(
        `Total bobot paket per proyek tidak boleh melebihi 100% (saat ini ${currentTotalWeight}%, ditambah ${input.weightPct}% = ${newTotalWeight.toFixed(2)}%)`,
        400
      );
    }

    // 4. Status awal paket otomatis
    let initialStatus: PackageStatus = PackageStatus.DRAFT;
    if (input.noPoSpk && input.noPoSpk.trim() !== "") {
      initialStatus = PackageStatus.PO_ISSUED;
    } else if (input.noPrUspk && input.noPrUspk.trim() !== "") {
      initialStatus = PackageStatus.PR_SUBMITTED;
    }

    // 5. Hitung nilai kontrak dari line item jika disediakan
    let finalAmount = input.contractOrPoAmount || 0;
    if (input.items && input.items.length > 0) {
      const calculatedSum = input.items.reduce(
        (acc, item) => acc + item.qtyPlanned * item.unitPrice,
        0
      );
      if (finalAmount === 0 || !finalAmount) {
        finalAmount = calculatedSum;
      }
    }

    // 6. Buat WorkPackage beserta line items
    const created = await tx.workPackage.create({
      data: {
        projectId,
        packageName: input.packageName,
        category: input.category,
        vendorId: input.vendorId || null,
        vendorName: input.vendorName || null,
        picName: input.picName || null,
        weightPct: input.weightPct || 0,
        targetQuantity: input.targetQuantity || null,
        uom: input.uom || null,
        noPrUspk: input.noPrUspk || null,
        prUspkDate: input.prUspkDate || null,
        noPoSpk: input.noPoSpk || null,
        poSpkDate: input.poSpkDate || null,
        contractOrPoAmount: new Prisma.Decimal(finalAmount),
        estDeliveryDate: input.estDeliveryDate || null,
        planStartDate: input.planStartDate || null,
        planEndDate: input.planEndDate || null,
        actualStartDate: input.actualStartDate || null,
        actualEndDate: input.actualEndDate || null,
        paymentStatus: input.paymentStatus || PaymentStatus.BELUM_LUNAS,
        paidAmount:
          input.paidAmount !== null && input.paidAmount !== undefined
            ? new Prisma.Decimal(input.paidAmount)
            : null,
        paidDate: input.paidDate || null,
        remarks: input.remarks || null,
        status: initialStatus,
        createdById: actorId,
        items:
          input.items && input.items.length > 0
            ? {
                create: input.items.map((item) => ({
                  itemId: item.itemId,
                  qtyPlanned: new Prisma.Decimal(item.qtyPlanned),
                  qtyReceived: new Prisma.Decimal(0),
                  unitPrice: new Prisma.Decimal(item.unitPrice),
                  totalPrice: new Prisma.Decimal(
                    item.qtyPlanned * item.unitPrice
                  ),
                })),
              }
            : undefined,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                uom: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });

    // 7. Hitung ulang progres proyek tertimbang
    await recalculateProjectProgress(tx, projectId);

    // 8. Catat AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "WorkPackage",
        entityId: created.id,
        action: "CREATE",
        diff: {
          packageName: created.packageName,
          weightPct: created.weightPct,
          status: created.status,
        },
      },
    });

    return created;
  });

  await invalidateDashboardCache();
  return result;
}

/**
 * Memperbarui paket kerja:
 * - Update nomor PR & PO dengan pembaruan status otomatis (noPrUspk -> PR_SUBMITTED, noPoSpk -> PO_ISSUED)
 * - Sinkronisasi line items dari Master Item
 * - Validasi total bobot <= 100%
 * - Update status dan nominal pembayaran
 */
export async function updatePackage(
  projectId: string,
  packageId: string,
  input: PackageUpdateInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
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

    const currentPackage = await tx.workPackage.findFirst({
      where: { id: packageId, projectId, deletedAt: null },
      include: {
        deliveries: { where: { deletedAt: null } },
      },
    });

    if (!currentPackage) {
      throw new AppError("Paket kerja tidak ditemukan atau telah dihapus", 404);
    }

    // 1. Validasi bobot jika diubah
    if (input.weightPct !== undefined) {
      const otherPackages = await tx.workPackage.findMany({
        where: {
          projectId,
          id: { not: packageId },
          deletedAt: null,
        },
        select: { weightPct: true },
      });

      const otherTotalWeight = otherPackages.reduce(
        (sum, p) => sum + (p.weightPct || 0),
        0
      );
      const newTotalWeight = otherTotalWeight + input.weightPct;

      if (newTotalWeight > 100.001) {
        throw new AppError(
          `Total bobot paket per proyek tidak boleh melebihi 100% (paket lain ${otherTotalWeight}%, bobot baru ${input.weightPct}% = ${newTotalWeight.toFixed(2)}%)`,
          400
        );
      }
    }

    // 2. Evaluasi status otomatis PR -> PO jika belum ada pengiriman
    let nextStatus = currentPackage.status;
    const hasDeliveries = currentPackage.deliveries.length > 0;

    if (!hasDeliveries) {
      const effectiveNoPo =
        input.noPoSpk !== undefined ? input.noPoSpk : currentPackage.noPoSpk;
      const effectiveNoPr =
        input.noPrUspk !== undefined ? input.noPrUspk : currentPackage.noPrUspk;

      if (effectiveNoPo && effectiveNoPo.trim() !== "") {
        nextStatus = PackageStatus.PO_ISSUED;
      } else if (effectiveNoPr && effectiveNoPr.trim() !== "") {
        nextStatus = PackageStatus.PR_SUBMITTED;
      } else if (
        currentPackage.status === PackageStatus.PR_SUBMITTED ||
        currentPackage.status === PackageStatus.PO_ISSUED
      ) {
        nextStatus = PackageStatus.DRAFT;
      }
    }

    // 3. Sinkronisasi line items jika diberikan
    let calculatedAmount = input.contractOrPoAmount;
    if (input.items !== undefined) {
      // Hapus line items yang lama dan buat yang baru
      await tx.packageItem.deleteMany({
        where: { workPackageId: packageId },
      });

      if (input.items.length > 0) {
        await tx.packageItem.createMany({
          data: input.items.map((item) => ({
            workPackageId: packageId,
            itemId: item.itemId,
            qtyPlanned: new Prisma.Decimal(item.qtyPlanned),
            qtyReceived: new Prisma.Decimal(0),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            totalPrice: new Prisma.Decimal(item.qtyPlanned * item.unitPrice),
          })),
        });

        const sumPrice = input.items.reduce(
          (acc, item) => acc + item.qtyPlanned * item.unitPrice,
          0
        );
        if (calculatedAmount === undefined || calculatedAmount === 0) {
          calculatedAmount = sumPrice;
        }
      }
    }

    // 4. Update WorkPackage
    const updated = await tx.workPackage.update({
      where: { id: packageId },
      data: {
        packageName: input.packageName,
        category: input.category,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        picName: input.picName,
        weightPct: input.weightPct,
        targetQuantity: input.targetQuantity,
        uom: input.uom,
        noPrUspk: input.noPrUspk,
        prUspkDate: input.prUspkDate,
        noPoSpk: input.noPoSpk,
        poSpkDate: input.poSpkDate,
        contractOrPoAmount:
          calculatedAmount !== undefined
            ? new Prisma.Decimal(calculatedAmount)
            : undefined,
        estDeliveryDate: input.estDeliveryDate,
        planStartDate: input.planStartDate,
        planEndDate: input.planEndDate,
        actualStartDate: input.actualStartDate,
        actualEndDate: input.actualEndDate,
        paymentStatus: input.paymentStatus,
        paidAmount:
          input.paidAmount !== undefined
            ? input.paidAmount !== null
              ? new Prisma.Decimal(input.paidAmount)
              : null
            : undefined,
        paidDate: input.paidDate,
        remarks: input.remarks,
        status: nextStatus,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                uom: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });

    // 5. Hitung ulang progres proyek jika bobot berubah
    if (
      input.weightPct !== undefined &&
      input.weightPct !== currentPackage.weightPct
    ) {
      await recalculateProjectProgress(tx, projectId);
    }

    // 6. AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "WorkPackage",
        entityId: packageId,
        action: "UPDATE",
        diff: {
          packageName: updated.packageName,
          status: updated.status,
          weightPct: updated.weightPct,
          paymentStatus: updated.paymentStatus,
        },
      },
    });

    return updated;
  });

  await invalidateDashboardCache();
  return result;
}

/**
 * Soft delete paket kerja (mengisi deletedAt) dan menghitung ulang progres proyek
 */
export async function deletePackage(
  projectId: string,
  packageId: string,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
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

    const currentPackage = await tx.workPackage.findFirst({
      where: { id: packageId, projectId, deletedAt: null },
    });

    if (!currentPackage) {
      throw new AppError("Paket kerja tidak ditemukan atau telah dihapus", 404);
    }

    // Soft delete paket dan relasi deliveries
    const now = new Date();
    await tx.workPackage.update({
      where: { id: packageId },
      data: { deletedAt: now },
    });

    await tx.packageDelivery.updateMany({
      where: { workPackageId: packageId, deletedAt: null },
      data: { deletedAt: now },
    });

    // Hitung ulang progres proyek
    await recalculateProjectProgress(tx, projectId);

    // AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "WorkPackage",
        entityId: packageId,
        action: "DELETE",
        diff: { packageName: currentPackage.packageName },
      },
    });

    return { id: packageId, deleted: true };
  });

  await invalidateDashboardCache();
  return result;
}

/**
 * Update pembayaran paket saja (form kecil di detail paket)
 */
export async function updatePackagePayment(
  projectId: string,
  packageId: string,
  input: PackagePaymentInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
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

    const updated = await tx.workPackage.update({
      where: { id: packageId },
      data: {
        paymentStatus: input.paymentStatus,
        paidAmount: new Prisma.Decimal(input.paidAmount),
        paidDate: input.paidDate || null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "WorkPackage",
        entityId: packageId,
        action: "UPDATE",
        diff: {
          paymentStatus: input.paymentStatus,
          paidAmount: input.paidAmount,
          paidDate: input.paidDate,
        },
      },
    });

    return updated;
  });

  await invalidateDashboardCache();
  return result;
}

/**
 * Mencatat pengiriman barang kedatangan (B7 kedatangan berulang):
 * - Menyimpan PackageDelivery dan PackageDeliveryItem
 * - Akumulasi PackageItem.qtyReceived
 * - Cache actualDeliveryDate = max(deliveryDate)
 * - Hitung hari keterlambatan: actualDeliveryDate - estDeliveryDate
 * - Evaluasi status paket: IN_DELIVERY / PARTIALLY_DELIVERED / DELIVERED
 */
export async function recordPackageDelivery(
  projectId: string,
  packageId: string,
  input: PackageDeliveryInput,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Cek proyek
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

    // 2. Cek paket kerja
    const pkg = await tx.workPackage.findFirst({
      where: { id: packageId, projectId, deletedAt: null },
      include: {
        items: true,
      },
    });

    if (!pkg) {
      throw new AppError("Paket kerja tidak ditemukan atau telah dihapus", 404);
    }

    // 3. Buat PackageDelivery
    const delivery = await tx.packageDelivery.create({
      data: {
        workPackageId: packageId,
        deliveryDate: input.deliveryDate,
        deliveryOrderNo: input.deliveryOrderNo || null,
        notes: input.notes || null,
      },
    });

    // 4. Buat PackageDeliveryItem
    for (const item of input.items) {
      await tx.packageDeliveryItem.create({
        data: {
          packageDeliveryId: delivery.id,
          packageItemId: item.packageItemId,
          qtyReceived: new Prisma.Decimal(item.qtyReceived),
        },
      });
    }

    // 5. Akumulasi ulang qtyReceived untuk seluruh PackageItem pada paket ini
    const allDeliveryItems = await tx.packageDeliveryItem.findMany({
      where: {
        packageDelivery: {
          workPackageId: packageId,
          deletedAt: null,
        },
      },
      select: {
        packageItemId: true,
        qtyReceived: true,
      },
    });

    const receivedMap: Record<string, number> = {};
    for (const di of allDeliveryItems) {
      receivedMap[di.packageItemId] =
        (receivedMap[di.packageItemId] || 0) + Number(di.qtyReceived);
    }

    for (const pi of pkg.items) {
      const totalRec = receivedMap[pi.id] || 0;
      await tx.packageItem.update({
        where: { id: pi.id },
        data: { qtyReceived: new Prisma.Decimal(totalRec) },
      });
    }

    // 6. Tentukan actualDeliveryDate = tanggal kiriman TERAKHIR
    const latestDelivery = await tx.packageDelivery.findFirst({
      where: { workPackageId: packageId, deletedAt: null },
      orderBy: { deliveryDate: "desc" },
      select: { deliveryDate: true },
    });

    const actualDeliveryDate = latestDelivery?.deliveryDate || input.deliveryDate;

    // 7. Hitung keterlambatan (hari)
    const deliveryDelayDays = calculateDeliveryDelayDays(
      actualDeliveryDate,
      pkg.estDeliveryDate
    );

    // 8. Tentukan status paket (B7)
    // - Jika override manual dicentang (wajib remarks): status DELIVERED
    // - Jika sum(received) >= sum(planned): status DELIVERED
    // - Jika sum(received) > 0: status PARTIALLY_DELIVERED
    // - Jika belum ada: status IN_DELIVERY
    const totalPlanned = pkg.items.reduce(
      (sum, it) => sum + Number(it.qtyPlanned),
      0
    );
    const totalReceived = Object.values(receivedMap).reduce(
      (sum, val) => sum + val,
      0
    );

    let nextPackageStatus: PackageStatus;

    if (input.manualDeliveredOverride) {
      nextPackageStatus = PackageStatus.DELIVERED;
    } else if (totalPlanned > 0 && totalReceived >= totalPlanned) {
      nextPackageStatus = PackageStatus.DELIVERED;
    } else if (totalReceived > 0) {
      nextPackageStatus = PackageStatus.PARTIALLY_DELIVERED;
    } else {
      nextPackageStatus = PackageStatus.IN_DELIVERY;
    }

    // 9. Update WorkPackage
    const updatedPkg = await tx.workPackage.update({
      where: { id: packageId },
      data: {
        actualDeliveryDate,
        status: nextPackageStatus,
        remarks:
          input.remarks !== undefined && input.remarks !== null
            ? input.remarks
            : pkg.remarks,
      },
      include: {
        items: {
          include: {
            item: {
              select: {
                id: true,
                itemCode: true,
                name: true,
                uom: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });

    // 10. AuditLog
    await tx.auditLog.create({
      data: {
        userId: actorId,
        entity: "PackageDelivery",
        entityId: delivery.id,
        action: "CREATE",
        diff: {
          deliveryOrderNo: input.deliveryOrderNo,
          deliveryDate: input.deliveryDate,
          packageStatus: nextPackageStatus,
          deliveryDelayDays,
          manualDeliveredOverride: input.manualDeliveredOverride,
        },
      },
    });

    return {
      delivery,
      package: updatedPkg,
      deliveryDelayDays,
    };
  });

  await invalidateDashboardCache();
  return result;
}

/**
 * Mengambil daftar pengiriman untuk paket tertentu
 */
export async function listPackageDeliveries(
  projectId: string,
  packageId: string
) {
  const deliveries = await prisma.packageDelivery.findMany({
    where: {
      workPackageId: packageId,
      workPackage: { projectId, deletedAt: null },
      deletedAt: null,
    },
    include: {
      items: {
        include: {
          packageItem: {
            include: {
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  uom: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { deliveryDate: "desc" },
  });

  return deliveries;
}

/**
 * Mengambil daftar berkas dokumen untuk paket tertentu (PR, PO, DO, Invoice, etc)
 */
export async function listPackageDocuments(workPackageId: string) {
  return prisma.packageDocument.findMany({
    where: {
      workPackageId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Menambahkan dokumen baru ke paket kerja
 */
export async function createPackageDocument(
  workPackageId: string,
  data: PackageDocumentInput,
  userId: string
) {
  const pkg = await prisma.workPackage.findUnique({
    where: { id: workPackageId, deletedAt: null },
    include: { project: { select: { id: true, status: true } } },
  });

  if (!pkg) {
    throw new AppError("Paket kerja tidak ditemukan atau telah dihapus", 404);
  }

  if (pkg.project.status === ProjectStatus.COMPLETED) {
    throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
  }
  if (pkg.project.status === ProjectStatus.CANCELLED) {
    throw new AppError("Proyek telah dibatalkan", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const doc = await tx.packageDocument.create({
      data: {
        workPackageId,
        docType: data.docType,
        docNumber: data.docNumber || null,
        docDate: data.docDate ? new Date(data.docDate) : null,
        fileUrl: data.fileUrl,
        notes: data.notes || null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        entity: "PackageDocument",
        entityId: doc.id,
        action: "CREATE",
        diff: {
          workPackageId,
          docType: doc.docType,
          docNumber: doc.docNumber,
          fileUrl: doc.fileUrl,
        },
      },
    });

    return doc;
  });

  await invalidateDashboardCache();
  return result;
}

/**
 * Soft delete dokumen paket kerja
 */
export async function deletePackageDocument(
  packageDocId: string,
  userId: string
) {
  const doc = await prisma.packageDocument.findUnique({
    where: { id: packageDocId, deletedAt: null },
    include: {
      workPackage: {
        include: { project: { select: { id: true, status: true } } },
      },
    },
  });

  if (!doc) {
    throw new AppError("Dokumen tidak ditemukan atau sudah dihapus", 404);
  }

  if (doc.workPackage.project.status === ProjectStatus.COMPLETED) {
    throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
  }
  if (doc.workPackage.project.status === ProjectStatus.CANCELLED) {
    throw new AppError("Proyek telah dibatalkan", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.packageDocument.update({
      where: { id: packageDocId },
      data: { deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId,
        entity: "PackageDocument",
        entityId: packageDocId,
        action: "DELETE",
        diff: {
          workPackageId: doc.workPackageId,
          deletedAt: updated.deletedAt?.toISOString(),
        },
      },
    });

    return updated;
  });

  await invalidateDashboardCache();
  return result;
}

