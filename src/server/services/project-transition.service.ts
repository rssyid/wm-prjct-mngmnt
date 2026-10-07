import { AppError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { Prisma, ProjectStatus, Role } from "@prisma/client";

export type ManualTransitionAction =
  | "START_SURVEY"
  | "START_PHYSICAL_WORK"
  | "REQUEST_BAST"
  | "HOLD"
  | "RESUME"
  | "CANCEL";

interface TransitionContext {
  projectId: string;
  actorId: string;
  actorRole: Role;
  action: ManualTransitionAction;
  reason?: string;
  remarks?: string;
  tx?: Prisma.TransactionClient;
}

interface InternalTransitionParams {
  projectId: string;
  actorId: string;
  targetStatus: ProjectStatus;
  actionName: string;
  reason?: string;
  remarks?: string;
  statusBeforeHold?: ProjectStatus | null;
  onHoldReason?: string | null;
  cancellationReason?: string | null;
  tx?: Prisma.TransactionClient;
}

/**
 * Fungsi internal tunggal untuk memvalidasi imutabilitas dan menerapkan perubahan Project.status
 * beserta penulisan AuditLog di dalam transaksi database.
 */
async function applyTransitionInternal(params: InternalTransitionParams) {
  const {
    projectId,
    actorId,
    targetStatus,
    actionName,
    reason,
    remarks,
    statusBeforeHold,
    onHoldReason,
    cancellationReason,
    tx,
  } = params;

  const runner = async (client: Prisma.TransactionClient) => {
    const project = await client.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectCode: true,
        status: true,
        statusBeforeHold: true,
        onHoldReason: true,
        cancellationReason: true,
        deletedAt: true,
      },
    });

    if (!project) {
      throw new AppError("Proyek tidak ditemukan", 404);
    }

    if (project.deletedAt) {
      throw new AppError("Proyek telah dihapus dan tidak dapat diubah", 400);
    }

    // Aturan B9: COMPLETED adalah read-only abadi (409)
    if (project.status === ProjectStatus.COMPLETED) {
      throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
    }

    // Aturan B9 & T10: CANCELLED adalah status final
    if (project.status === ProjectStatus.CANCELLED) {
      throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
    }

    const previousStatus = project.status;

    // Update status proyek
    const updatedProject = await client.project.update({
      where: { id: projectId },
      data: {
        status: targetStatus,
        statusBeforeHold:
          statusBeforeHold !== undefined
            ? statusBeforeHold
            : project.statusBeforeHold,
        onHoldReason:
          onHoldReason !== undefined ? onHoldReason : project.onHoldReason,
        cancellationReason:
          cancellationReason !== undefined
            ? cancellationReason
            : project.cancellationReason,
      },
    });

    // Catat AuditLog
    await client.auditLog.create({
      data: {
        userId: actorId,
        entity: "Project",
        entityId: projectId,
        action: "TRANSITION",
        diff: {
          action: actionName,
          from: previousStatus,
          to: targetStatus,
          reason: reason || undefined,
          remarks: remarks || undefined,
        },
      },
    });

    return updatedProject;
  };

  if (tx) {
    return runner(tx);
  }

  return prisma.$transaction(async (newTx) => {
    return runner(newTx);
  });
}

/**
 * SATU-SATUNYA PINTU untuk eksekusi transisi manual status proyek (T1, T6, T7, T9, T10).
 */
export async function handleManualTransition(ctx: TransitionContext) {
  const { projectId, actorId, actorRole, action, reason, remarks, tx } = ctx;

  const project = await (tx || prisma).project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      statusBeforeHold: true,
      bastDocument: {
        select: { id: true, bastFileUrl: true },
      },
      workPackages: {
        select: { id: true, noPoSpk: true, actualDeliveryDate: true },
        where: { deletedAt: null },
      },
    },
  });

  if (!project) {
    throw new AppError("Proyek tidak ditemukan", 404);
  }

  // Guard Imutabilitas Status Akhir
  if (project.status === ProjectStatus.COMPLETED) {
    throw new AppError("Proyek sudah selesai dan terkunci (read-only)", 409);
  }
  if (project.status === ProjectStatus.CANCELLED) {
    throw new AppError("Proyek telah dibatalkan dan tidak dapat diubah", 409);
  }

  switch (action) {
    case "CANCEL": {
      // T10: Hanya SUPER_ADMIN yang boleh membatalkan
      if (actorRole !== Role.SUPER_ADMIN) {
        throw new AppError("Hanya SUPER_ADMIN yang berhak membatalkan proyek", 403);
      }
      if (!reason || !reason.trim()) {
        throw new AppError("Alasan pembatalan proyek wajib diisi", 400);
      }

      return applyTransitionInternal({
        projectId,
        actorId,
        targetStatus: ProjectStatus.CANCELLED,
        actionName: "CANCEL",
        reason: reason.trim(),
        remarks,
        cancellationReason: reason.trim(),
        tx,
      });
    }

    case "HOLD": {
      // T9: Menahan proyek dari status aktif mana pun (kecuali ON_HOLD/COMPLETED/CANCELLED)
      if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.WM_HO_SPECIALIST) {
        throw new AppError("Anda tidak memiliki hak untuk menahan (HOLD) proyek", 403);
      }
      if (project.status === ProjectStatus.ON_HOLD) {
        throw new AppError("Proyek sudah dalam status ON_HOLD", 409);
      }
      if (!reason || !reason.trim()) {
        throw new AppError("Alasan penahanan (HOLD) proyek wajib diisi", 400);
      }

      return applyTransitionInternal({
        projectId,
        actorId,
        targetStatus: ProjectStatus.ON_HOLD,
        actionName: "HOLD",
        reason: reason.trim(),
        remarks,
        statusBeforeHold: project.status,
        onHoldReason: reason.trim(),
        tx,
      });
    }

    case "RESUME": {
      // T9: Mengembalikan status proyek ke status semula sebelum HOLD
      if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.WM_HO_SPECIALIST) {
        throw new AppError("Anda tidak memiliki hak untuk melanjutkan (RESUME) proyek", 403);
      }
      if (project.status !== ProjectStatus.ON_HOLD) {
        throw new AppError("Proyek tidak sedang dalam status ON_HOLD", 409);
      }
      if (!project.statusBeforeHold) {
        throw new AppError(
          "Data statusSebelumHold tidak ditemukan. Tidak dapat melanjutkan otomatis.",
          409
        );
      }

      return applyTransitionInternal({
        projectId,
        actorId,
        targetStatus: project.statusBeforeHold,
        actionName: "RESUME",
        reason,
        remarks,
        statusBeforeHold: null,
        onHoldReason: null,
        tx,
      });
    }

    case "START_SURVEY": {
      // T1: DRAFT -> SURVEY
      if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.WM_HO_SPECIALIST) {
        throw new AppError("Anda tidak memiliki hak untuk memulai survei", 403);
      }
      if (project.status !== ProjectStatus.DRAFT) {
        throw new AppError(
          `Aksi Mulai Survei hanya diizinkan dari status DRAFT (status saat ini: ${project.status})`,
          409
        );
      }

      return applyTransitionInternal({
        projectId,
        actorId,
        targetStatus: ProjectStatus.SURVEY,
        actionName: "START_SURVEY",
        reason,
        remarks,
        tx,
      });
    }

    case "START_PHYSICAL_WORK": {
      // T6: PROCUREMENT -> EXECUTION
      if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.WM_HO_SPECIALIST) {
        throw new AppError("Anda tidak memiliki hak untuk memulai pekerjaan fisik", 403);
      }
      if (project.status !== ProjectStatus.PROCUREMENT) {
        throw new AppError(
          `Aksi Mulai Pekerjaan Fisik hanya diizinkan dari status PROCUREMENT (status saat ini: ${project.status})`,
          409
        );
      }

      return applyTransitionInternal({
        projectId,
        actorId,
        targetStatus: ProjectStatus.EXECUTION,
        actionName: "START_PHYSICAL_WORK",
        reason,
        remarks,
        tx,
      });
    }

    case "REQUEST_BAST": {
      // T7: EXECUTION -> WAITING_BAST
      if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.WM_HO_SPECIALIST) {
        throw new AppError("Anda tidak memiliki hak untuk mengajukan BAST", 403);
      }
      if (project.status !== ProjectStatus.EXECUTION) {
        throw new AppError(
          `Pengajuan BAST hanya diizinkan dari status EXECUTION (status saat ini: ${project.status})`,
          409
        );
      }

      return applyTransitionInternal({
        projectId,
        actorId,
        targetStatus: ProjectStatus.WAITING_BAST,
        actionName: "REQUEST_BAST",
        reason,
        remarks,
        tx,
      });
    }

    default: {
      const _exhaustiveCheck: never = action;
      throw new AppError(`Aksi transisi tidak dikenal: ${_exhaustiveCheck}`, 400);
    }
  }
}

// -----------------------------------------------------------------------------
// Transisi Otomatis (T2, T3, T4, T5, T8) yang dipanggil oleh domain service lain
// -----------------------------------------------------------------------------

/**
 * T2: SURVEY -> RAB_READY
 * Dipanggil sistem saat AfceDocument.rabReady = true.
 */
export async function onRabReadyTrigger(
  projectId: string,
  actorId: string,
  tx?: Prisma.TransactionClient
) {
  const project = await (tx || prisma).project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  if (!project) throw new AppError("Proyek tidak ditemukan", 404);
  if (project.status !== ProjectStatus.SURVEY) {
    // Jika bukan SURVEY (misal sudah lanjut), tidak diubah
    return;
  }

  return applyTransitionInternal({
    projectId,
    actorId,
    targetStatus: ProjectStatus.RAB_READY,
    actionName: "AUTO_RAB_READY",
    remarks: "Otomatis: dokumen AFCE/RAB telah siap (rabReady = true)",
    tx,
  });
}

/**
 * T3: RAB_READY -> WAITING_AFCE_AR
 * Dipanggil sistem saat AfceDocument.emailSubmitted = true.
 */
export async function onEmailSubmittedTrigger(
  projectId: string,
  actorId: string,
  tx?: Prisma.TransactionClient
) {
  const project = await (tx || prisma).project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  if (!project) throw new AppError("Proyek tidak ditemukan", 404);
  if (project.status !== ProjectStatus.RAB_READY) {
    return;
  }

  return applyTransitionInternal({
    projectId,
    actorId,
    targetStatus: ProjectStatus.WAITING_AFCE_AR,
    actionName: "AUTO_EMAIL_SUBMITTED",
    remarks: "Otomatis: pengajuan AFCE/AR telah dikirim melalui email",
    tx,
  });
}

/**
 * T4: WAITING_AFCE_AR -> AFCE_AR_APPROVED
 * Dipanggil sistem saat semua level persetujuan (ApprovalSnapshot) pada attempt aktif telah APPROVED.
 */
export async function onAfceApprovedTrigger(
  projectId: string,
  actorId: string,
  tx?: Prisma.TransactionClient
) {
  const project = await (tx || prisma).project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  if (!project) throw new AppError("Proyek tidak ditemukan", 404);
  if (project.status !== ProjectStatus.WAITING_AFCE_AR) {
    return;
  }

  return applyTransitionInternal({
    projectId,
    actorId,
    targetStatus: ProjectStatus.AFCE_AR_APPROVED,
    actionName: "AUTO_AFCE_APPROVED",
    remarks: "Otomatis: seluruh level persetujuan AFCE/AR telah disetujui",
    tx,
  });
}

/**
 * T5: AFCE_AR_APPROVED -> PROCUREMENT
 * Dipanggil sistem saat WorkPackage pertama dibuat.
 * Aturan B3: WorkPackage DILARANG dibuat jika AfceDocument belum APPROVED.
 */
export async function onFirstWorkPackageCreatedTrigger(
  projectId: string,
  actorId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: {
      status: true,
      afceDocument: {
        select: { status: true },
      },
    },
  });

  if (!project) throw new AppError("Proyek tidak ditemukan", 404);

  // Aturan B3: WorkPackage tidak boleh dibuat sebelum AfceDocument.status = "APPROVED"
  if (project.afceDocument?.status !== "APPROVED") {
    throw new AppError(
      "Paket kerja tidak dapat dibuat: Dokumen AFCE belum disetujui (status bukan APPROVED)",
      403
    );
  }

  if (project.status !== ProjectStatus.AFCE_AR_APPROVED) {
    return;
  }

  return applyTransitionInternal({
    projectId,
    actorId,
    targetStatus: ProjectStatus.PROCUREMENT,
    actionName: "AUTO_FIRST_WORK_PACKAGE",
    remarks: "Otomatis: paket kerja pengadaan pertama telah dibuat",
    tx,
  });
}

/**
 * T8: WAITING_BAST -> COMPLETED
 * Dipanggil saat verifikasi BAST diverifikasi oleh SUPER_ADMIN.
 * Aturan B8: Pembayaran independen dari BAST (tidak ada syarat LUNAS).
 * Aturan B9: Proyek menjadi read-only.
 */
export async function onBastVerifiedTrigger(
  projectId: string,
  actorId: string,
  actorRole: Role,
  tx?: Prisma.TransactionClient
) {
  if (actorRole !== Role.SUPER_ADMIN) {
    throw new AppError("Hanya SUPER_ADMIN yang berhak memverifikasi BAST proyek", 403);
  }

  const project = await (tx || prisma).project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  if (!project) throw new AppError("Proyek tidak ditemukan", 404);
  if (project.status !== ProjectStatus.WAITING_BAST) {
    throw new AppError(
      `Verifikasi BAST hanya dapat dilakukan saat proyek berstatus WAITING_BAST (status saat ini: ${project.status})`,
      409
    );
  }

  return applyTransitionInternal({
    projectId,
    actorId,
    targetStatus: ProjectStatus.COMPLETED,
    actionName: "AUTO_BAST_VERIFIED",
    remarks: "BAST telah diverifikasi oleh SUPER_ADMIN. Proyek selesai dan terkunci (read-only).",
    tx,
  });
}

/**
 * Dipanggil saat dokumen AFCE/AR ditolak (ada level approval yang REJECTED).
 * Aturan B4: AfceDocument.status = REJECTED, status proyek kembali ke RAB_READY.
 */
export async function onAfceRejectedTrigger(
  projectId: string,
  actorId: string,
  tx?: Prisma.TransactionClient
) {
  const project = await (tx || prisma).project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  if (!project) throw new AppError("Proyek tidak ditemukan", 404);
  if (
    project.status !== ProjectStatus.WAITING_AFCE_AR &&
    project.status !== ProjectStatus.AFCE_AR_APPROVED
  ) {
    return;
  }

  return applyTransitionInternal({
    projectId,
    actorId,
    targetStatus: ProjectStatus.RAB_READY,
    actionName: "AUTO_AFCE_REJECTED",
    remarks: "Otomatis: pengajuan AFCE/AR ditolak, status proyek kembali ke RAB_READY",
    tx,
  });
}

