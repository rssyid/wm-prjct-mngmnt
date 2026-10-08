import {
  PACKAGE_CATEGORY_CONFIG,
  PACKAGE_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
  normalizeApprovalRoleCode,
} from "@/lib/constants/status";
import { formatDate } from "@/lib/utils";
import {
  PackageCategory,
  PackageStatus,
  PaymentStatus,
  ProjectStatus,
  StatusIndicator,
} from "@prisma/client";

export interface OutstandingProcurementItem {
  id: string;
  projectCode: string;
  projectName: string;
  companyName: string;
  packageName: string;
  category: PackageCategory;
  vendor: string;
  noPoSpk: string;
  poSpkDate: string | null;
  estDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  delayDays: number;
  packageStatus: PackageStatus;
  paymentStatus: PaymentStatus;
  poAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface BudgetRealizationItem {
  id: string;
  projectCode: string;
  projectName: string;
  companyName: string;
  estateName: string;
  budgetType: string;
  status: ProjectStatus;
  totalBudgetAmount: number;
  totalPoAmount: number;
  totalPaidAmount: number;
  remainingBudget: number;
  absorptionPct: number;
  commitmentPct: number;
}

/**
 * Ekspor Laporan Pengadaan Outstanding ke format Excel (.xlsx)
 * Dynamic import library xlsx sesuai docs/design.md §4.
 * Kolom: paket, vendor, PO, estimasi, keterlambatan hari, nilai, dll.
 */
export async function exportProcurementOutstandingExcel(
  items: OutstandingProcurementItem[]
) {
  const XLSX = await import("xlsx");

  const rows = items.map((item, index) => {
    const pkgStatusLabel = PACKAGE_STATUS_CONFIG[item.packageStatus]?.label || item.packageStatus;
    const payStatusLabel = PAYMENT_STATUS_CONFIG[item.paymentStatus]?.label || item.paymentStatus;
    const catLabel = PACKAGE_CATEGORY_CONFIG[item.category]?.label || item.category;

    return {
      No: index + 1,
      "Kode Proyek": item.projectCode,
      "Nama Proyek": item.projectName,
      Perusahaan: item.companyName,
      "Nama Paket Pengadaan": item.packageName,
      Kategori: catLabel,
      Vendor: item.vendor,
      "No PO/SPK": item.noPoSpk,
      "Tanggal PO": item.poSpkDate ? formatDate(item.poSpkDate) : "-",
      "Estimasi Kedatangan": item.estDeliveryDate ? formatDate(item.estDeliveryDate) : "-",
      "Kedatangan Terakhir": item.actualDeliveryDate ? formatDate(item.actualDeliveryDate) : "-",
      "Keterlambatan (Hari)": item.delayDays > 0 ? `${item.delayDays} Hari` : "Tepat Waktu",
      "Status Pengadaan": pkgStatusLabel,
      "Status Pembayaran": payStatusLabel,
      "Nilai Kontrak/PO (Rp)": item.poAmount,
      "Nilai Terbayar (Rp)": item.paidAmount,
      "Sisa Belum Dibayar (Rp)": item.remainingAmount,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set lebar kolom yang proporsional
  const colWidths = [
    { wch: 5 },  // No
    { wch: 22 }, // Kode Proyek
    { wch: 30 }, // Nama Proyek
    { wch: 20 }, // Perusahaan
    { wch: 28 }, // Nama Paket
    { wch: 16 }, // Kategori
    { wch: 24 }, // Vendor
    { wch: 22 }, // No PO
    { wch: 14 }, // Tgl PO
    { wch: 16 }, // Estimasi
    { wch: 16 }, // Kedatangan
    { wch: 18 }, // Keterlambatan
    { wch: 18 }, // Status Pengadaan
    { wch: 18 }, // Status Pembayaran
    { wch: 22 }, // Nilai PO
    { wch: 20 }, // Terbayar
    { wch: 22 }, // Sisa
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pengadaan Outstanding");

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `Laporan_Pengadaan_Outstanding_${dateStamp}.xlsx`);
}

/**
 * Ekspor Laporan Realisasi Anggaran Proyek ke format Excel (.xlsx)
 * Menampilkan komparasi: Total Budget vs Σ Nilai PO vs Σ Realisasi Pembayaran per proyek.
 */
export async function exportBudgetRealizationExcel(
  items: BudgetRealizationItem[]
) {
  const XLSX = await import("xlsx");

  const rows = items.map((item, index) => {
    const statusLabel = PROJECT_STATUS_CONFIG[item.status]?.label || item.status;

    return {
      No: index + 1,
      "Kode Proyek": item.projectCode,
      "Nama Proyek": item.projectName,
      Perusahaan: item.companyName,
      Estate: item.estateName,
      "Tipe Anggaran": item.budgetType,
      "Status Proyek": statusLabel,
      "Total Anggaran (Rencana) (Rp)": item.totalBudgetAmount,
      "Total Komitmen Kontrak/PO (Rp)": item.totalPoAmount,
      "Total Realisasi Bayar (Rp)": item.totalPaidAmount,
      "Sisa Anggaran Belum Terikat (Rp)": item.remainingBudget,
      "Komitmen PO (%)": item.commitmentPct,
      "Penyerapan Anggaran (%)": item.absorptionPct,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set lebar kolom yang proporsional
  const colWidths = [
    { wch: 5 },  // No
    { wch: 22 }, // Kode Proyek
    { wch: 32 }, // Nama Proyek
    { wch: 20 }, // Perusahaan
    { wch: 16 }, // Estate
    { wch: 18 }, // Tipe Anggaran
    { wch: 18 }, // Status Proyek
    { wch: 26 }, // Total Anggaran
    { wch: 26 }, // Total Komitmen PO
    { wch: 24 }, // Total Realisasi
    { wch: 28 }, // Sisa Anggaran
    { wch: 16 }, // Komitmen PO %
    { wch: 22 }, // Penyerapan Anggaran %
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Realisasi Anggaran");

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `Laporan_Realisasi_Anggaran_${dateStamp}.xlsx`);
}

export interface ApprovalMatrixSnapshotItem {
  level: number;
  role: string;
  personName: string | null;
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  waitingDays: number;
}

export interface ApprovalMatrixItem {
  id: string;
  projectCode: string;
  projectName: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  regionName: string;
  status: ProjectStatus;
  noAr: string;
  approvedAmount: number;
  currentAttempt: number;
  afceStatus: string;
  emailSubmittedDate: string | null;
  mcaApprovalDate: string | null;
  snapshots: ApprovalMatrixSnapshotItem[];
  activeWaitingRole: string | null;
  activeWaitingDays: number;
  hasRejection: boolean;
  supplementaryCount: number;
}

export interface WorkPackageProgressItem {
  id: string;
  packageName: string;
  category: PackageCategory;
  vendorName: string;
  weightPct: number;
  progressPct: number;
  targetQuantity: number | null;
  volumeAchieved: number | null;
  uom: string | null;
  status: PackageStatus;
  paymentStatus: PaymentStatus;
  estDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  isDelayed: boolean;
}

export interface ProjectProgressItem {
  id: string;
  projectCode: string;
  projectName: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  regionName: string;
  status: ProjectStatus;
  statusIndicator: StatusIndicator;
  progressPct: number;
  targetQuantity: number | null;
  uom: string | null;
  targetStartDate: string | null;
  targetEndDate: string | null;
  milestones: {
    survey: { status: "DONE" | "IN_PROGRESS" | "PENDING"; date?: string | null };
    rab: { status: "READY" | "DRAFT" | "PENDING" };
    approval: { status: "APPROVED" | "WAITING" | "REJECTED" | "PENDING"; noAr?: string };
    procurement: { status: "DELIVERED" | "PO_ISSUED" | "PR_SUBMITTED" | "PENDING"; totalPackages: number; deliveredPackages: number };
    execution: { status: "IN_PROGRESS" | "COMPLETED" | "PENDING"; progressPct: number };
    bast: { status: "VERIFIED" | "WAITING_VERIFICATION" | "NOT_SUBMITTED"; bastNumber?: string; verifiedAt?: string | null };
  };
  workPackages: WorkPackageProgressItem[];
}

/**
 * Ekspor Matriks Persetujuan Proyek ke format Excel (.xlsx)
 */
export async function exportApprovalMatrixExcel(items: ApprovalMatrixItem[]) {
  const XLSX = await import("xlsx");

  const rows = items.map((item, index) => {
    const statusLabel = PROJECT_STATUS_CONFIG[item.status]?.label || item.status;

    const formatRoleCell = (roleCode: string) => {
      const snap = item.snapshots.find(
        (s) => normalizeApprovalRoleCode(s.role) === roleCode
      );
      if (!snap || snap.status === "TIDAK_PERLU") return "NA";
      if (snap.status === "APPROVED") {
        return snap.approvedAt ? `✓ ${formatDate(snap.approvedAt)}` : "✓";
      }
      if (snap.status === "REJECTED") {
        return snap.rejectedAt ? `✗ Ditolak (${formatDate(snap.rejectedAt)})` : "✗ Ditolak";
      }
      if (snap.status === "WAITING") {
        return snap.waitingDays > 0 ? `Menunggu (${snap.waitingDays} hari)` : "Menunggu";
      }
      return "NA";
    };

    return {
      No: index + 1,
      "Kode Proyek": item.projectCode,
      "Nama Proyek": item.projectName,
      Perusahaan: item.companyName,
      Wilayah: item.regionName,
      "Status Proyek": statusLabel,
      "No AR": item.noAr || "-",
      "Nilai Pengajuan (Rp)": item.approvedAmount,
      "Attempt Ke": item.currentAttempt,
      "Status Dokumen AR": item.afceStatus,
      "Tgl Submit Email": item.emailSubmittedDate ? formatDate(item.emailSubmittedDate) : "-",
      EM: formatRoleCell("EM"),
      GEM: formatRoleCell("GEM"),
      RH: formatRoleCell("RH"),
      HP: formatRoleCell("HP"),
      MCA: formatRoleCell("MCA"),
      CFO: formatRoleCell("CFO"),
      COO: formatRoleCell("COO"),
      CEO: formatRoleCell("CEO"),
      Chairman: formatRoleCell("Chairman"),
      "Approver Tertahan": item.activeWaitingRole || "-",
      "Hari Menunggu": item.activeWaitingDays > 0 ? `${item.activeWaitingDays} Hari` : "-",
      "AR Tambahan (Qty)": item.supplementaryCount,
      "Ada Penolakan / Revisi": item.hasRejection ? "Ya (Pernah Ditolak)" : "Tidak",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 5 },  // No
    { wch: 22 }, // Kode Proyek
    { wch: 32 }, // Nama Proyek
    { wch: 20 }, // Perusahaan
    { wch: 18 }, // Wilayah
    { wch: 18 }, // Status Proyek
    { wch: 18 }, // No AR
    { wch: 22 }, // Nilai Pengajuan
    { wch: 12 }, // Attempt
    { wch: 18 }, // Status Dokumen
    { wch: 16 }, // Tgl Submit Email
    { wch: 14 }, // EM
    { wch: 14 }, // GEM
    { wch: 14 }, // RH
    { wch: 14 }, // HP
    { wch: 14 }, // MCA
    { wch: 14 }, // CFO
    { wch: 14 }, // COO
    { wch: 14 }, // CEO
    { wch: 14 }, // Chairman
    { wch: 22 }, // Approver Tertahan
    { wch: 14 }, // Hari Menunggu
    { wch: 16 }, // Supplementary
    { wch: 22 }, // Ada Penolakan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Matriks Persetujuan");

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `Laporan_Matriks_Persetujuan_${dateStamp}.xlsx`);
}

/**
 * Ekspor Progres Siklus Proyek & Paket Kerja ke format Excel (.xlsx)
 * Menghasilkan 2 sheet: "Siklus Proyek" dan "Rincian Paket Kerja"
 */
export async function exportProjectProgressExcel(items: ProjectProgressItem[]) {
  const XLSX = await import("xlsx");

  // Sheet 1: Siklus Proyek
  const summaryRows = items.map((item, index) => {
    const statusLabel = PROJECT_STATUS_CONFIG[item.status]?.label || item.status;
    return {
      No: index + 1,
      "Kode Proyek": item.projectCode,
      "Nama Proyek": item.projectName,
      Perusahaan: item.companyName,
      Wilayah: item.regionName,
      "Status Proyek": statusLabel,
      "Indikator EWS": item.statusIndicator,
      "Progres Aktual (%)": item.progressPct,
      "Fase 1: Survei": item.milestones.survey.status,
      "Fase 2: RAB": item.milestones.rab.status,
      "Fase 3: Approval AR": item.milestones.approval.status,
      "Fase 4: Pengadaan": `${item.milestones.procurement.status} (${item.milestones.procurement.deliveredPackages}/${item.milestones.procurement.totalPackages} paket tiba)`,
      "Fase 5: Eksekusi Lapangan": `${item.milestones.execution.status} (${item.milestones.execution.progressPct}%)`,
      "Fase 6: Serah Terima BAST": item.milestones.bast.status,
      "No BAST": item.milestones.bast.bastNumber || "-",
      "Tgl Verifikasi BAST": item.milestones.bast.verifiedAt ? formatDate(item.milestones.bast.verifiedAt) : "-",
      "Target Mulai": item.targetStartDate ? formatDate(item.targetStartDate) : "-",
      "Target Selesai": item.targetEndDate ? formatDate(item.targetEndDate) : "-",
    };
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 32 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 26 },
    { wch: 26 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
  ];

  // Sheet 2: Rincian Paket Kerja
  const packageRows: Record<string, unknown>[] = [];
  let pkgIdx = 1;
  for (const item of items) {
    if (!item.workPackages || item.workPackages.length === 0) {
      packageRows.push({
        No: pkgIdx++,
        "Kode Proyek": item.projectCode,
        "Nama Proyek": item.projectName,
        Perusahaan: item.companyName,
        "Nama Paket": "(Belum ada paket kerja)",
        Kategori: "-",
        Vendor: "-",
        "Bobot (%)": 0,
        "Progres (%)": 0,
        "Target Volume": "-",
        "Realisasi Volume": "-",
        Satuan: "-",
        "Status Paket": "-",
        "Status Pembayaran": "-",
        "Estimasi Tiba": "-",
        "Tiba Terakhir": "-",
        "Keterlambatan": "-",
      });
    } else {
      for (const pkg of item.workPackages) {
        packageRows.push({
          No: pkgIdx++,
          "Kode Proyek": item.projectCode,
          "Nama Proyek": item.projectName,
          Perusahaan: item.companyName,
          "Nama Paket": pkg.packageName,
          Kategori: PACKAGE_CATEGORY_CONFIG[pkg.category]?.label || pkg.category,
          Vendor: pkg.vendorName || "-",
          "Bobot (%)": pkg.weightPct,
          "Progres (%)": pkg.progressPct,
          "Target Volume": pkg.targetQuantity ?? "-",
          "Realisasi Volume": pkg.volumeAchieved ?? "-",
          Satuan: pkg.uom || "-",
          "Status Paket": PACKAGE_STATUS_CONFIG[pkg.status]?.label || pkg.status,
          "Status Pembayaran": PAYMENT_STATUS_CONFIG[pkg.paymentStatus]?.label || pkg.paymentStatus,
          "Estimasi Tiba": pkg.estDeliveryDate ? formatDate(pkg.estDeliveryDate) : "-",
          "Tiba Terakhir": pkg.actualDeliveryDate ? formatDate(pkg.actualDeliveryDate) : "-",
          "Keterlambatan": pkg.isDelayed ? "Terlambat" : "Tepat Waktu",
        });
      }
    }
  }

  const packageSheet = XLSX.utils.json_to_sheet(packageRows);
  packageSheet["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 32 },
    { wch: 20 },
    { wch: 28 },
    { wch: 16 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Siklus Proyek");
  XLSX.utils.book_append_sheet(workbook, packageSheet, "Rincian Paket Kerja");

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(workbook, `Laporan_Progres_Proyek_${dateStamp}.xlsx`);
}

