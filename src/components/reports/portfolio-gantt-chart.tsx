"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PROJECT_STATUS_CONFIG,
  STATUS_INDICATOR_CONFIG,
} from "@/lib/constants/status";
import { cn, formatDate } from "@/lib/utils";
import { ProjectStatus, StatusIndicator } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Calendar,
  Layers,
  MapPin,
  Search,
} from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";

export interface PortfolioProjectItem {
  id: string;
  projectCode: string;
  projectName: string;
  displayName: string;
  status: ProjectStatus;
  statusIndicator: StatusIndicator;
  progressPct: number;
  targetStartDate: string | null;
  targetEndDate: string | null;
  company: { id: string; code: string; name: string };
  estate: { id: string; code: string; name: string };
}

interface PortfolioGanttChartProps {
  initialProjects?: PortfolioProjectItem[];
  title?: string;
  description?: string;
  className?: string;
}

export function PortfolioGanttChart({
  initialProjects,
  title = "Timeline Portofolio Proyek",
  description = "Visualisasi jadwal pelaksanaan seluruh proyek aktif dalam satu garis waktu horizontal.",
  className,
}: PortfolioGanttChartProps) {
  const [search, setSearch] = useState("");
  const [selectedIndicator, setSelectedIndicator] = useState<string>("ALL");
  const [activeOnly, setActiveOnly] = useState(true);

  // Fetch data proyek jika tidak disediakan via props
  const { data: fetchedData, isLoading } = useQuery({
    queryKey: ["portfolio-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects?pageSize=100&sort=targetStartDate");
      if (!res.ok) throw new Error("Gagal mengambil data proyek");
      const json = await res.json();
      return json.data as PortfolioProjectItem[];
    },
    enabled: !initialProjects,
  });

  const rawProjects = useMemo(
    () => initialProjects || fetchedData || [],
    [initialProjects, fetchedData]
  );

  // 1. Filter Proyek
  const filteredProjects = useMemo(() => {
    return rawProjects.filter((p) => {
      // Filter status aktif
      if (activeOnly && (p.status === ProjectStatus.COMPLETED || p.status === ProjectStatus.CANCELLED)) {
        return false;
      }
      // Filter status indicator
      if (selectedIndicator !== "ALL" && p.statusIndicator !== selectedIndicator) {
        return false;
      }
      // Filter search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCode = p.projectCode.toLowerCase().includes(q);
        const matchName = p.projectName.toLowerCase().includes(q);
        const matchCompany = p.company.code.toLowerCase().includes(q);
        const matchEstate = p.estate.code.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCompany && !matchEstate) return false;
      }
      return true;
    });
  }, [rawProjects, activeOnly, selectedIndicator, search]);

  // 2. Memoize Boundaries & Scale Timeline (Desktop)
  const { minDate, totalDays, timeTicks, todayOffsetPct } = useMemo(() => {
    const dates: number[] = [];
    const now = new Date();
    dates.push(now.getTime());

    filteredProjects.forEach((p) => {
      if (p.targetStartDate) dates.push(new Date(p.targetStartDate).getTime());
      if (p.targetEndDate) dates.push(new Date(p.targetEndDate).getTime());
    });

    let minTs = Math.min(...dates);
    let maxTs = Math.max(...dates);

    // Padding 14 hari
    minTs -= 14 * 24 * 60 * 60 * 1000;
    maxTs += 21 * 24 * 60 * 60 * 1000;

    // Minimal 60 hari
    if (maxTs - minTs < 60 * 24 * 60 * 60 * 1000) {
      maxTs = minTs + 60 * 24 * 60 * 60 * 1000;
    }

    const min = new Date(minTs);
    min.setDate(1); // Mulai dari awal bulan
    min.setHours(0, 0, 0, 0);

    const max = new Date(maxTs);
    max.setHours(23, 59, 59, 999);

    const diffDays = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / (24 * 60 * 60 * 1000)));

    // Generate Month Ticks
    const ticks: { label: string; offsetPct: number }[] = [];
    const curr = new Date(min);

    while (curr <= max) {
      const offsetPct = ((curr.getTime() - min.getTime()) / (diffDays * 24 * 60 * 60 * 1000)) * 100;
      ticks.push({
        label: curr.toLocaleDateString("id-ID", { month: "short", year: "numeric" }),
        offsetPct: Math.min(100, Math.max(0, offsetPct)),
      });
      curr.setMonth(curr.getMonth() + 1);
    }

    // Offset Hari Ini
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
  }, [filteredProjects]);

  // 3. Helper Posisi Bar Proyek
  const getProjectBarPos = (startRaw: string | null, endRaw: string | null) => {
    if (!startRaw || !endRaw) return null;
    const s = new Date(startRaw).getTime();
    const e = new Date(endRaw).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return null;

    const minTs = minDate.getTime();
    const totalMs = totalDays * 24 * 60 * 60 * 1000;

    const leftPct = Math.max(0, Math.min(100, ((s - minTs) / totalMs) * 100));
    const rightPct = Math.max(0, Math.min(100, ((e - minTs) / totalMs) * 100));
    const widthPct = Math.max(2, rightPct - leftPct);

    return { leftPct, widthPct };
  };

  // Helper Warna Bar berdasarkan StatusIndicator semantik
  const getIndicatorBarClass = (indicator: StatusIndicator) => {
    switch (indicator) {
      case StatusIndicator.ON_TRACK:
        return "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20";
      case StatusIndicator.AT_RISK:
        return "bg-amber-500 hover:bg-amber-600 text-slate-950 dark:text-white shadow-amber-500/20";
      case StatusIndicator.DELAYED:
        return "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20";
      case StatusIndicator.COMPLETED:
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20";
      default:
        return "bg-sky-500 text-white";
    }
  };

  if (isLoading && !initialProjects) {
    return (
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-56 mb-1" />
          <Skeleton className="h-3 w-80" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Layers className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>

          {/* Filter Bar Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-44 md:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari kode/nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center rounded-md border border-border bg-background p-0.5">
              <Button
                size="sm"
                variant={selectedIndicator === "ALL" ? "secondary" : "ghost"}
                onClick={() => setSelectedIndicator("ALL")}
                className="h-7 px-2 text-[11px]"
              >
                Semua
              </Button>
              <Button
                size="sm"
                variant={selectedIndicator === StatusIndicator.ON_TRACK ? "secondary" : "ghost"}
                onClick={() => setSelectedIndicator(StatusIndicator.ON_TRACK)}
                className="h-7 px-2 text-[11px] text-emerald-600 dark:text-emerald-400"
              >
                On Track
              </Button>
              <Button
                size="sm"
                variant={selectedIndicator === StatusIndicator.AT_RISK ? "secondary" : "ghost"}
                onClick={() => setSelectedIndicator(StatusIndicator.AT_RISK)}
                className="h-7 px-2 text-[11px] text-amber-600 dark:text-amber-400"
              >
                At Risk
              </Button>
              <Button
                size="sm"
                variant={selectedIndicator === StatusIndicator.DELAYED ? "secondary" : "ghost"}
                onClick={() => setSelectedIndicator(StatusIndicator.DELAYED)}
                className="h-7 px-2 text-[11px] text-rose-600 dark:text-rose-400"
              >
                Delayed
              </Button>
            </div>

            <Button
              size="sm"
              variant={activeOnly ? "default" : "outline"}
              onClick={() => setActiveOnly(!activeOnly)}
              className="h-8 text-xs font-medium"
            >
              {activeOnly ? "Hanya Aktif" : "Semua Status"}
            </Button>
          </div>
        </div>

        {/* Legend Toolbar */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-2">
          <span className="text-muted-foreground text-[11px] font-medium">Status SLA:</span>
          {Object.entries(STATUS_INDICATOR_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5 text-[11px]">
              <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
              <span className="text-muted-foreground">{config.label}</span>
            </div>
          ))}
          {todayOffsetPct !== null && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2.5 w-1 bg-rose-500 rounded-full" />
              <span className="text-rose-600 dark:text-rose-400 font-medium">Hari Ini</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* ========================================================
            1. DESKTOP VIEW (>= md): Full Horizontal Gantt Timeline
           ======================================================== */}
        <div className="hidden md:block overflow-x-auto select-none">
          <div className="min-w-[950px]">
            {/* Header Timeline Columns */}
            <div className="flex border-b border-border bg-muted/40 text-[11px] font-medium sticky top-0 z-30">
              {/* Sticky Column Kiri: Info Proyek */}
              <div className="w-80 shrink-0 p-2.5 border-r border-border bg-muted/60 sticky left-0 z-40 flex items-center justify-between backdrop-blur-xs">
                <span>Proyek & Lokasi</span>
                <span className="text-[10px] text-muted-foreground">Progres / SLA</span>
              </div>

              {/* Time Month Columns Header */}
              <div className="flex-1 relative h-9">
                {timeTicks.map((tick, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/70 pl-2 pt-1.5 text-[11px] font-semibold text-foreground/80"
                    style={{ left: `${tick.offsetPct}%` }}
                  >
                    {tick.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Body Rows per Proyek */}
            <div className="relative divide-y divide-border/60">
              {/* Background Tick Lines */}
              <div className="absolute inset-0 pointer-events-none flex">
                <div className="w-80 shrink-0 border-r border-border" />
                <div className="flex-1 relative h-full">
                  {timeTicks.map((tick, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-border/30"
                      style={{ left: `${tick.offsetPct}%` }}
                    />
                  ))}

                  {/* Marker Hari Ini */}
                  {todayOffsetPct !== null && (
                    <div
                      className="absolute top-0 bottom-0 z-20 border-l-2 border-dashed border-rose-500/80 pointer-events-none"
                      style={{ left: `${todayOffsetPct}%` }}
                    >
                      <div className="sticky top-1 -translate-x-1/2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                        Hari Ini
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  Tidak ada data proyek yang sesuai kriteria pencarian.
                </div>
              ) : (
                filteredProjects.map((p) => {
                  const barPos = getProjectBarPos(p.targetStartDate, p.targetEndDate);
                  const indCfg = STATUS_INDICATOR_CONFIG[p.statusIndicator];
                  const barClass = getIndicatorBarClass(p.statusIndicator);

                  return (
                    <div
                      key={p.id}
                      className="flex items-center min-h-[46px] hover:bg-muted/20 transition-colors group relative"
                    >
                      {/* Sticky Left Info Column */}
                      <div className="w-80 shrink-0 p-2 border-r border-border bg-card group-hover:bg-muted/30 sticky left-0 z-20 transition-colors flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                              {p.projectCode}
                            </span>
                            <span className={cn("h-1.5 w-1.5 rounded-full", indCfg.dotClass)} />
                          </div>
                          <Link
                            href={`/projects/${p.id}`}
                            className="font-medium text-xs text-foreground hover:text-primary transition-colors truncate block"
                            title={p.projectName}
                          >
                            {p.projectName}
                          </Link>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {p.company.code} - {p.estate.code}
                          </div>
                        </div>

                        {/* Progres Mini Box */}
                        <div className="text-right shrink-0">
                          <span className="font-mono tabular-nums text-xs font-bold text-foreground">
                            {Math.round(p.progressPct)}%
                          </span>
                        </div>
                      </div>

                      {/* Bar Track */}
                      <div className="flex-1 relative h-[46px] flex items-center px-1">
                        {barPos ? (
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  href={`/projects/${p.id}`}
                                  className={cn(
                                    "absolute h-6 rounded-md shadow-xs flex items-center px-2 transition-all hover:scale-[1.01] hover:brightness-105 z-10 cursor-pointer overflow-hidden text-[10px] font-semibold",
                                    barClass
                                  )}
                                  style={{
                                    left: `${barPos.leftPct}%`,
                                    width: `${barPos.widthPct}%`,
                                  }}
                                >
                                  <span className="truncate">
                                    {Math.round(p.progressPct)}% • {indCfg.label}
                                  </span>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs space-y-1">
                                <p className="font-bold text-foreground">{p.projectName}</p>
                                <p className="text-muted-foreground font-mono">{p.projectCode}</p>
                                <div className="border-t border-border pt-1">
                                  <p>Target: {formatDate(p.targetStartDate)} s/d {formatDate(p.targetEndDate)}</p>
                                  <p>Progres: <span className="font-mono font-bold">{p.progressPct}%</span></p>
                                  <p className="flex items-center gap-1 mt-0.5">
                                    <span>Status EWS:</span>
                                    <span className="font-semibold">{indCfg.label}</span>
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 italic pl-3">
                            Target jadwal belum ditentukan
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            2. MOBILE VIEW (< md): Card List with Progress Bars
            (Docs/design.md §6: fallback kartu per baris di mobile)
           ======================================================== */}
        <div className="block md:hidden divide-y divide-border/80">
          {filteredProjects.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs">
              Tidak ada data proyek yang sesuai.
            </div>
          ) : (
            filteredProjects.map((p) => {
              const indCfg = STATUS_INDICATOR_CONFIG[p.statusIndicator];
              const statusCfg = PROJECT_STATUS_CONFIG[p.status];

              return (
                <div key={p.id} className="p-3.5 space-y-2.5 bg-card hover:bg-muted/30 transition-colors">
                  {/* Top Bar: Code & Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {p.projectCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-2 py-0 border", indCfg.badgeClass)}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full mr-1", indCfg.dotClass)} />
                        {indCfg.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-2 py-0 border", statusCfg.badgeClass)}
                      >
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Project Title & Location */}
                  <div>
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-semibold text-sm text-foreground hover:text-primary transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{p.projectName}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{p.company.code} - {p.estate.code}</span>
                    </p>
                  </div>

                  {/* Target Dates */}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDate(p.targetStartDate)} s/d {formatDate(p.targetEndDate)}
                    </span>
                  </div>

                  {/* Progress Bar Visual */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">Progres Fisik</span>
                      <span className="font-mono tabular-nums font-bold text-foreground">
                        {Math.round(p.progressPct * 10) / 10}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          p.statusIndicator === StatusIndicator.ON_TRACK
                            ? "bg-emerald-500"
                            : p.statusIndicator === StatusIndicator.AT_RISK
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(0, p.progressPct))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
