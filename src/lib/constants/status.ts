import {
  AfceStatus,
  ApprovalStatus,
  PackageCategory,
  PackageStatus,
  PaymentStatus,
  ProjectStatus,
  StatusIndicator,
} from "@prisma/client";

export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

export const PACKAGE_CATEGORY_CONFIG: Record<PackageCategory, { label: string }> = {
  MATERIAL: { label: "Material" },
  FABRICATION: { label: "Fabrikasi" },
  CONTRACTOR: { label: "Kontraktor" },
  HEAVY_EQUIPMENT: { label: "Alat Berat" },
  SWAKELOLA: { label: "Swakelola" },
};

/**
 * Pemetaan warna dan label semantik ProjectStatus sesuai docs/design.md §2:
 * - DRAFT / SURVEY: slate pudar
 * - RAB_READY: amber pudar
 * - WAITING_AFCE_AR: amber
 * - AFCE_AR_APPROVED: emerald
 * - PROCUREMENT: violet
 * - EXECUTION: sky
 * - WAITING_BAST: blue
 * - COMPLETED: emerald / hijau
 * - ON_HOLD: slate
 * - CANCELLED: merah / rose
 */
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, StatusConfig> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  },
  SURVEY: {
    label: "Survei",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400 dark:bg-slate-500",
  },
  RAB_READY: {
    label: "RAB Siap",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500",
  },
  WAITING_AFCE_AR: {
    label: "Menunggu Approval AR",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500",
  },
  AFCE_AR_APPROVED: {
    label: "AR Disetujui",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  PROCUREMENT: {
    label: "Pengadaan",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900",
    dotClass: "bg-purple-500",
  },
  EXECUTION: {
    label: "Eksekusi Fisik",
    badgeClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200 dark:border-sky-900",
    dotClass: "bg-sky-500",
  },
  WAITING_BAST: {
    label: "Menunggu BAST",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-900",
    dotClass: "bg-blue-500",
  },
  COMPLETED: {
    label: "Selesai",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  ON_HOLD: {
    label: "Ditahan (On Hold)",
    badgeClass: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600",
    dotClass: "bg-slate-500",
  },
  CANCELLED: {
    label: "Dibatalkan",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900",
    dotClass: "bg-rose-500",
  },
};

/**
 * StatusIndicator EWS (Early Warning System) sesuai docs/design.md §2:
 * - ON_TRACK: hijau
 * - AT_RISK: amber
 * - DELAYED: merah
 * - COMPLETED: hijau
 */
export const STATUS_INDICATOR_CONFIG: Record<StatusIndicator, StatusConfig> = {
  ON_TRACK: {
    label: "Sesuai Jadwal",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  AT_RISK: {
    label: "Beresiko Terlambat",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500",
  },
  DELAYED: {
    label: "Terlambat",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900",
    dotClass: "bg-rose-500",
  },
  COMPLETED: {
    label: "Tuntas",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
};

/**
 * PackageStatus untuk WorkPackage
 */
export const PACKAGE_STATUS_CONFIG: Record<PackageStatus, StatusConfig> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
  PR_SUBMITTED: {
    label: "PR Diajukan",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500",
  },
  PO_ISSUED: {
    label: "PO Terbit",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-900",
    dotClass: "bg-purple-500",
  },
  IN_DELIVERY: {
    label: "Dalam Pengiriman",
    badgeClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border-sky-200 dark:border-sky-900",
    dotClass: "bg-sky-500",
  },
  PARTIALLY_DELIVERED: {
    label: "Tiba Sebagian",
    badgeClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900",
    dotClass: "bg-indigo-500",
  },
  DELIVERED: {
    label: "Tiba Lengkap",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Selesai",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Dibatalkan",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900",
    dotClass: "bg-rose-500",
  },
};

/**
 * AfceStatus untuk dokumen AFCE/AR
 */
export const AFCE_STATUS_CONFIG: Record<AfceStatus, StatusConfig> = {
  PENDING: {
    label: "Menunggu Persetujuan",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500",
  },
  APPROVED: {
    label: "Disetujui",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  REJECTED: {
    label: "Ditolak",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900",
    dotClass: "bg-rose-500",
  },
};

/**
 * ApprovalStatus untuk level snapshot paraf
 */
export const APPROVAL_STATUS_CONFIG: Record<ApprovalStatus, StatusConfig> = {
  WAITING: {
    label: "Menunggu Paraf",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500",
  },
  APPROVED: {
    label: "Diparaf",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  REJECTED: {
    label: "Ditolak",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900",
    dotClass: "bg-rose-500",
  },
};

/**
 * PaymentStatus untuk paket pengadaan
 */
export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, StatusConfig> = {
  BELUM_LUNAS: {
    label: "Belum Lunas",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
  DALAM_PROSES: {
    label: "Dalam Proses",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500",
  },
  LUNAS: {
    label: "Lunas",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
};
