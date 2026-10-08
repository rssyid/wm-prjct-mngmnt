"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatDate } from "@/lib/utils";
import { PackageCategory, PackageStatus } from "@prisma/client";
import {
  Calendar,
  Flag,
  Milestone,
} from "lucide-react";
import React, { useMemo, useState } from "react";

export interface GanttPackageItem {
  id: string;
  packageName: string;
  category: PackageCategory;
  weightPct: number;
  progressPct: number;
  status: PackageStatus;
  planStartDate?: string | Date | null;
  planEndDate?: string | Date | null;
  actualStartDate?: string | Date | null;
  actualEndDate?: string | Date | null;
}

export interface ProjectMilestoneInfo {
  targetStartDate?: string | Date | null;
  targetEndDate?: string | Date | null;
  afceSubmittedDate?: string | Date | null;
  afceApprovedDate?: string | Date | null;
  bastDate?: string | Date | null;
}

interface ProjectGanttChartProps {
  packages: GanttPackageItem[];
  milestones: ProjectMilestoneInfo;
  className?: string;
}

export function ProjectGanttChart({
  packages,
  milestones,
  className,
}: ProjectGanttChartProps) {
  const [zoomMode, setZoomMode] = useState<"week" | "month">("week");

  // 1. Memoize Boundary & Scale Timeline
  const { minDate, maxDate, totalDays, timeTicks, todayOffsetPct } = useMemo(() => {
    const dates: number[] = [];

    // Parse milestone dates
    if (milestones.targetStartDate) dates.push(new Date(milestones.targetStartDate).getTime());
    if (milestones.targetEndDate) dates.push(new Date(milestones.targetEndDate).getTime());
    if (milestones.afceSubmittedDate) dates.push(new Date(milestones.afceSubmittedDate).getTime());
    if (milestones.afceApprovedDate) dates.push(new Date(milestones.afceApprovedDate).getTime());
    if (milestones.bastDate) dates.push(new Date(milestones.bastDate).getTime());

    // Parse package dates
    packages.forEach((pkg) => {
      if (pkg.planStartDate) dates.push(new Date(pkg.planStartDate).getTime());
      if (pkg.planEndDate) dates.push(new Date(pkg.planEndDate).getTime());
      if (pkg.actualStartDate) dates.push(new Date(pkg.actualStartDate).getTime());
      if (pkg.actualEndDate) dates.push(new Date(pkg.actualEndDate).getTime());
    });

    const now = new Date();
    dates.push(now.getTime());

    // Tentukan min dan max
    let minTs = dates.length > 0 ? Math.min(...dates) : now.getTime();
    let maxTs = dates.length > 0 ? Math.max(...dates) : now.getTime();

    // Berikan padding 7 hari sebelum & sesudah
    const padBefore = 7 * 24 * 60 * 60 * 1000;
    const padAfter = 14 * 24 * 60 * 60 * 1000;
    minTs -= padBefore;
    maxTs += padAfter;

    // Pastikan minimal rentang 30 hari
    if (maxTs - minTs < 30 * 24 * 60 * 60 * 1000) {
      maxTs = minTs + 30 * 24 * 60 * 60 * 1000;
    }

    const min = new Date(minTs);
    min.setHours(0, 0, 0, 0);
    const max = new Date(maxTs);
    max.setHours(23, 59, 59, 999);

    const diffDays = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / (24 * 60 * 60 * 1000)));

    // Generate Ticks (Mingguan atau Bulanan)
    const ticks: { label: string; subLabel: string; offsetPct: number }[] = [];
    const curr = new Date(min);

    if (zoomMode === "week") {
      // Step per 7 hari
      while (curr <= max) {
        const offsetPct = ((curr.getTime() - min.getTime()) / (diffDays * 24 * 60 * 60 * 1000)) * 100;
        const weekNum = Math.ceil(
          (curr.getTime() - min.getTime()) / (7 * 24 * 60 * 60 * 1000)
        ) + 1;
        ticks.push({
          label: `Minggu ${weekNum}`,
          subLabel: curr.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
          offsetPct: Math.min(100, Math.max(0, offsetPct)),
        });
        curr.setDate(curr.getDate() + 7);
      }
    } else {
      // Step per 1 bulan
      curr.setDate(1);
      while (curr <= max) {
        const offsetPct = ((curr.getTime() - min.getTime()) / (diffDays * 24 * 60 * 60 * 1000)) * 100;
        ticks.push({
          label: curr.toLocaleDateString("id-ID", { month: "long" }),
          subLabel: curr.getFullYear().toString(),
          offsetPct: Math.min(100, Math.max(0, offsetPct)),
        });
        curr.setMonth(curr.getMonth() + 1);
      }
    }

    // Hari Ini offset
    const todayTs = now.getTime();
    let todayPct: number | null = null;
    if (todayTs >= min.getTime() && todayTs <= max.getTime()) {
      todayPct = ((todayTs - min.getTime()) / (diffDays * 24 * 60 * 60 * 1000)) * 100;
    }

    return {
      minDate: min,
      maxDate: max,
      totalDays: diffDays,
      timeTicks: ticks,
      todayOffsetPct: todayPct,
    };
  }, [packages, milestones, zoomMode]);

  // 2. Helper untuk menghitung posisi bar
  const getBarPosition = (startDateRaw?: string | Date | null, endDateRaw?: string | Date | null) => {
    if (!startDateRaw || !endDateRaw) return null;
    const s = new Date(startDateRaw).getTime();
    const e = new Date(endDateRaw).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return null;

    const minTs = minDate.getTime();
    const totalMs = totalDays * 24 * 60 * 60 * 1000;

    const leftPct = Math.max(0, Math.min(100, ((s - minTs) / totalMs) * 100));
    const rightPct = Math.max(0, Math.min(100, ((e - minTs) / totalMs) * 100));
    const widthPct = Math.max(1.2, rightPct - leftPct);

    return { leftPct, widthPct };
  };

  // 3. Memoize Milestone Pins
  const milestonePins = useMemo(() => {
    const list: {
      id: string;
      title: string;
      date: Date;
      offsetPct: number;
      color: string;
      badgeClass: string;
    }[] = [];

    const minTs = minDate.getTime();
    const totalMs = totalDays * 24 * 60 * 60 * 1000;

    const addPin = (
      id: string,
      title: string,
      dateRaw: string | Date | null | undefined,
      color: string,
      badgeClass: string
    ) => {
      if (!dateRaw) return;
      const d = new Date(dateRaw);
      if (isNaN(d.getTime())) return;
      const offsetPct = ((d.getTime() - minTs) / totalMs) * 100;
      if (offsetPct >= 0 && offsetPct <= 100) {
        list.push({ id, title, date: d, offsetPct, color, badgeClass });
      }
    };

    addPin(
      "target-start",
      "Mulai Target Proyek",
      milestones.targetStartDate,
      "text-emerald-600 dark:text-emerald-400 border-emerald-500",
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300"
    );
    addPin(
      "target-end",
      "Target Selesai Proyek",
      milestones.targetEndDate,
      "text-amber-600 dark:text-amber-400 border-amber-500",
      "bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300"
    );
    addPin(
      "afce-submit",
      "Submit AR",
      milestones.afceSubmittedDate,
      "text-sky-600 dark:text-sky-400 border-sky-500",
      "bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300"
    );
    addPin(
      "afce-approve",
      "AR Disetujui",
      milestones.afceApprovedDate,
      "text-indigo-600 dark:text-indigo-400 border-indigo-500",
      "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300"
    );
    addPin(
      "bast-date",
      "Milestone BAST",
      milestones.bastDate,
      "text-purple-600 dark:text-purple-400 border-purple-500",
      "bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300"
    );

    return list;
  }, [milestones, minDate, totalDays]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header Bar Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Jadwal & Visualisasi Gantt Paket Kerja
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Rentang: {formatDate(minDate.toISOString())} s/d {formatDate(maxDate.toISOString())} ({totalDays} hari)
            </p>
          </div>
        </div>

        {/* Legend & Zoom Control */}
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-xs border-2 border-sky-500 bg-sky-500/10 dark:bg-sky-500/20" />
            <span className="text-muted-foreground">Rencana (Border)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-xs bg-sky-600 dark:bg-sky-500" />
            <span className="text-muted-foreground">Realisasi (Fill)</span>
          </div>
          {todayOffsetPct !== null && (
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-1 bg-rose-500 rounded-full" />
              <span className="text-rose-600 dark:text-rose-400 font-medium">Hari Ini</span>
            </div>
          )}

          <div className="flex items-center rounded-md border border-border bg-background p-0.5">
            <Button
              size="sm"
              variant={zoomMode === "week" ? "secondary" : "ghost"}
              onClick={() => setZoomMode("week")}
              className="h-6 px-2 text-[10px]"
            >
              Mingguan
            </Button>
            <Button
              size="sm"
              variant={zoomMode === "month" ? "secondary" : "ghost"}
              onClick={() => setZoomMode("month")}
              className="h-6 px-2 text-[10px]"
            >
              Bulanan
            </Button>
          </div>
        </div>
      </div>

      {/* Main Gantt Canvas with Horizontal Scroll */}
      <div className="relative border border-border rounded-lg bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto select-none">
          <div className="min-w-[840px] md:min-w-[1000px]">
            {/* Header Timeline Grid */}
            <div className="flex border-b border-border bg-muted/50 text-[11px] font-medium sticky top-0 z-30">
              {/* Sticky Left Column Header */}
              <div className="w-64 md:w-72 shrink-0 p-2.5 border-r border-border bg-muted/60 sticky left-0 z-40 flex items-center justify-between backdrop-blur-xs">
                <span>Paket Kerja (Bobot)</span>
                <span className="text-[10px] text-muted-foreground">Progres</span>
              </div>

              {/* Time Scale Columns Header */}
              <div className="flex-1 relative h-12">
                {timeTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/60 pl-1.5 py-1 flex flex-col justify-center leading-tight overflow-hidden"
                    style={{ left: `${tick.offsetPct}%` }}
                  >
                    <span className="font-semibold text-foreground/90 text-[10px] truncate whitespace-nowrap">
                      {tick.label}
                    </span>
                    {tick.subLabel ? (
                      <span className="text-[9px] text-muted-foreground truncate whitespace-nowrap">
                        {tick.subLabel}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones Top Strip */}
            {milestonePins.length > 0 && (
              <div className="flex border-b border-border/80 bg-muted/20 text-[10px] py-1 relative min-h-[30px]">
                <div className="w-64 md:w-72 shrink-0 px-2.5 border-r border-border bg-card sticky left-0 z-20 flex items-center gap-1.5 text-muted-foreground font-medium">
                  <Milestone className="h-3.5 w-3.5 text-primary" />
                  <span>Milestone Proyek</span>
                </div>
                <div className="flex-1 relative">
                  {milestonePins.map((pin) => (
                    <div
                      key={pin.id}
                      className="absolute top-0.5 -translate-x-1/2 flex items-center z-20"
                      style={{ left: `${pin.offsetPct}%` }}
                    >
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "cursor-pointer px-1.5 py-0.5 rounded-full border text-[9px] font-semibold whitespace-nowrap shadow-2xs flex items-center gap-1",
                                pin.badgeClass
                              )}
                            >
                              <Flag className="h-2.5 w-2.5 shrink-0" />
                              <span className="max-w-[85px] truncate">{pin.title}</span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            <p className="font-semibold">{pin.title}</p>
                            <p className="text-muted-foreground">{formatDate(pin.date.toISOString())}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gantt Body: Rows per Package */}
            <div className="relative divide-y divide-border/60">
              {/* Vertical Tick Lines Across the Body */}
              <div className="absolute inset-0 pointer-events-none flex">
                <div className="w-64 md:w-72 shrink-0 border-r border-border" />
                <div className="flex-1 relative h-full">
                  {timeTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-border/30"
                      style={{ left: `${tick.offsetPct}%` }}
                    />
                  ))}

                  {/* Marker Garis "Hari Ini" */}
                  {todayOffsetPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 z-20 border-l-2 border-dashed border-rose-500/80 pointer-events-none"
                      style={{ left: `${todayOffsetPct}%` }}
                    >
                      <div className="sticky top-12 -translate-x-1/2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                        Hari Ini
                      </div>
                    </div>
                  )}

                  {/* Milestone Vertical Lines */}
                  {milestonePins.map((pin) => (
                    <div
                      key={pin.id}
                      className="absolute top-0 bottom-0 z-10 border-l border-dotted border-border/80 pointer-events-none"
                      style={{ left: `${pin.offsetPct}%` }}
                    />
                  ))}
                </div>
              </div>

              {packages.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Belum ada paket kerja pengadaan yang didaftarkan.
                </div>
              ) : (
                packages.map((pkg) => {
                  const planPos = getBarPosition(pkg.planStartDate, pkg.planEndDate);
                  const actualPos = getBarPosition(
                    pkg.actualStartDate,
                    pkg.actualEndDate || new Date()
                  );

                  return (
                    <div
                      key={pkg.id}
                      className="flex items-center min-h-[58px] hover:bg-muted/20 transition-colors group relative"
                    >
                      {/* Sticky Left Column */}
                      <div className="w-64 md:w-72 shrink-0 p-2.5 border-r border-border bg-card group-hover:bg-muted/30 sticky left-0 z-20 transition-colors">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-foreground truncate max-w-[170px]" title={pkg.packageName}>
                            {pkg.packageName}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-primary">
                            {Math.round(pkg.progressPct)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase font-mono">
                            {pkg.category}
                          </Badge>
                          <span>Bobot: {pkg.weightPct}%</span>
                        </div>
                      </div>

                      {/* Timeline Bars Track */}
                      <div className="flex-1 relative h-[58px] flex flex-col justify-center px-1 gap-1.5">
                        {/* Bar Rencana: Border Accent */}
                        {planPos ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute h-[18px] top-[9px] rounded-sm border-2 border-sky-500 bg-sky-500/15 dark:bg-sky-500/25 flex items-center px-1.5 overflow-hidden transition-all hover:brightness-105 z-10 cursor-pointer"
                                  style={{
                                    left: `${planPos.leftPct}%`,
                                    width: `${planPos.widthPct}%`,
                                  }}
                                >
                                  <span className="text-[9px] font-medium text-sky-800 dark:text-sky-200 truncate">
                                    Rencana: {formatDate(pkg.planStartDate)} s/d {formatDate(pkg.planEndDate)}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p className="font-bold text-sky-600 dark:text-sky-400">Jadwal Rencana Paket</p>
                                <p>Mulai: {formatDate(pkg.planStartDate)}</p>
                                <p>Selesai: {formatDate(pkg.planEndDate)}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <div className="absolute top-[10px] left-3 text-[10px] text-muted-foreground/60 italic">
                            Jadwal rencana belum ditentukan
                          </div>
                        )}

                        {/* Bar Realisasi: Fill Accent */}
                        {actualPos ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute h-[18px] bottom-[9px] rounded-sm bg-sky-600 dark:bg-sky-500 text-white dark:text-slate-950 flex items-center px-1.5 overflow-hidden shadow-2xs transition-all hover:brightness-110 z-10 cursor-pointer"
                                  style={{
                                    left: `${actualPos.leftPct}%`,
                                    width: `${actualPos.widthPct}%`,
                                  }}
                                >
                                  <span className="text-[9px] font-bold truncate">
                                    Realisasi: {Math.round(pkg.progressPct)}%
                                    {pkg.actualEndDate ? ` (Selesai)` : ` (Berjalan)`}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p className="font-bold text-emerald-600 dark:text-emerald-400">Realisasi Lapangan</p>
                                <p>Mulai: {formatDate(pkg.actualStartDate)}</p>
                                <p>
                                  {pkg.actualEndDate
                                    ? `Selesai: ${formatDate(pkg.actualEndDate)}`
                                    : `Progres Berjalan s/d Hari Ini`}
                                </p>
                                <p className="font-mono tabular-nums">Capaian: {pkg.progressPct}%</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          pkg.planStartDate && (
                            <div className="absolute bottom-[10px] left-3 text-[10px] text-muted-foreground/60 italic">
                              Realisasi belum dimulai
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
