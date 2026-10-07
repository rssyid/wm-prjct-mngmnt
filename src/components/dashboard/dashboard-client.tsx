"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

const PortfolioGanttChart = dynamic(
  () =>
    import("@/components/reports/portfolio-gantt-chart").then(
      (m) => m.PortfolioGanttChart
    ),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
    ssr: false,
  }
);
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PROJECT_STATUS_CONFIG,
  STATUS_INDICATOR_CONFIG,
} from "@/lib/constants/status";
import { ProjectStatus, StatusIndicator } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

interface DelayedProjectItem {
  id: string;
  projectCode: string;
  projectName: string;
  displayName: string;
  status: ProjectStatus;
  statusIndicator: StatusIndicator;
  progressPct: number;
  targetStartDate: string | null;
  targetEndDate: string | null;
  updatedAt: string;
  company: { id: string; code: string; name: string };
  estate: { id: string; code: string; name: string };
}

interface DashboardStatsData {
  totalProjects: number;
  activeProjectsCount: number;
  completedProjectsCount: number;
  projectsByStatus: Record<ProjectStatus, number>;
  projectsByIndicator: Record<StatusIndicator, number>;
  topDelayedProjects: DelayedProjectItem[];
  topAtRiskProjects: DelayedProjectItem[];
  procurementSummary: {
    totalPackages: number;
    outstandingPackagesCount: number;
    unpaidPackagesCount: number;
    packagesByStatus: Record<string, number>;
  };
  rejectedArCount: number;
  waitingApprovalCount: number;
  delayedProjectsCount: number;
  atRiskProjectsCount: number;
  onTrackProjectsCount: number;
  holidaysThisYearCount?: number;
  totalPendingNotifications: number;
}

interface DashboardClientProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function DashboardClient({ user }: DashboardClientProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery<{ success: boolean; data: DashboardStatsData }>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) {
        throw new Error("Gagal mengambil data statistik dashboard");
      }
      return res.json();
    },
    refetchInterval: 60000, // 60 detik auto-refresh
  });

  const stats = data?.data;

  // Gabungkan daftar proyek bermasalah (DELAYED terlebih dahulu, lalu AT_RISK)
  const criticalProjects = React.useMemo(() => {
    if (!stats) return [];
    const delayed = stats.topDelayedProjects || [];
    const atRisk = stats.topAtRiskProjects || [];
    // Hindari duplikasi jika ada ID yang sama
    const seen = new Set<string>();
    const combined: DelayedProjectItem[] = [];
    for (const p of [...delayed, ...atRisk]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        combined.push(p);
      }
    }
    return combined;
  }, [stats]);

  const lastUpdatedTime = React.useMemo(() => {
    if (!dataUpdatedAt) return null;
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  return (
    <div className="space-y-6">
      {/* Header & Auto-refresh status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ringkasan Portofolio & Early Warning
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Selamat datang,{" "}
            <span className="font-semibold text-foreground">
              {user?.name || "Pengguna"}
            </span>
            . Pantau progres fisik, SLA hari kerja, dan peringatan dini keterlambatan.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground self-start sm:self-auto">
          {lastUpdatedTime && (
            <span className="hidden sm:inline-block">
              Pembaruan: <span className="font-mono font-medium">{lastUpdatedTime}</span>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-2.5 text-xs gap-1.5"
            title="Muat ulang data statistik sekarang"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`}
            />
            <span>Refresh (60s)</span>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
          Gagal memuat statistik terkini. Sistem akan mencoba kembali secara otomatis dalam 60 detik.
        </div>
      )}

      {/* Peringatan Kalender Libur Kosong */}
      {!isLoading && stats && stats.holidaysThisYearCount === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-sm">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-semibold">Peringatan Kalender Kerja:</span> Master Hari Libur untuk tahun berjalan ({new Date().getFullYear()}) belum terdaftar di sistem. Perhitungan SLA hari kerja perkebunan membutuhkan data kalender libur.
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 hover:bg-amber-200/50">
            <Link href="/master?tab=holiday">
              Isi Hari Libur
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* Loading Skeleton vs KPI Cards */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Baris 1: Kartu KPI EWS & Portofolio Utama */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Proyek Aktif */}
            <Card className="border-border shadow-xs hover:border-border/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Proyek Aktif
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <FolderKanban className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
                  {stats?.activeProjectsCount ?? 0}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Total portofolio:</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {stats?.totalProjects ?? 0} proyek
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* EWS: Terlambat (DELAYED) */}
            <Card className="border-rose-200/80 bg-rose-50/30 dark:border-rose-900/50 dark:bg-rose-950/20 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Terlambat (DELAYED)
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-300">
                  <AlertOctagon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
                  {stats?.delayedProjectsCount ?? 0}
                </div>
                <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-2">
                  Target lewat atau deviasi &gt; 25 poin
                </p>
              </CardContent>
            </Card>

            {/* EWS: Beresiko (AT_RISK) */}
            <Card className="border-amber-200/80 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Berisiko (AT_RISK)
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                  {stats?.atRiskProjectsCount ?? 0}
                </div>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-2">
                  Deviasi progres &gt; 10 poin
                </p>
              </CardContent>
            </Card>

            {/* Sesuai Jadwal (ON_TRACK) */}
            <Card className="border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Sesuai Jadwal
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                  {stats?.onTrackProjectsCount ?? 0}
                </div>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-2">
                  Deviasi $\le$ 10 poin terhadap kalender kerja
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Baris 2: Kartu KPI Pengadaan & Approval AR */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Pengadaan Outstanding */}
            <Card className="border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Paket Pengadaan Outstanding
                </CardTitle>
                <PackageCheck className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {stats?.procurementSummary?.outstandingPackagesCount ?? 0}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>Belum Lunas:</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {stats?.procurementSummary?.unpaidPackagesCount ?? 0} paket
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Menunggu Approval AR */}
            <Card className="border-border shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Menunggu Persetujuan AR
                </CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {stats?.waitingApprovalCount ?? 0}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span>AR Ditolak (Revisi):</span>
                  <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {stats?.rejectedArCount ?? 0} berkas
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Proyek Tuntas */}
            <Card className="border-border shadow-xs sm:col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Proyek Tuntas (COMPLETED)
                </CardTitle>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-foreground">
                  {stats?.completedProjectsCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  BAST terverifikasi &amp; data terkunci (read-only)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Seksi EWS: Daftar Proyek Membutuhkan Perhatian Segera */}
          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-rose-500" />
                  <CardTitle className="text-base font-bold">
                    Peringatan Dini (EWS) — Proyek Membutuhkan Perhatian
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-1">
                  Daftar proyek berstatus DELAYED atau AT_RISK berdasarkan kalkulasi hari kerja kalender minus libur nasional &amp; Minggu.
                </CardDescription>
              </div>

              <Button variant="ghost" size="sm" asChild className="text-xs h-8 gap-1">
                <Link href="/projects?statusIndicator=DELAYED">
                  <span>Lihat Semua di Daftar Proyek</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent>
              {criticalProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed border-border bg-muted/20">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Semua Proyek Sesuai Jadwal
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Saat ini tidak ada proyek aktif yang mengalami keterlambatan kritis (DELAYED) atau berisiko tinggi (AT_RISK).
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Kode Proyek</th>
                        <th className="py-2.5 px-3">Nama &amp; Lokasi</th>
                        <th className="py-2.5 px-3">Status Tahapan</th>
                        <th className="py-2.5 px-3">Indikator EWS</th>
                        <th className="py-2.5 px-3 text-right">Progres Aktual</th>
                        <th className="py-2.5 px-3">Target Selesai</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {criticalProjects.map((p) => {
                        const statusConfig = PROJECT_STATUS_CONFIG[p.status];
                        const indicatorConfig = STATUS_INDICATOR_CONFIG[p.statusIndicator];

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-muted/40 transition-colors"
                          >
                            {/* Kode Proyek */}
                            <td className="py-3 px-3 font-mono font-semibold text-foreground whitespace-nowrap">
                              <Link
                                href={`/projects/${p.id}`}
                                className="text-primary hover:underline"
                              >
                                {p.projectCode}
                              </Link>
                            </td>

                            {/* Nama & Lokasi */}
                            <td className="py-3 px-3 max-w-xs truncate">
                              <div className="font-medium text-foreground truncate">
                                {p.displayName || p.projectName}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {p.company?.name || p.company?.code} &bull; {p.estate?.name || p.estate?.code}
                              </div>
                            </td>

                            {/* Status Tahapan Proyek */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${statusConfig?.badgeClass || ""}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${statusConfig?.dotClass || ""}`}
                                />
                                <span>{statusConfig?.label || p.status}</span>
                              </span>
                            </td>

                            {/* Indikator EWS (Badge warna dari constants) */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-bold border ${indicatorConfig?.badgeClass || ""}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${indicatorConfig?.dotClass || ""}`}
                                />
                                <span>{indicatorConfig?.label || p.statusIndicator}</span>
                              </span>
                            </td>

                            {/* Progres Fisik Tertimbang */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="font-semibold tabular-nums text-foreground">
                                {p.progressPct.toFixed(1)}%
                              </div>
                              <div className="w-20 ml-auto bg-muted rounded-full h-1.5 overflow-hidden mt-1">
                                <div
                                  className={`h-full rounded-full ${
                                    p.statusIndicator === StatusIndicator.DELAYED
                                      ? "bg-rose-500"
                                      : p.statusIndicator === StatusIndicator.AT_RISK
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, p.progressPct))}%` }}
                                />
                              </div>
                            </td>

                            {/* Target Selesai */}
                            <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                              {formatDate(p.targetEndDate)}
                            </td>

                            {/* Tombol Aksi */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="h-7 px-2 text-xs"
                              >
                                <Link href={`/projects/${p.id}`}>
                                  Buka
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Portofolio Proyek Aktif */}
          <PortfolioGanttChart
            title="Timeline Portofolio Proyek Aktif"
            description="Jadwal pelaksanaan seluruh proyek dalam satu garis waktu komprehensif."
          />

          {/* Distribusi Proyek Berdasarkan Tahapan Status */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">
                  Distribusi Portofolio Berdasarkan Tahapan
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Sebaran jumlah proyek pada setiap siklus hidup state machine (docs/WORKFLOW.md).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {Object.entries(PROJECT_STATUS_CONFIG).map(([statusKey, config]) => {
                  const count = stats?.projectsByStatus[statusKey as ProjectStatus] ?? 0;
                  return (
                    <Link
                      key={statusKey}
                      href={`/projects?status=${statusKey}`}
                      className="group flex flex-col p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground group-hover:text-foreground truncate">
                          {config.label}
                        </span>
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${config.dotClass}`}
                        />
                      </div>
                      <div className="text-lg font-bold tabular-nums text-foreground mt-1.5">
                        {count}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Skeleton Loader Component saat data pertama kali dimuat
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Skeleton KPI Baris 1 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skeleton KPI Baris 2 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-14 mb-2" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skeleton Tabel EWS */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-64 mb-1" />
          <Skeleton className="h-3 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
