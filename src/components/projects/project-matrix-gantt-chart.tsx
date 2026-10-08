"use client";

import {
  GanttPackageItem,
  ProjectMilestoneInfo,
} from "@/components/projects/project-gantt-chart";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PACKAGE_CATEGORY_CONFIG } from "@/lib/constants/status";
import { cn, formatDate } from "@/lib/utils";
import { AfceStatus, PackageCategory } from "@prisma/client";
import { Calendar, Check, FileCheck } from "lucide-react";
import React, { useMemo } from "react";

export interface AfceInfo {
  id?: string;
  emailSubmittedDate?: string | Date | null;
  mcaApprovalDate?: string | Date | null;
  status?: AfceStatus | string | null;
  noAr?: string | null;
  currentAttempt?: number;
}

export interface ProjectMatrixGanttChartProps {
  packages: GanttPackageItem[];
  milestones?: ProjectMilestoneInfo;
  targetStartDate?: string | Date | null;
  targetEndDate?: string | Date | null;
  afceDocument?: AfceInfo | null;
  className?: string;
}

interface WeekInfo {
  index: number;
  label: string;
  dateLabel: string;
  startDate: Date;
  endDate: Date;
  isCurrentWeek: boolean;
}

type CellStyleType = "EMPTY" | "PLAN" | "REVISED" | "THIS_WEEK_REVISED";

interface CellData {
  styleType: CellStyleType;
  symbol: string;
  tooltipText: string;
}

interface MatrixRowItem {
  id: string;
  itemIndex: string;
  packageName: string;
  subLabel?: string;
  isAfce?: boolean;
  planStartDate?: string | Date | null;
  planEndDate?: string | Date | null;
  evaluateCell: (week: WeekInfo) => CellData;
}

interface MatrixGroup {
  id: string;
  groupIndex: number;
  label: string;
  badgeCount?: number;
  isAfceGroup?: boolean;
  items: MatrixRowItem[];
}

/**
 * Format tanggal ringkas (contoh: 02-Aug)
 */
function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * Normalisasi ke hari Senin terdekat (Start of Week)
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function ProjectMatrixGanttChart({
  packages,
  milestones,
  targetStartDate,
  targetEndDate,
  afceDocument,
  className,
}: ProjectMatrixGanttChartProps) {
  const now = useMemo(() => new Date(), []);

  // 1. Hitung Rentang Waktu & Buat Daftar Kolom Mingguan (W1, W2, ... Wn)
  const { weeks, currentWeekIndex } = useMemo(() => {
    const dates: number[] = [];

    if (targetStartDate) dates.push(new Date(targetStartDate).getTime());
    if (targetEndDate) dates.push(new Date(targetEndDate).getTime());
    if (milestones?.targetStartDate) dates.push(new Date(milestones.targetStartDate).getTime());
    if (milestones?.targetEndDate) dates.push(new Date(milestones.targetEndDate).getTime());

    // Tanggal AFCE
    if (afceDocument?.emailSubmittedDate) dates.push(new Date(afceDocument.emailSubmittedDate).getTime());
    if (afceDocument?.mcaApprovalDate) dates.push(new Date(afceDocument.mcaApprovalDate).getTime());
    if (milestones?.afceSubmittedDate) dates.push(new Date(milestones.afceSubmittedDate).getTime());
    if (milestones?.afceApprovedDate) dates.push(new Date(milestones.afceApprovedDate).getTime());

    packages.forEach((pkg) => {
      if (pkg.planStartDate) dates.push(new Date(pkg.planStartDate).getTime());
      if (pkg.planEndDate) dates.push(new Date(pkg.planEndDate).getTime());
      if (pkg.actualStartDate) dates.push(new Date(pkg.actualStartDate).getTime());
      if (pkg.actualEndDate) dates.push(new Date(pkg.actualEndDate).getTime());
    });

    dates.push(now.getTime());

    const minTs = dates.length > 0 ? Math.min(...dates) : now.getTime();
    const maxTs = dates.length > 0 ? Math.max(...dates) : now.getTime();

    const startMonday = getStartOfWeek(new Date(minTs));
    const endMonday = getStartOfWeek(new Date(maxTs));
    // Tambah 2 minggu buffer setelah tanggal maks untuk kenyamanan melihat proyeksi
    endMonday.setDate(endMonday.getDate() + 14);

    const weekList: WeekInfo[] = [];
    const curr = new Date(startMonday);
    let idx = 0;
    let foundCurrentWeek = -1;

    const nowTs = now.getTime();

    while (curr <= endMonday) {
      const wStart = new Date(curr);
      const wEnd = new Date(curr);
      wEnd.setDate(wEnd.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);

      const isCurrent = nowTs >= wStart.getTime() && nowTs <= wEnd.getTime();
      if (isCurrent) {
        foundCurrentWeek = idx;
      }

      weekList.push({
        index: idx,
        label: `W${idx + 1}`,
        dateLabel: `${String(wStart.getDate()).padStart(2, "0")}/${String(
          wStart.getMonth() + 1
        ).padStart(2, "0")}`,
        startDate: wStart,
        endDate: wEnd,
        isCurrentWeek: isCurrent,
      });

      curr.setDate(curr.getDate() + 7);
      idx++;
    }

    if (foundCurrentWeek === -1 && weekList.length > 0) {
      if (nowTs > weekList[weekList.length - 1].endDate.getTime()) {
        foundCurrentWeek = weekList.length - 1;
      } else {
        foundCurrentWeek = 0;
      }
    }

    return { weeks: weekList, currentWeekIndex: foundCurrentWeek };
  }, [packages, milestones, targetStartDate, targetEndDate, afceDocument, now]);

  // 2. Kelompokkan Data Termasuk Baris Approval AFCE
  const matrixGroups = useMemo(() => {
    // Helper evaluasi status sel mingguan untuk paket kerja biasa
    const evaluatePackageCell = (
      pkg: GanttPackageItem,
      week: WeekInfo
    ): CellData => {
      const wStart = week.startDate.getTime();
      const wEnd = week.endDate.getTime();

      const pStart = pkg.planStartDate ? new Date(pkg.planStartDate).getTime() : null;
      const pEnd = pkg.planEndDate ? new Date(pkg.planEndDate).getTime() : null;
      const aStart = pkg.actualStartDate ? new Date(pkg.actualStartDate).getTime() : null;
      const aEnd = pkg.actualEndDate ? new Date(pkg.actualEndDate).getTime() : null;

      const isCompleted =
        pkg.progressPct >= 100 ||
        pkg.status === "COMPLETED" ||
        pkg.status === "DELIVERED";

      // 1) Rencana (Plan): irisan dengan [pStart, pEnd]
      const isPlan = Boolean(pStart && pEnd && !(wEnd < pStart || wStart > pEnd));

      // 2) Keterlambatan / Target Revisi:
      let isRevised = false;

      if (pEnd && wStart > pEnd) {
        if (aEnd && aEnd > pEnd) {
          // Override batas akhir dari actualEndDate
          if (wStart <= aEnd) {
            isRevised = true;
          }
        } else if (!isCompleted) {
          // Otomatis batas akhir hingga minggu berjalan saat ini (+1 minggu buffer)
          const autoLimit = Math.max(now.getTime(), pEnd) + 7 * 24 * 60 * 60 * 1000;
          if (wStart <= autoLimit) {
            isRevised = true;
          }
        }
      }

      // 3) Menentukan warna sel
      let styleType: CellStyleType = "EMPTY";
      if (isRevised) {
        if (week.isCurrentWeek) {
          styleType = "THIS_WEEK_REVISED"; // Oranye
        } else {
          styleType = "REVISED"; // Kuning
        }
      } else if (isPlan) {
        styleType = "PLAN"; // Abu-abu
      }

      // 4) Menentukan simbol di dalam sel
      let symbol = "";

      // Simbol Selesai (✓)
      if (isCompleted) {
        const targetFinishTs = aEnd || pEnd;
        if (targetFinishTs && wStart <= targetFinishTs && targetFinishTs <= wEnd) {
          symbol = "✓";
        } else if (!targetFinishTs && isPlan && wEnd >= (pEnd || 0)) {
          symbol = "✓";
        }
      }

      // Simbol Progres (#)
      if (!symbol && (pkg.progressPct > 0 || (aStart && aStart <= wEnd))) {
        const activeStart = aStart || pStart;
        const activeEnd = isCompleted ? (aEnd || pEnd || now.getTime()) : now.getTime();

        if (activeStart && wEnd >= activeStart && wStart <= activeEnd) {
          symbol = "#";
        }
      }

      let tooltipDesc = "Di luar jadwal";
      if (styleType === "THIS_WEEK_REVISED") {
        tooltipDesc = "Target Revisi (Minggu Berjalan)";
      } else if (styleType === "REVISED") {
        tooltipDesc = "Target Revisi";
      } else if (styleType === "PLAN") {
        tooltipDesc = "Jadwal Rencana (Plan)";
      }

      if (symbol === "✓") {
        tooltipDesc += " - Pekerjaan Selesai";
      } else if (symbol === "#") {
        tooltipDesc += ` - Progres Berjalan (${pkg.progressPct}%)`;
      }

      return {
        styleType,
        symbol,
        tooltipText: `${pkg.packageName} (${week.label}): ${tooltipDesc}`,
      };
    };

    const list: MatrixGroup[] = [];
    let groupIndexCounter = 1;

    // A. Baris Administrasi & Pengesahan Dokumen AR / AFCE
    const afceStart =
      afceDocument?.emailSubmittedDate ||
      milestones?.afceSubmittedDate ||
      targetStartDate;

    let afceEnd =
      afceDocument?.mcaApprovalDate ||
      milestones?.afceApprovedDate;

    if (!afceEnd && afceStart) {
      const est = new Date(afceStart);
      est.setDate(est.getDate() + 14); // default SLA estimasi review 14 hari
      afceEnd = est;
    }

    const afceStatus = afceDocument?.status || (
      afceDocument?.mcaApprovalDate || milestones?.afceApprovedDate
        ? "APPROVED"
        : afceDocument?.emailSubmittedDate || milestones?.afceSubmittedDate
        ? "SUBMITTED"
        : "PENDING"
    );

    const isApproved = afceStatus === "APPROVED";
    const isSubmitted = afceStatus === "SUBMITTED" || isApproved;
    const isRejected = afceStatus === "REJECTED";

    const evaluateAfceCell = (week: WeekInfo): CellData => {
      const wStart = week.startDate.getTime();
      const wEnd = week.endDate.getTime();

      const sTs = afceStart ? new Date(afceStart).getTime() : null;
      const eTs = afceEnd ? new Date(afceEnd).getTime() : null;
      const rawApprovalDate = afceDocument?.mcaApprovalDate || milestones?.afceApprovedDate;
      const appTs = rawApprovalDate ? new Date(rawApprovalDate).getTime() : null;

      const isPlanRange = Boolean(sTs && eTs && !(wEnd < sTs || wStart > eTs));

      let styleType: CellStyleType = "EMPTY";
      let symbol = "";

      if (isApproved) {
        if (appTs && wStart <= appTs && appTs <= wEnd) {
          styleType = "PLAN";
          symbol = "✓";
        } else if (sTs && appTs && wEnd >= sTs && wStart <= appTs) {
          styleType = "PLAN";
          symbol = "#";
        } else if (isPlanRange) {
          styleType = "PLAN";
        }
      } else if (isSubmitted) {
        const isOverdue = eTs && wStart > eTs;
        if (isOverdue) {
          styleType = week.isCurrentWeek ? "THIS_WEEK_REVISED" : "REVISED";
        } else if (isPlanRange) {
          styleType = "PLAN";
        }

        if (sTs && wEnd >= sTs && wStart <= Math.max(now.getTime(), eTs || 0)) {
          symbol = "#";
        }
      } else if (isRejected) {
        if (eTs && wStart > eTs) {
          styleType = "REVISED";
          symbol = "#";
        } else if (isPlanRange) {
          styleType = "PLAN";
        }
      } else {
        if (isPlanRange) {
          styleType = "PLAN";
        }
      }

      let tooltipDesc = "Administrasi & Pengesahan AR/AFCE";
      if (symbol === "✓") {
        tooltipDesc = `Dokumen AR/AFCE Disetujui (Approved) ✓${
          afceDocument?.noAr ? ` - ${afceDocument.noAr}` : ""
        }`;
      } else if (symbol === "#") {
        tooltipDesc = `Proses Pengajuan & Verifikasi Approval AR/AFCE`;
      } else if (styleType === "THIS_WEEK_REVISED") {
        tooltipDesc = `Target Persetujuan AR/AFCE Melebihi Batas SLA (Minggu Ini)`;
      } else if (styleType === "REVISED") {
        tooltipDesc = `Target Persetujuan AR/AFCE Terlambat`;
      } else if (styleType === "PLAN") {
        tooltipDesc = `Jadwal Pengajuan & Pengesahan AR/AFCE`;
      }

      return {
        styleType,
        symbol,
        tooltipText: tooltipDesc,
      };
    };

    // Selalu masukkan grup Administrasi & Pengesahan AR/AFCE
    list.push({
      id: "group-afce",
      groupIndex: groupIndexCounter++,
      label: "Administrasi & Pengesahan Dokumen",
      isAfceGroup: true,
      items: [
        {
          id: "afce-approval-row",
          itemIndex: "a",
          packageName: "Administrasi & pengesahan AR/AFCE/PO",
          subLabel: afceDocument?.noAr
            ? `No. AR: ${afceDocument.noAr}`
            : isApproved
            ? "Status: Disetujui"
            : isSubmitted
            ? "Status: Menunggu Persetujuan"
            : "Status: Persiapan Dokumen",
          isAfce: true,
          planStartDate: afceStart,
          planEndDate: afceEnd,
          evaluateCell: evaluateAfceCell,
        },
      ],
    });

    // B. Groups dari Paket Kerja Fisik/Pengadaan
    const map = new Map<PackageCategory, GanttPackageItem[]>();
    packages.forEach((pkg) => {
      const cat = pkg.category || PackageCategory.MATERIAL;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(pkg);
    });

    const categories = Array.from(map.keys());
    categories.forEach((cat) => {
      const pkgs = map.get(cat) || [];
      const packageItems: MatrixRowItem[] = pkgs.map((pkg, i) => ({
        id: pkg.id,
        itemIndex: String.fromCharCode(97 + (i % 26)),
        packageName: pkg.packageName,
        planStartDate: pkg.planStartDate,
        planEndDate: pkg.planEndDate,
        evaluateCell: (week: WeekInfo) => evaluatePackageCell(pkg, week),
      }));

      list.push({
        id: `cat-${cat}`,
        groupIndex: groupIndexCounter++,
        label: PACKAGE_CATEGORY_CONFIG[cat]?.label || cat,
        badgeCount: pkgs.length,
        items: packageItems,
      });
    });

    return list;
  }, [afceDocument, milestones, targetStartDate, packages, now]);

  const lastUpdateStr = useMemo(() => {
    return now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [now]);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 md:p-6 shadow-xs space-y-4",
        className
      )}
    >
      {/* Header Dokumen / Matriks */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Rencana Kerja & Visualisasi Matriks Progres
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tabel Progres Mingguan &bull; Terakhir diperbarui:{" "}
            <span className="font-medium text-foreground">{lastUpdateStr}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {afceDocument && (
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium border flex items-center gap-1",
                afceDocument.status === "APPROVED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : afceDocument.status === "SUBMITTED"
                  ? "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300"
                  : "bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-900"
              )}
            >
              <FileCheck className="h-3 w-3" />
              AFCE: {afceDocument.status || "DRAFT"}
            </Badge>
          )}
          <Badge variant="outline" className="text-[11px] font-normal">
            Total {packages.length} Paket Kerja
          </Badge>
          <Badge variant="secondary" className="text-[11px] font-normal">
            {weeks.length} Minggu
          </Badge>
        </div>
      </div>

      {/* Kontainer Matriks Tabel dengan Horizontal Scroll */}
      <div className="relative border border-border rounded-lg bg-background overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs select-none">
            {/* Header Tabel */}
            <thead>
              {/* Baris 1: No, Job Item, Plan (Start/End), Timeline */}
              <tr className="bg-muted/70 text-foreground font-semibold border-b border-border">
                <th
                  rowSpan={2}
                  className="w-12 px-2 py-2 text-center border-r border-border sticky left-0 z-30 bg-muted/95 backdrop-blur-xs"
                >
                  No.
                </th>
                <th
                  rowSpan={2}
                  className="min-w-[240px] max-w-[300px] px-3 py-2 text-left border-r border-border sticky left-12 z-30 bg-muted/95 backdrop-blur-xs"
                >
                  Job Item
                </th>
                <th
                  colSpan={2}
                  className="px-2 py-1 text-center border-r border-border sticky left-[calc(3rem+240px)] md:left-[calc(3rem+300px)] z-30 bg-muted/95 backdrop-blur-xs min-w-[130px]"
                >
                  Plan
                </th>
                <th
                  colSpan={weeks.length}
                  className="px-2 py-1 text-center font-bold tracking-wider uppercase text-[11px] text-muted-foreground bg-muted/50"
                >
                  Timeline
                </th>
              </tr>

              {/* Baris 2: Start, End, W1, W2, ... */}
              <tr className="bg-muted/60 text-[11px] font-medium border-b border-border">
                <th className="w-16 px-1.5 py-1 text-center border-r border-border sticky left-[calc(3rem+240px)] md:left-[calc(3rem+300px)] z-30 bg-muted/95 backdrop-blur-xs">
                  Start
                </th>
                <th className="w-16 px-1.5 py-1 text-center border-r border-border sticky left-[calc(3rem+240px+4rem)] md:left-[calc(3rem+300px+4rem)] z-30 bg-muted/95 backdrop-blur-xs">
                  End
                </th>

                {/* Kolom Mingguan (W1, W2, ...) */}
                {weeks.map((week) => {
                  const isCutoff = week.index === currentWeekIndex;
                  return (
                    <th
                      key={week.index}
                      className={cn(
                        "w-12 min-w-[46px] px-0.5 py-1 text-center border-r border-border/80 transition-colors",
                        isCutoff &&
                          "border-l-2 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20"
                      )}
                    >
                      <div className="font-bold text-[10px] leading-tight">
                        {week.label}
                      </div>
                      <div className="text-[9px] text-muted-foreground font-normal leading-tight">
                        {week.dateLabel}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Isi Tabel */}
            <tbody className="divide-y divide-border">
              {matrixGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={4 + weeks.length}
                    className="p-8 text-center text-muted-foreground text-xs"
                  >
                    Belum ada data jadwal untuk proyek ini.
                  </td>
                </tr>
              ) : (
                matrixGroups.map((group) => (
                  <React.Fragment key={group.id}>
                    {/* Header Kategori (Grup Utama: 1. Administrasi AFCE, 2. Material, dll) */}
                    <tr className="bg-muted/40 font-bold text-foreground">
                      <td
                        colSpan={4 + weeks.length}
                        className="px-3 py-1.5 border-y border-border text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-bold">
                            {group.groupIndex}. {group.label}
                          </span>
                          {group.badgeCount !== undefined && (
                            <span className="text-[10px] font-normal text-muted-foreground">
                              ({group.badgeCount} paket)
                            </span>
                          )}
                          {group.isAfceGroup && (
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-xs border border-emerald-300">
                              Gerbang Persetujuan Proyek
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Baris Tiap Item Pekerjaan */}
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        {/* Kolom No: a, b, c, ... */}
                        <td className="px-2 py-1 text-center font-medium text-muted-foreground border-r border-border sticky left-0 z-20 bg-background">
                          {item.itemIndex}
                        </td>

                        {/* Kolom Job Item */}
                        <td
                          className="px-3 py-1 text-left font-normal truncate max-w-[300px] border-r border-border sticky left-12 z-20 bg-background"
                          title={item.packageName}
                        >
                          <div className="flex flex-col">
                            <span className="truncate block font-medium">
                              {item.packageName}
                            </span>
                            {item.subLabel ? (
                              <span className="text-[10px] text-muted-foreground truncate block">
                                {item.subLabel}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Kolom Plan Start */}
                        <td className="px-1.5 py-1 text-center text-[10px] text-muted-foreground border-r border-border sticky left-[calc(3rem+240px)] md:left-[calc(3rem+300px)] z-20 bg-background whitespace-nowrap">
                          {formatShortDate(item.planStartDate)}
                        </td>

                        {/* Kolom Plan End */}
                        <td className="px-1.5 py-1 text-center text-[10px] text-muted-foreground border-r border-border sticky left-[calc(3rem+240px+4rem)] md:left-[calc(3rem+300px+4rem)] z-20 bg-background whitespace-nowrap">
                          {formatShortDate(item.planEndDate)}
                        </td>

                        {/* Sel-Sel Mingguan */}
                        {weeks.map((week) => {
                          const cell = item.evaluateCell(week);
                          const isCutoff = week.index === currentWeekIndex;

                          let cellBgClass = "bg-transparent";
                          let cellTextClass = "text-foreground";

                          if (cell.styleType === "PLAN") {
                            cellBgClass =
                              "bg-slate-300 dark:bg-slate-600/80 hover:bg-slate-400/80";
                            cellTextClass =
                              "text-slate-900 dark:text-slate-100 font-semibold";
                          } else if (cell.styleType === "REVISED") {
                            cellBgClass =
                              "bg-[#facc15] dark:bg-yellow-500 hover:bg-yellow-400";
                            cellTextClass = "text-yellow-950 font-bold";
                          } else if (cell.styleType === "THIS_WEEK_REVISED") {
                            cellBgClass =
                              "bg-[#f59e0b] dark:bg-amber-500 hover:bg-amber-400";
                            cellTextClass = "text-amber-950 font-bold";
                          }

                          return (
                            <td
                              key={week.index}
                              className={cn(
                                "p-0 text-center border-r border-border/80 h-7 transition-colors",
                                isCutoff && "border-l-2 border-l-rose-500"
                              )}
                            >
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "w-full h-full flex items-center justify-center cursor-default select-none transition-all",
                                        cellBgClass,
                                        cellTextClass
                                      )}
                                    >
                                      {cell.symbol === "✓" ? (
                                        <Check className="h-3 w-3 stroke-[3]" />
                                      ) : cell.symbol ? (
                                        <span className="font-mono text-[11px] leading-none">
                                          {cell.symbol}
                                        </span>
                                      ) : null}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="text-xs max-w-xs"
                                  >
                                    <p className="font-semibold">
                                      {item.packageName}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {week.label} (
                                      {formatDate(week.startDate.toISOString())}{" "}
                                      - {formatDate(week.endDate.toISOString())}
                                      )
                                    </p>
                                    <p className="text-xs mt-1 text-primary">
                                      {cell.tooltipText}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda Bawah (Persis seperti contoh foto) */}
      <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
          Keterangan:
        </span>

        {/* 1. Plan (Abu-abu) */}
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-7 rounded-xs bg-slate-300 dark:bg-slate-600 border border-slate-400/50" />
          <span className="font-medium text-foreground">Plan</span>
        </div>

        {/* 2. Revised Target (Kuning) */}
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-7 rounded-xs bg-[#facc15] dark:bg-yellow-500 border border-yellow-600/40" />
          <span className="font-medium text-foreground">Revised Target</span>
        </div>

        {/* 3. This week, revised target (Oranye) */}
        <div className="flex items-center gap-1.5">
          <span className="h-4 w-7 rounded-xs bg-[#f59e0b] dark:bg-amber-500 border border-amber-600/40" />
          <span className="font-medium text-foreground">
            This week, revised target
          </span>
        </div>

        {/* 4. # Progress */}
        <div className="flex items-center gap-1.5">
          <span className="h-5 w-6 rounded-xs border border-border flex items-center justify-center font-mono font-bold text-xs bg-muted/60">
            #
          </span>
          <span className="font-medium text-foreground">Progress</span>
        </div>

        {/* 5. ✓ Completed */}
        <div className="flex items-center gap-1.5">
          <span className="h-5 w-6 rounded-xs border border-border flex items-center justify-center text-xs bg-muted/60">
            <Check className="h-3 w-3 stroke-[3]" />
          </span>
          <span className="font-medium text-foreground">Completed</span>
        </div>

        {/* Garis Merah Minggu Berjalan */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="h-4 w-1 bg-rose-500 rounded-full" />
          <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
            Batas Minggu Berjalan
          </span>
        </div>
      </div>
    </div>
  );
}
