"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React, { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SCurvePackage {
  id: string;
  packageName: string;
  weightPct: number;
}

export interface SCurveLog {
  id: string;
  workPackageId: string;
  weekNo: number;
  progressPct: number;
  logDate: string | Date;
}

interface ProjectSCurveChartProps {
  targetStartDate?: string | Date | null;
  targetEndDate?: string | Date | null;
  currentWeek?: number;
  packages: SCurvePackage[];
  logs: SCurveLog[];
  className?: string;
}

interface ChartDataPoint {
  week: string;
  weekNo: number;
  rencanaKumulatif: number;
  realisasiKumulatif: number | null;
  deviasi: number | null;
}

export function ProjectSCurveChart({
  targetStartDate,
  targetEndDate,
  currentWeek = 1,
  packages,
  logs,
  className,
}: ProjectSCurveChartProps) {
  // Hitung rentang minggu dan data titik kurva S
  const { chartData, currentPlanPct, currentActualPct, variancePct } = useMemo(() => {
    // 1. Tentukan estimasi total minggu
    let weeksCount = 12; // default fallback

    if (targetStartDate && targetEndDate) {
      const s = new Date(targetStartDate).getTime();
      const e = new Date(targetEndDate).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) {
        const diffWeeks = Math.ceil((e - s) / (7 * 24 * 60 * 60 * 1000));
        weeksCount = Math.max(4, diffWeeks);
      }
    }

    // Periksa jika log tertinggi melebihi estimasi
    const maxLogWeek = logs.reduce((max, l) => Math.max(max, l.weekNo), 0);
    const activeCurrentWeek = Math.max(1, currentWeek, maxLogWeek);
    const finalTotalWeeks = Math.max(weeksCount, activeCurrentWeek);

    // 2. Petakan log per paket per minggu
    // logsByPackage: Map<wpId, Map<weekNo, progressPct>>
    const logsByPackage = new Map<string, Map<number, number>>();
    logs.forEach((log) => {
      if (!logsByPackage.has(log.workPackageId)) {
        logsByPackage.set(log.workPackageId, new Map());
      }
      logsByPackage.get(log.workPackageId)!.set(log.weekNo, log.progressPct);
    });

    const data: ChartDataPoint[] = [];

    // Titik awal Minggu 0
    data.push({
      week: "M-0",
      weekNo: 0,
      rencanaKumulatif: 0,
      realisasiKumulatif: 0,
      deviasi: 0,
    });

    // Hitung tiap minggu dari 1 s/d finalTotalWeeks
    for (let w = 1; w <= finalTotalWeeks; w++) {
      // Kurva Rencana Linear Kumulatif: akumulasi proporsional 0 s/d 100%
      const planPct = Math.min(100, Math.round(((w / finalTotalWeeks) * 100) * 10) / 10);

      // Kurva Realisasi Kumulatif Tertimbang:
      // Hanya dihitung sampai minggu berjalan (w <= activeCurrentWeek)
      let actualPct: number | null = null;
      let dev: number | null = null;

      if (w <= activeCurrentWeek) {
        let weightedSum = 0;
        let totalWeight = 0;

        packages.forEach((pkg) => {
          totalWeight += pkg.weightPct;
          const pkgLogs = logsByPackage.get(pkg.id);

          // Cari progres terakhir dari minggu 1 s/d w
          let latestProg = 0;
          if (pkgLogs) {
            for (let checkW = w; checkW >= 1; checkW--) {
              if (pkgLogs.has(checkW)) {
                latestProg = pkgLogs.get(checkW)!;
                break;
              }
            }
          }

          weightedSum += (latestProg * pkg.weightPct) / 100;
        });

        // Normalisasi jika total bobot tidak persis 100%
        const normalizedSum =
          totalWeight > 0 ? (weightedSum / (totalWeight / 100)) : weightedSum;

        actualPct = Math.min(100, Math.round(normalizedSum * 10) / 10);
        dev = Math.round((actualPct - planPct) * 10) / 10;
      }

      data.push({
        week: `M-${w}`,
        weekNo: w,
        rencanaKumulatif: planPct,
        realisasiKumulatif: actualPct,
        deviasi: dev,
      });
    }

    // Statistik Terkini pada activeCurrentWeek
    const currentPoint = data.find((d) => d.weekNo === activeCurrentWeek);
    const planNow = currentPoint?.rencanaKumulatif ?? 0;
    const actualNow = currentPoint?.realisasiKumulatif ?? 0;
    const diffNow = Math.round((actualNow - planNow) * 10) / 10;

    return {
      chartData: data,
      totalWeeks: finalTotalWeeks,
      currentPlanPct: planNow,
      currentActualPct: actualNow,
      variancePct: diffNow,
    };
  }, [targetStartDate, targetEndDate, currentWeek, packages, logs]);

  return (
    <Card className={cn("border-border shadow-xs", className)}>
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Kurva S: Rencana Linear vs Realisasi Tertimbang
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Perbandingan kumulatif progres rencana dan akumulasi log lapangan mingguan.
            </p>
          </div>

          {/* Quick Metrics KPI */}
          <div className="flex items-center gap-3 text-xs">
            <div className="border border-border rounded-md px-2.5 py-1 bg-muted/20">
              <span className="text-muted-foreground text-[10px]">Rencana (M-{currentWeek}): </span>
              <span className="font-bold font-mono tabular-nums text-foreground">
                {currentPlanPct}%
              </span>
            </div>
            <div className="border border-border rounded-md px-2.5 py-1 bg-muted/20">
              <span className="text-muted-foreground text-[10px]">Realisasi (M-{currentWeek}): </span>
              <span className="font-bold font-mono tabular-nums text-primary">
                {currentActualPct}%
              </span>
            </div>
            <div className="border border-border rounded-md px-2.5 py-1 bg-muted/20">
              <span className="text-muted-foreground text-[10px]">Deviasi: </span>
              <span
                className={cn(
                  "font-bold font-mono tabular-nums",
                  variancePct >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : variancePct >= -5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {variancePct > 0 ? `+${variancePct}` : variancePct}%
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="w-full h-[320px] select-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/70"
                vertical={false}
              />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground font-mono"
                unit="%"
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload as ChartDataPoint;

                  return (
                    <div className="rounded-lg border border-border bg-card p-2.5 shadow-md text-xs space-y-1.5 min-w-[170px]">
                      <div className="font-semibold text-foreground border-b border-border pb-1 flex items-center justify-between">
                        <span>Minggu {data.week}</span>
                        {data.weekNo === currentWeek && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-normal">
                            Minggu Berjalan
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sky-600 dark:text-sky-400">
                        <span>Rencana:</span>
                        <span className="font-mono tabular-nums font-bold">
                          {data.rencanaKumulatif}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                        <span>Realisasi:</span>
                        <span className="font-mono tabular-nums font-bold">
                          {data.realisasiKumulatif !== null
                            ? `${data.realisasiKumulatif}%`
                            : "Belum tercatat"}
                        </span>
                      </div>
                      {data.deviasi !== null && (
                        <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/60">
                          <span className="text-muted-foreground">Deviasi:</span>
                          <span
                            className={cn(
                              "font-mono tabular-nums font-semibold",
                              data.deviasi >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {data.deviasi > 0 ? `+${data.deviasi}` : data.deviasi}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                iconType="plainline"
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground font-medium">
                    {value === "rencanaKumulatif"
                      ? "Rencana Kumulatif (%)"
                      : "Realisasi Kumulatif Tertimbang (%)"}
                  </span>
                )}
              />
              {/* Garis Rencana Linear: Border Accent / Sky token (Dashed) */}
              <Line
                type="monotone"
                dataKey="rencanaKumulatif"
                name="rencanaKumulatif"
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: "#0ea5e9" }}
                activeDot={{ r: 5 }}
              />
              {/* Garis Realisasi Tertimbang: Hijau Perkebunan #16A34A (Solid) */}
              <Line
                type="monotone"
                dataKey="realisasiKumulatif"
                name="realisasiKumulatif"
                stroke="#16a34a"
                strokeWidth={3}
                connectNulls={false}
                dot={{ r: 4, fill: "#16a34a" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
