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
import { PackageCategory } from "@prisma/client";
import { Calendar, Check } from "lucide-react";
import React, { useMemo } from "react";

export interface ProjectMatrixGanttChartProps {
  packages: GanttPackageItem[];
  milestones?: ProjectMilestoneInfo;
  targetStartDate?: string | Date | null;
  targetEndDate?: string | Date | null;
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

    // Jika sekarang lewat dari rentang, tandai index terakhir
    if (foundCurrentWeek === -1 && weekList.length > 0) {
      if (nowTs > weekList[weekList.length - 1].endDate.getTime()) {
        foundCurrentWeek = weekList.length - 1;
      } else {
        foundCurrentWeek = 0;
      }
    }

    return { weeks: weekList, currentWeekIndex: foundCurrentWeek };
  }, [packages, milestones, targetStartDate, targetEndDate, now]);

  // 2. Kelompokkan Paket Kerja per Kategori
  const groupedPackages = useMemo(() => {
    const groups: {
      category: PackageCategory;
      label: string;
      items: (GanttPackageItem & { itemIndex: string })[];
    }[] = [];

    const map = new Map<PackageCategory, GanttPackageItem[]>();

    packages.forEach((pkg) => {
      const cat = pkg.category || PackageCategory.MATERIAL;
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(pkg);
    });

    const categories = Array.from(map.keys());

    categories.forEach((cat) => {
      const pkgs = map.get(cat) || [];
      const itemsWithLetter = pkgs.map((p, i) => ({
        ...p,
        itemIndex: String.fromCharCode(97 + (i % 26)), // a, b, c, ...
      }));

      groups.push({
        category: cat,
        label: PACKAGE_CATEGORY_CONFIG[cat]?.label || cat,
        items: itemsWithLetter,
      });
    });

    return groups;
  }, [packages]);

  // 3. Evaluasi status sel mingguan untuk setiap paket
  const evaluateCell = (
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
    // Opsi B (Override manual): jika actualEndDate ditentukan melampaui planEndDate
    // Opsi A (Otomatis): jika belum selesai dan waktu sudah melampaui planEndDate
    let isRevised = false;

    if (pEnd && wStart > pEnd) {
      if (aEnd && aEnd > pEnd) {
        // Override batas akhir dari actualEndDate
        if (wStart <= aEnd) {
          isRevised = true;
        }
      } else if (!isCompleted) {
        // Otomatis batas akhir hingga minggu berjalan saat ini (+1 minggu untuk antisipasi)
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
      // Diletakkan di minggu penyelesaian
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
                  className="min-w-[220px] max-w-[280px] px-3 py-2 text-left border-r border-border sticky left-12 z-30 bg-muted/95 backdrop-blur-xs"
                >
                  Job Item
                </th>
                <th
                  colSpan={2}
                  className="px-2 py-1 text-center border-r border-border sticky left-[calc(3rem+220px)] md:left-[calc(3rem+280px)] z-30 bg-muted/95 backdrop-blur-xs min-w-[130px]"
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
                <th className="w-16 px-1.5 py-1 text-center border-r border-border sticky left-[calc(3rem+220px)] md:left-[calc(3rem+280px)] z-30 bg-muted/95 backdrop-blur-xs">
                  Start
                </th>
                <th className="w-16 px-1.5 py-1 text-center border-r border-border sticky left-[calc(3rem+220px+4rem)] md:left-[calc(3rem+280px+4rem)] z-30 bg-muted/95 backdrop-blur-xs">
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
              {groupedPackages.length === 0 ? (
                <tr>
                  <td
                    colSpan={4 + weeks.length}
                    className="p-8 text-center text-muted-foreground text-xs"
                  >
                    Belum ada paket kerja yang ditambahkan ke proyek ini.
                  </td>
                </tr>
              ) : (
                groupedPackages.map((group, groupIdx) => (
                  <React.Fragment key={group.category}>
                    {/* Header Kategori (Grup Utama: 1. Material, 2. Jasa, dll) */}
                    <tr className="bg-muted/40 font-bold text-foreground">
                      <td
                        colSpan={4 + weeks.length}
                        className="px-3 py-1.5 border-y border-border text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-bold">
                            {groupIdx + 1}. {group.label}
                          </span>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            ({group.items.length} paket)
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Baris Tiap Paket Kerja */}
                    {group.items.map((pkg) => (
                      <tr
                        key={pkg.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        {/* Kolom No: a, b, c, ... */}
                        <td className="px-2 py-1 text-center font-medium text-muted-foreground border-r border-border sticky left-0 z-20 bg-background">
                          {pkg.itemIndex}
                        </td>

                        {/* Kolom Job Item */}
                        <td
                          className="px-3 py-1 text-left font-normal truncate max-w-[280px] border-r border-border sticky left-12 z-20 bg-background"
                          title={pkg.packageName}
                        >
                          <span className="truncate block font-medium">
                            {pkg.packageName}
                          </span>
                        </td>

                        {/* Kolom Plan Start */}
                        <td className="px-1.5 py-1 text-center text-[10px] text-muted-foreground border-r border-border sticky left-[calc(3rem+220px)] md:left-[calc(3rem+280px)] z-20 bg-background whitespace-nowrap">
                          {formatShortDate(pkg.planStartDate)}
                        </td>

                        {/* Kolom Plan End */}
                        <td className="px-1.5 py-1 text-center text-[10px] text-muted-foreground border-r border-border sticky left-[calc(3rem+220px+4rem)] md:left-[calc(3rem+280px+4rem)] z-20 bg-background whitespace-nowrap">
                          {formatShortDate(pkg.planEndDate)}
                        </td>

                        {/* Sel-Sel Mingguan */}
                        {weeks.map((week) => {
                          const cell = evaluateCell(pkg, week);
                          const isCutoff = week.index === currentWeekIndex;

                          // Tentukan kelas warna latar sel
                          let cellBgClass = "bg-transparent";
                          let cellTextClass = "text-foreground";

                          if (cell.styleType === "PLAN") {
                            // Abu-abu
                            cellBgClass =
                              "bg-slate-300 dark:bg-slate-600/80 hover:bg-slate-400/80";
                            cellTextClass =
                              "text-slate-900 dark:text-slate-100 font-semibold";
                          } else if (cell.styleType === "REVISED") {
                            // Kuning
                            cellBgClass =
                              "bg-[#facc15] dark:bg-yellow-500 hover:bg-yellow-400";
                            cellTextClass = "text-yellow-950 font-bold";
                          } else if (cell.styleType === "THIS_WEEK_REVISED") {
                            // Oranye
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
                                      {pkg.packageName}
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
