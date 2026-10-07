import {
  PACKAGE_CATEGORY_CONFIG,
  PACKAGE_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
} from "@/lib/constants/status";
import { formatDate } from "@/lib/utils";
import { PackageCategory, PackageStatus, PaymentStatus, ProjectStatus } from "@prisma/client";

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
