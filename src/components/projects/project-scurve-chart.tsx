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
  planStartDate?: string | Date | null;
  planEndDate?: string | Date | null;
  revisedEndDate?: string | Date | null;
}

export interface SCurveLog {
  id: string;
  workPackageId: string;
  weekNo: number;
  progressPct: number;
  logDate: string | Date;
}

export interface SCurveAfceInfo {
  status?: string | null;
  currentAttempt?: number;
  emailSubmittedDate?: string | Date | null;
  mcaApprovalDate?: string | Date | null;
  approvals?: Array<{
    role: string;
    status: string;
    approvalLevel?: number;
    attemptNo?: number;
    notes?: string | null;
    approvedAt?: string | Date | null;
  }> | null;
}

interface ProjectSCurveChartProps {
  targetStartDate?: string | Date | null;
  targetEndDate?: string | Date | null;
  revisedEndDate?: string | Date | null;
  isCompleted?: boolean;
  currentWeek?: number;
  packages: SCurvePackage[];
  logs: SCurveLog[];
  afceDocument?: SCurveAfceInfo | null;
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
  revisedEndDate,
  isCompleted = false,
  currentWeek = 1,
  packages,
  logs,
  afceDocument,
  className,
}: ProjectSCurveChartProps) {
  // Hitung rentang minggu dan data titik kurva S (Bobot: AFCE 5%, Paket Fisik 95%)
  const { chartData, currentPlanPct, currentActualPct, variancePct } = useMemo(() => {
    // Normalisasi hari Senin terdekat (Start of Week) agar sinkron 1:1 dengan Gantt Chart
    const getStartOfWeek = (date: Date): Date => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const day = d.getDay(); // 0 is Sunday, 1 is Monday
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d;
    };

    // 1. Kumpulkan seluruh tanggal relevan (proyek, target revisi, & seluruh paket kerja)
    const dates: number[] = [];
    if (targetStartDate) dates.push(new Date(targetStartDate).getTime());
    if (targetEndDate) dates.push(new Date(targetEndDate).getTime());
    if (revisedEndDate) dates.push(new Date(revisedEndDate).getTime());

    packages.forEach((pkg) => {
      if (pkg.planStartDate) dates.push(new Date(pkg.planStartDate).getTime());
      if (pkg.planEndDate) dates.push(new Date(pkg.planEndDate).getTime());
      if (pkg.revisedEndDate) dates.push(new Date(pkg.revisedEndDate).getTime());
    });

    const nowTs = new Date().getTime();
    const minTs = dates.length > 0 ? Math.min(...dates) : nowTs;
    const maxTs = dates.length > 0 ? Math.max(...dates) : nowTs;

    const startMonday = getStartOfWeek(new Date(minTs));
    const endMonday = getStartOfWeek(new Date(maxTs));

    // Hitung jumlah minggu kalender penuh dari awal hingga batas akhir proyek (sinkron dengan Gantt Chart)
    const diffCalendarDays = Math.round(
      (endMonday.getTime() - startMonday.getTime()) / (24 * 60 * 60 * 1000)
    );
    const calendarWeeksCount = Math.max(1, Math.floor(diffCalendarDays / 7) + 1);

    // Target baseline awal (targetEndDate) berakhir di minggu ke berapa
    const targetEndTs = targetEndDate ? new Date(targetEndDate).getTime() : maxTs;
    const targetEndMonday = getStartOfWeek(new Date(targetEndTs));
    const targetEndWeek = Math.max(
      1,
      Math.floor(
        Math.round((targetEndMonday.getTime() - startMonday.getTime()) / (24 * 60 * 60 * 1000)) / 7
      ) + 1
    );

    // Periksa jika log tertinggi atau currentWeek melebihi kalender dasar
    const maxLogWeek = logs.reduce((max, l) => Math.max(max, l.weekNo), 0);
    const activeCurrentWeek = Math.max(1, currentWeek, maxLogWeek);
    const finalTotalWeeks = Math.max(calendarWeeksCount, activeCurrentWeek, 4);

    // 2. Petakan log per paket per minggu
    // logsByPackage: Map<wpId, Map<weekNo, progressPct>>
    const logsByPackage = new Map<string, Map<number, number>>();
    logs.forEach((log) => {
      if (!logsByPackage.has(log.workPackageId)) {
        logsByPackage.set(log.workPackageId, new Map());
      }
      logsByPackage.get(log.workPackageId)!.set(log.weekNo, log.progressPct);
    });

    // 3. Persiapan Data Approval AFCE (Bobot 5%)
    const activeAttemptNo = afceDocument?.currentAttempt ?? 1;
    const activeApprovals =
      afceDocument?.approvals?.filter((a) => (a.attemptNo ?? 1) === activeAttemptNo) ??
      afceDocument?.approvals ??
      [];
    const requiredApprovals = activeApprovals.filter(
      (a) => a.status !== "TIDAK_PERLU" && a.status !== "NOT_REQUIRED"
    );
    const totalRequired =
      requiredApprovals.length > 0 ? requiredApprovals.length : activeApprovals.length || 1;

    const isDocApproved = afceDocument?.status === "APPROVED";

    let lastApprovedDate: Date | null = null;
    const isSnapshotNotRequired = (a: { status?: string; notes?: string | null }) =>
      a.status === "TIDAK_PERLU" ||
      a.notes === "TIDAK_PERLU" ||
      Boolean(a.notes?.startsWith("[TIDAK_PERLU]"));

    const approvedSnapshots = activeApprovals.filter(
      (a) =>
        a.status === "APPROVED" &&
        !isSnapshotNotRequired(a) &&
        a.approvedAt
    );
    if (approvedSnapshots.length > 0) {
      const latestTs = Math.max(
        ...approvedSnapshots.map((a) => new Date(a.approvedAt!).getTime())
      );
      if (!isNaN(latestTs) && latestTs > 0) {
        lastApprovedDate = new Date(latestTs);
      }
    }
    if (!lastApprovedDate && afceDocument?.mcaApprovalDate) {
      lastApprovedDate = new Date(afceDocument.mcaApprovalDate);
    }

    const getWeekNumber = (date: Date) => {
      const dMonday = getStartOfWeek(date);
      const diff = Math.round((dMonday.getTime() - startMonday.getTime()) / (24 * 60 * 60 * 1000));
      return Math.max(1, Math.floor(diff / 7) + 1);
    };

    const finalApprovalWeekNo = lastApprovedDate ? getWeekNumber(lastApprovedDate) : 1;

    const data: ChartDataPoint[] = [];

    // Titik awal Minggu 0
    data.push({
      week: "M-0",
      weekNo: 0,
      rencanaKumulatif: 0,
      realisasiKumulatif: 0,
      deviasi: 0,
    });

    // Cek apakah proyek secara keseluruhan sudah mencapai 100% atau berstatus COMPLETED
    const latestMaxLog = logs.filter((l) => l.progressPct >= 100);
    const hasReached100 = isCompleted || latestMaxLog.length > 0;

    // Hitung tiap minggu dari 1 s/d finalTotalWeeks
    for (let w = 1; w <= finalTotalWeeks; w++) {
      // A. Rencana (Opsi 1: Baseline rencana awal mencapai 100% pada targetEndWeek, setelah itu tetap 100%):
      // Approval direncanakan 2 minggu: M1 = 2.5%, M2+ = 5.0%
      const afcePlanPct = w === 1 ? 2.5 : 5.0;
      const wpPlanProgress = w >= targetEndWeek ? 95.0 : (w / targetEndWeek) * 95.0;
      const planPct = Math.min(100, Math.round((afcePlanPct + wpPlanProgress) * 10) / 10);

      // B. Realisasi (hanya sampai activeCurrentWeek, atau diteruskan 100% jika proyek sudah selesai):
      let actualPct: number | null = null;
      let dev: number | null = null;

      if (w <= activeCurrentWeek || (hasReached100 && w <= finalTotalWeeks)) {
        // 1) Realisasi Approval (Maks 5%)
        let afceActualPct = 0;
        if (isDocApproved) {
          if (w >= finalApprovalWeekNo) {
            afceActualPct = 5.0;
          } else {
            const approvedBeforeW = requiredApprovals.filter(
              (a) => a.status === "APPROVED" && a.approvedAt && getWeekNumber(new Date(a.approvedAt)) <= w
            );
            afceActualPct = (approvedBeforeW.length / totalRequired) * 5.0;
          }
        } else if (afceDocument?.status === "SUBMITTED") {
          const approvedBeforeW = requiredApprovals.filter(
            (a) => a.status === "APPROVED" && a.approvedAt && getWeekNumber(new Date(a.approvedAt)) <= w
          );
          afceActualPct = (approvedBeforeW.length / totalRequired) * 5.0;
        }

        // 2) Realisasi Paket Fisik (Maks 95%)
        let weightedSum = 0;
        let totalWeight = 0;

        packages.forEach((pkg) => {
          const wPct = Number(pkg.weightPct) || 0;
          totalWeight += wPct;
          const pkgLogs = logsByPackage.get(pkg.id);

          // Cari progres terakhir dari minggu 1 s/d w
          let latestProg = 0;
          if (pkgLogs) {
            for (let checkW = w; checkW >= 1; checkW--) {
              if (pkgLogs.has(checkW)) {
                latestProg = Number(pkgLogs.get(checkW)) || 0;
                break;
              }
            }
          }

          weightedSum += (latestProg * wPct) / 100;
        });

        // Normalisasi progres paket kerja ke porsi 95% bobot total proyek
        // (weightedSum / totalWeight) * 95%
        const normalizedWpSum =
          totalWeight > 0 ? (weightedSum / totalWeight) * 95 : 0;

        actualPct = Math.min(100, Math.round((afceActualPct + normalizedWpSum) * 10) / 10);
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
  }, [
    targetStartDate,
    targetEndDate,
    revisedEndDate,
    isCompleted,
    currentWeek,
    packages,
    logs,
    afceDocument,
  ]);

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
              Akumulasi rencana linear & realisasi (Bobot: Approval AR/AFCE 5%, Paket Kerja Fisik 95%).
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
