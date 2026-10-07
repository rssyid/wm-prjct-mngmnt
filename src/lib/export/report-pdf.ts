import { PROJECT_STATUS_CONFIG, STATUS_INDICATOR_CONFIG } from "@/lib/constants/status";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ProjectStatus, StatusIndicator } from "@prisma/client";

export interface ProjectStatusReportItem {
  id: string;
  projectCode: string;
  projectName: string;
  displayName: string | null;
  status: ProjectStatus;
  statusIndicator: StatusIndicator;
  progressPct: number;
  totalBudgetAmount: number;
  budgetType: string;
  targetStartDate: string | null;
  targetEndDate: string | null;
  company: { id: string; code: string; name: string };
  estate: { id: string; code: string; name: string };
  folderCategory?: { id: string; name: string };
}

export interface ProjectStatusReportData {
  kpi: {
    totalProjects: number;
    avgProgress: number;
    indicators: {
      ON_TRACK: number;
      AT_RISK: number;
      DELAYED: number;
      COMPLETED: number;
    };
  };
  projects: ProjectStatusReportItem[];
}

export interface ReportFilterMeta {
  companyName?: string;
  statusLabel?: string;
  dateRangeLabel?: string;
}

/**
 * Ekspor Laporan Status Proyek ke PDF menggunakan jsPDF + autotable (dynamic import)
 * Disusun dengan format id-ID, layout Landscape A4, header resmi, KPI summary, dan tabel proyek.
 */
export async function exportProjectStatusPdf(
  data: ProjectStatusReportData,
  filterMeta?: ReportFilterMeta
) {
  // 1. Dynamic import library sesuai docs/design.md §4
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  // Inisialisasi dokumen Landscape A4
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const printTimestamp = `${formatDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} WIB`;

  // --- HEADER DOKUMEN ---
  doc.setFillColor(22, 163, 74); // Primary green perkebunan (#16A34A)
  doc.rect(14, 12, 4, 14, "F");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text("LAPORAN STATUS PROYEK", 22, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text("Sistem Manajemen Proyek Water Management (WM PRJCT MNGMNT)", 22, 23);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(`Waktu Cetak: ${printTimestamp}`, pageWidth - 14, 18, { align: "right" });

  // Informasi Filter yang diterapkan
  const filterStrings: string[] = [];
  if (filterMeta?.companyName) filterStrings.push(`Perusahaan: ${filterMeta.companyName}`);
  if (filterMeta?.statusLabel) filterStrings.push(`Status: ${filterMeta.statusLabel}`);
  if (filterMeta?.dateRangeLabel) filterStrings.push(`Periode: ${filterMeta.dateRangeLabel}`);

  if (filterStrings.length > 0) {
    doc.text(`Filter: ${filterStrings.join(" | ")}`, 22, 29);
  }

  // --- KPI SUMMARY CARDS ---
  const kpiStartY = filterStrings.length > 0 ? 33 : 28;
  const cardWidth = (pageWidth - 28 - 15) / 4;
  const cardHeight = 16;

  // Card 1: Total Proyek
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, kpiStartY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL PROYEK", 18, kpiStartY + 5);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.kpi.totalProjects} Proyek`, 18, kpiStartY + 12);

  // Card 2: Rata-rata Progres Fisik
  const c2X = 14 + cardWidth + 5;
  doc.roundedRect(c2X, kpiStartY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("RATA-RATA PROGRES", c2X + 4, kpiStartY + 5);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74); // green
  doc.text(`${data.kpi.avgProgress.toFixed(1)}%`, c2X + 4, kpiStartY + 12);

  // Card 3: Sesuai Jadwal (On Track)
  const c3X = c2X + cardWidth + 5;
  doc.roundedRect(c3X, kpiStartY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("ON TRACK / COMPLETED", c3X + 4, kpiStartY + 5);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129); // emerald
  doc.text(`${data.kpi.indicators.ON_TRACK + data.kpi.indicators.COMPLETED}`, c3X + 4, kpiStartY + 12);

  // Card 4: Bermasalah (At Risk / Delayed)
  const c4X = c3X + cardWidth + 5;
  doc.roundedRect(c4X, kpiStartY, cardWidth, cardHeight, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("AT RISK / DELAYED", c4X + 4, kpiStartY + 5);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(225, 29, 72); // rose
  doc.text(`${data.kpi.indicators.AT_RISK + data.kpi.indicators.DELAYED}`, c4X + 4, kpiStartY + 12);

  // --- TABEL PROYEK ---
  const tableStartY = kpiStartY + cardHeight + 6;

  const tableRows = data.projects.map((p, idx) => {
    const statusCfg = PROJECT_STATUS_CONFIG[p.status];
    const indicatorCfg = STATUS_INDICATOR_CONFIG[p.statusIndicator];

    return [
      idx + 1,
      p.projectCode,
      p.displayName || p.projectName,
      `${p.company.code} - ${p.estate.code}`,
      statusCfg?.label || p.status,
      indicatorCfg?.label || p.statusIndicator,
      `${(p.progressPct || 0).toFixed(1)}%`,
      p.targetEndDate ? formatDate(p.targetEndDate) : "-",
      formatCurrency(p.totalBudgetAmount),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 14, right: 14, bottom: 16 },
    head: [
      [
        "No",
        "Kode Proyek",
        "Nama Proyek",
        "Unit/Estate",
        "Status Tahapan",
        "Status SLA",
        "Progres",
        "Target Selesai",
        "Anggaran",
      ],
    ],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85], // Slate-700
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { fontStyle: "bold", cellWidth: 32 },
      2: { cellWidth: 60 },
      3: { cellWidth: 28 },
      4: { cellWidth: 34 },
      5: { cellWidth: 28 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 18 },
      7: { halign: "center", cellWidth: 26 },
      8: { halign: "right", cellWidth: 32 },
    },
    didDrawPage: (hookData) => {
      // Footer Nomor Halaman
      const pageNumber = hookData.pageNumber;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${pageNumber}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: "right" }
      );
      doc.text(
        "Kerahasiaan Dokumen: Manajemen Internal PT Water Management",
        14,
        pageHeight - 8
      );
    },
  });

  // Simpan berkas dengan stempel tanggal
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  doc.save(`Laporan_Status_Proyek_${dateStamp}_${timeStamp}.pdf`);
}
