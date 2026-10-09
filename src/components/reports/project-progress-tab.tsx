"use client";

import {
  CompanyMultiSelectFilter,
  CompanyWithRegion,
} from "@/components/reports/company-multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PACKAGE_CATEGORY_CONFIG,
  PACKAGE_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
  STATUS_INDICATOR_CONFIG,
} from "@/lib/constants/status";
import {
  exportProjectProgressExcel,
  ProjectProgressItem,
} from "@/lib/export/report-excel";
import { cn, formatDayMonth } from "@/lib/utils";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Download,
  ExternalLink,
  Folder,
  Layers,
  Loader2,
  Package,
  RotateCcw,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

interface ProjectProgressTabProps {
  companies: CompanyWithRegion[];
}

export function ProjectProgressTab({ companies }: ProjectProgressTabProps) {
  const [data, setData] = useState<ProjectProgressItem[]>([]);
  const [kpi, setKpi] = useState({
    totalProjects: 0,
    activeProjects: 0,
    avgProgress: 0,
    completedBastCount: 0,
    delayedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [indicatorFilter, setIndicatorFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"lifecycle" | "packages">("lifecycle");

  // State untuk expand baris proyek pada viewMode 'packages'
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );

  const toggleExpand = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProjects(new Set(data.map((d) => d.id)));
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
  };

  const fetchData = async (searchVal = search) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("type", "project-progress");
      if (selectedCompanyIds.length > 0) {
        params.set("companyIds", selectedCompanyIds.join(","));
      }
      if (indicatorFilter !== "ALL") {
        params.set("statusIndicator", indicatorFilter);
      }
      if (searchVal.trim()) {
        params.set("search", searchVal.trim());
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data progress proyek");
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data.items || []);
        if (json.data.kpi) {
          setKpi(json.data.kpi);
        }
      } else {
        throw new Error(json.error || "Gagal memproses data");
      }
    } catch (err: unknown) {
      console.error("Gagal load project progress:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(search);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyIds, indicatorFilter, search]);

  const resetFilters = () => {
    setSelectedCompanyIds([]);
    setIndicatorFilter("ALL");
    setSearch("");
  };

  const handleExportExcel = async () => {
    if (data.length === 0) return;
    try {
      setExporting(true);
      await exportProjectProgressExcel(data);
    } catch (err) {
      console.error("Gagal ekspor progress proyek:", err);
    } finally {
      setExporting(false);
    }
  };

  // Grouping proyek berdasarkan FolderCategory untuk View 1 (Siklus Hidup)
  const groupedProjects = React.useMemo(() => {
    const map = new Map<string, ProjectProgressItem[]>();
    data.forEach((item) => {
      const category = item.folderCategoryName || "Tanpa Kategori";
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(item);
    });
    return Array.from(map.entries()).map(([categoryName, items]) => ({
      categoryName,
      items,
    }));
  }, [data]);

  // Helper render status milestone chip
  const renderMilestoneChip = (
    label: string,
    status: string,
    subText?: string
  ) => {
    let colorClass =
      "bg-muted/70 text-muted-foreground border-border/80";
    let icon = null;

    if (
      status === "DONE" ||
      status === "READY" ||
      status === "APPROVED" ||
      status === "DELIVERED" ||
      status === "COMPLETED" ||
      status === "VERIFIED"
    ) {
      colorClass =
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
      icon = <CheckCircle2 className="h-3 w-3 shrink-0" />;
    } else if (
      status === "IN_PROGRESS" ||
      status === "PO_ISSUED" ||
      status === "PR_SUBMITTED" ||
      status === "DRAFT" ||
      status === "WAITING" ||
      status === "WAITING_VERIFICATION"
    ) {
      colorClass =
        "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800";
      icon = <Clock className="h-3 w-3 shrink-0" />;
    } else if (status === "REJECTED") {
      colorClass =
        "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800";
      icon = <AlertTriangle className="h-3 w-3 shrink-0" />;
    }

    return (
      <div className="flex flex-col gap-0.5 min-w-[90px]">
        <div
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${colorClass}`}
        >
          {icon}
          <span className="truncate">{label}</span>
        </div>
        {subText && (
          <span className="text-[9px] text-muted-foreground truncate font-mono">
            {subText}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Mini Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Total Proyek Berjalan
              <Layers className="h-4 w-4 text-primary" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{kpi.activeProjects}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Dari total {kpi.totalProjects} proyek terdata
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Rata-rata Progres Fisik
              <TrendingUp className="h-4 w-4 text-sky-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-sky-600 dark:text-sky-400">
              {kpi.avgProgress}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Akumulasi progres tertimbang
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Tuntas BAST
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {kpi.completedBastCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Verifikasi Super Admin selesai
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Proyek Terlambat (Delay)
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {kpi.delayedCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Deviasi negatif terhadap rencana
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rapi Toolbar Filter & Action Bar */}
      <Card className="border-border shadow-xs bg-card">
        <CardContent className="p-3">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Multi-select filter grouped by region */}
              <div className="w-full sm:w-[280px] lg:w-[300px]">
                <CompanyMultiSelectFilter
                  companies={companies}
                  selectedCompanyIds={selectedCompanyIds}
                  onChange={setSelectedCompanyIds}
                  placeholder="Filter Perusahaan (Group Region)"
                  className="h-9 text-xs"
                />
              </div>

              {/* Status Indikator EWS */}
              <div className="w-full sm:w-56 lg:w-60">
                <Select
                  value={indicatorFilter}
                  onValueChange={setIndicatorFilter}
                >
                  <SelectTrigger className="h-9 text-xs border-input bg-background">
                    <SelectValue placeholder="Status Indikator EWS" />
                  </SelectTrigger>
                  <SelectContent className="w-[240px]">
                    <SelectItem value="ALL">Semua Indikator EWS</SelectItem>
                    <SelectItem value="ON_TRACK">Sesuai Jadwal (On Track)</SelectItem>
                    <SelectItem value="AT_RISK">Beresiko (At Risk)</SelectItem>
                    <SelectItem value="DELAYED">Terlambat (Delayed)</SelectItem>
                    <SelectItem value="COMPLETED">Tuntas (Completed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Box Live */}
              <div className="relative w-full sm:w-64 lg:w-72">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari proyek / vendor / paket..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8 pr-7 text-xs border-input bg-background"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    title="Hapus pencarian"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Reset filter button */}
              {(selectedCompanyIds.length > 0 ||
                indicatorFilter !== "ALL" ||
                search.trim().length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>

            {/* View Mode Toggle & Export Excel */}
            <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-border/40">
              {/* Switch View Toggle */}
              <div className="inline-flex rounded-md border border-input p-0.5 bg-muted/40">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "lifecycle" ? "default" : "ghost"}
                  onClick={() => setViewMode("lifecycle")}
                  className="h-8 text-xs px-2.5 gap-1.5"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Siklus Hidup
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "packages" ? "default" : "ghost"}
                  onClick={() => setViewMode("packages")}
                  className="h-8 text-xs px-2.5 gap-1.5"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Paket Kerja
                </Button>
              </div>

              {/* Export Excel Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exporting || loading || data.length === 0}
                className="h-9 text-xs font-medium border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                Ekspor Excel Progres
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Content */}
      <Card className="border-border shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                {viewMode === "lifecycle"
                  ? "Matriks Progres Siklus Hidup (Survei s/d BAST)"
                  : "Rincian Paket Kerja & Realisasi Volume"}
              </CardTitle>
              <CardDescription className="text-xs">
                {viewMode === "lifecycle"
                  ? "Pantau status gerbang tiap fase proyek: Survei → RAB → AR → Pengadaan → Eksekusi → BAST."
                  : "Detail per paket pekerjaan: bobot tertimbang, capaian progres, realisasi volume, dan ketepatan vendor."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {viewMode === "packages" && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={expandAll}
                    className="h-7 text-[11px] px-2 text-muted-foreground"
                  >
                    Buka Semua
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={collapseAll}
                    className="h-7 text-[11px] px-2 text-muted-foreground"
                  >
                    Tutup Semua
                  </Button>
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {data.length} Proyek
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-500 space-y-2">
              <AlertTriangle className="h-8 w-8 mx-auto" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchData()}>
                Coba Lagi
              </Button>
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium">
                Tidak ada data progres yang cocok dengan filter.
              </p>
              <p className="text-xs text-muted-foreground">
                Coba sesuaikan filter perusahaan atau indikator EWS di atas.
              </p>
            </div>
          ) : viewMode === "lifecycle" ? (
            /* VIEW 1: LIFECYCLE STAGE MATRIX */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 text-[11px]">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead className="min-w-[190px]">Proyek & Status</TableHead>
                    <TableHead className="min-w-[140px]">Perusahaan & Region</TableHead>
                    <TableHead className="min-w-[110px]">Indikator EWS</TableHead>
                    <TableHead className="min-w-[110px]">Progres Fisik</TableHead>
                    <TableHead className="min-w-[100px]">1. Survei</TableHead>
                    <TableHead className="min-w-[100px]">2. RAB</TableHead>
                    <TableHead className="min-w-[110px]">3. Approval AR</TableHead>
                    <TableHead className="min-w-[120px]">4. Pengadaan</TableHead>
                    <TableHead className="min-w-[110px]">5. Eksekusi</TableHead>
                    <TableHead className="min-w-[110px]">6. BAST</TableHead>
                    <TableHead className="w-14 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Tidak ada data proyek yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedProjects.map((group) => (
                      <React.Fragment key={group.categoryName}>
                        {/* Header Baris Kategori Proyek */}
                        <TableRow className="bg-muted/70 font-semibold border-y border-border">
                          <TableCell colSpan={12} className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Folder className="h-3.5 w-3.5 text-primary" />
                              <span className="text-foreground text-xs font-bold uppercase tracking-wider">
                                Kategori: {group.categoryName}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4.5 px-2 font-normal"
                              >
                                {group.items.length} Proyek
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Baris-baris Proyek di dalam Kategori */}
                        {group.items.map((item, index) => {
                          const statusCfg = PROJECT_STATUS_CONFIG[item.status];
                          const indCfg =
                            STATUS_INDICATOR_CONFIG[item.statusIndicator];

                          return (
                            <TableRow
                              key={item.id}
                              className="hover:bg-muted/30"
                            >
                              <TableCell className="text-center text-muted-foreground font-mono text-[11px] align-top py-2.5">
                                {index + 1}
                              </TableCell>

                              {/* Kolom 2: Proyek & Status (3 Baris Vertikal) */}
                              <TableCell className="align-top py-2.5">
                                <div className="flex flex-col gap-1 min-w-[200px]">
                                  {/* Baris 1: Nama Proyek */}
                                  <span className="font-semibold text-foreground text-xs leading-snug">
                                    {item.projectName}
                                  </span>
                                  {/* Baris 2: No Proyek */}
                                  <span className="font-mono text-[10px] text-muted-foreground leading-none">
                                    {item.projectCode}
                                  </span>
                                  {/* Baris 3: Status Proyek */}
                                  <div>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] px-1.5 py-0 h-4 border font-medium inline-flex",
                                        statusCfg?.badgeClass
                                      )}
                                    >
                                      {statusCfg?.label || item.status}
                                    </Badge>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="align-top py-2.5">
                                <div className="space-y-0.5">
                                  <div className="font-medium text-foreground truncate max-w-[150px]">
                                    {item.companyName}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                    {item.regionName}
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="align-top py-2.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0.5 border ${indCfg?.badgeClass || ""}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full mr-1.5 ${indCfg?.dotClass || ""}`}
                                  />
                                  {indCfg?.label || item.statusIndicator}
                                </Badge>
                              </TableCell>

                              <TableCell className="align-top py-2.5">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-semibold">
                                    <span>{item.progressPct}%</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-sky-500 h-1.5 rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(100, item.progressPct)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </TableCell>

                              {/* 1. Survei: Done / WIP / Not Yet */}
                              <TableCell className="align-top py-2.5">
                                {renderMilestoneChip(
                                  item.milestones.survey.status === "DONE"
                                    ? "Done"
                                    : item.milestones.survey.status === "IN_PROGRESS"
                                    ? "WIP"
                                    : "Not Yet",
                                  item.milestones.survey.status
                                )}
                              </TableCell>

                              {/* 2. RAB: Done / Draft / Not Yet */}
                              <TableCell className="align-top py-2.5">
                                {renderMilestoneChip(
                                  item.milestones.rab.status === "READY"
                                    ? "Done"
                                    : item.milestones.rab.status === "DRAFT"
                                    ? "Draft"
                                    : "Not Yet",
                                  item.milestones.rab.status
                                )}
                              </TableCell>

                              {/* 3. Approval AR: Approved / WIP / Rejected / Not Yet */}
                              <TableCell className="align-top py-2.5">
                                {renderMilestoneChip(
                                  item.milestones.approval.status === "APPROVED"
                                    ? "Approved"
                                    : item.milestones.approval.status === "WAITING"
                                    ? "WIP"
                                    : item.milestones.approval.status === "REJECTED"
                                    ? "Rejected"
                                    : "Not Yet",
                                  item.milestones.approval.status,
                                  item.milestones.approval.noAr
                                )}
                              </TableCell>

                              {/* 4. Pengadaan: Delivered / PO / PR / Not Yet */}
                              <TableCell className="align-top py-2.5">
                                {renderMilestoneChip(
                                  item.milestones.procurement.status === "DELIVERED"
                                    ? "Delivered"
                                    : item.milestones.procurement.status === "PO_ISSUED"
                                    ? "PO"
                                    : item.milestones.procurement.status === "PR_SUBMITTED"
                                    ? "PR"
                                    : "Not Yet",
                                  item.milestones.procurement.status,
                                  `${item.milestones.procurement.deliveredPackages}/${item.milestones.procurement.totalPackages} Paket Tiba`
                                )}
                              </TableCell>

                              {/* 5. Eksekusi: Done (100%) / WIP ([x]%) / Not Yet */}
                              <TableCell className="align-top py-2.5">
                                {renderMilestoneChip(
                                  item.milestones.execution.status === "COMPLETED"
                                    ? "Done (100%)"
                                    : item.milestones.execution.status === "IN_PROGRESS"
                                    ? `WIP (${item.milestones.execution.progressPct}%)`
                                    : "Not Yet",
                                  item.milestones.execution.status
                                )}
                              </TableCell>

                              {/* 6. BAST: Verified / WIP / Not Yet */}
                              <TableCell className="align-top py-2.5">
                                {renderMilestoneChip(
                                  item.milestones.bast.status === "VERIFIED"
                                    ? "Verified"
                                    : item.milestones.bast.status === "WAITING_VERIFICATION"
                                    ? "WIP"
                                    : "Not Yet",
                                  item.milestones.bast.status,
                                  item.milestones.bast.bastNumber
                                )}
                              </TableCell>

                              <TableCell className="text-center align-top py-2.5">
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Buka Proyek"
                                >
                                  <Link href={`/projects/${item.id}`}>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* VIEW 2: DETAILED WORK PACKAGE BREAKDOWN */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 text-[11px]">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="min-w-[220px]">Proyek / Paket Pekerjaan</TableHead>
                    <TableHead className="min-w-[150px]">Vendor & PO</TableHead>
                    <TableHead className="min-w-[130px]">Bobot & Progres Fisik</TableHead>
                    <TableHead className="min-w-[140px]">Target vs Capaian Volume</TableHead>
                    <TableHead className="min-w-[150px]">Jadwal Pengadaan</TableHead>
                    <TableHead className="min-w-[150px]">Jadwal Fisik</TableHead>
                    <TableHead className="min-w-[110px]">Status Paket</TableHead>
                    <TableHead className="w-12 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {data.map((item) => {
                    const isExpanded = expandedProjects.has(item.id);
                    const wpCount = item.workPackages.length;

                    return (
                      <React.Fragment key={item.id}>
                        {/* Parent Row Proyek */}
                        <TableRow
                          onClick={() => toggleExpand(item.id)}
                          className="bg-muted/20 hover:bg-muted/40 cursor-pointer font-medium select-none"
                        >
                          <TableCell className="text-center align-middle">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground inline-block" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground inline-block" />
                            )}
                          </TableCell>
                          <TableCell colSpan={2} className="align-middle py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">
                                {item.projectName}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                ({item.projectCode})
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1.5 ml-1"
                              >
                                {item.companyName}
                              </Badge>
                              {item.folderCategoryName && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] h-4 px-1.5"
                                >
                                  {item.folderCategoryName}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell colSpan={2} className="align-middle py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {wpCount} Paket Pekerjaan
                              </span>
                              <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                                <span className="text-[11px] font-semibold">
                                  {item.progressPct}%
                                </span>
                                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-sky-500 h-1.5 rounded-full"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        item.progressPct
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell colSpan={3} className="align-middle py-2.5">
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>Target Selesai:</span>
                              <span className="font-mono text-foreground font-medium">
                                {item.targetEndDate
                                  ? formatDayMonth(item.targetEndDate)
                                  : "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell
                            className="text-center align-middle py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              title="Buka Tab Paket Pekerjaan"
                            >
                              <Link href={`/projects/${item.id}?tab=packages`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Child Rows: Work Packages */}
                        {isExpanded &&
                          (wpCount === 0 ? (
                            <TableRow className="bg-background">
                              <TableCell></TableCell>
                              <TableCell
                                colSpan={8}
                                className="text-muted-foreground italic py-3 text-center"
                              >
                                Belum ada paket pekerjaan pada proyek ini.
                              </TableCell>
                            </TableRow>
                          ) : (
                            item.workPackages.map((pkg) => {
                              const pkgStatusCfg =
                                PACKAGE_STATUS_CONFIG[pkg.status];
                              const payStatusCfg =
                                PAYMENT_STATUS_CONFIG[pkg.paymentStatus];

                              const procPlan =
                                pkg.procurementPlanStartDate &&
                                pkg.procurementPlanEndDate
                                  ? `${formatDayMonth(
                                      pkg.procurementPlanStartDate
                                    )} - ${formatDayMonth(
                                      pkg.procurementPlanEndDate
                                    )}`
                                  : "-";

                              const physPlan =
                                pkg.hasPhysicalWork !== false &&
                                pkg.planStartDate &&
                                pkg.planEndDate
                                  ? `${formatDayMonth(
                                      pkg.planStartDate
                                    )} - ${formatDayMonth(pkg.planEndDate)}`
                                  : "-";

                              return (
                                <TableRow
                                  key={pkg.id}
                                  className="bg-background hover:bg-muted/15 border-b border-border/40"
                                >
                                  {/* Col 1: Empty for indent */}
                                  <TableCell className="align-top py-2.5"></TableCell>

                                  {/* Col 2: Paket Pekerjaan + Kategori & Tipe */}
                                  <TableCell className="align-top py-2.5">
                                    <div className="space-y-1">
                                      <div className="flex items-start gap-1.5">
                                        <span className="text-muted-foreground font-mono text-xs select-none">
                                          ↳
                                        </span>
                                        <span className="font-semibold text-foreground text-xs leading-snug">
                                          {pkg.packageName}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap pl-3.5">
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          {PACKAGE_CATEGORY_CONFIG[pkg.category]
                                            ?.label || pkg.category}
                                        </span>
                                        {pkg.hasPhysicalWork !== false ? (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] px-1 py-0 h-3.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300"
                                          >
                                            Pengadaan + Fisik
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] px-1 py-0 h-3.5 bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border-sky-300"
                                          >
                                            Hanya Pengadaan
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>

                                  {/* Col 3: Vendor, PO & Status Bayar */}
                                  <TableCell className="align-top py-2.5">
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-medium text-foreground truncate max-w-[140px] block" title={pkg.vendorName}>
                                        {pkg.vendorName}
                                      </span>
                                      {pkg.noPoSpk && (
                                        <span className="text-[10px] font-mono text-muted-foreground block">
                                          PO: {pkg.noPoSpk}{" "}
                                          {pkg.poSpkDate
                                            ? `(${formatDayMonth(
                                                pkg.poSpkDate
                                              )})`
                                            : ""}
                                        </span>
                                      )}
                                      <div>
                                        <Badge
                                          variant="outline"
                                          className={`text-[9px] px-1.5 py-0 h-3.5 border ${
                                            payStatusCfg?.badgeClass || ""
                                          }`}
                                        >
                                          {payStatusCfg?.label ||
                                            pkg.paymentStatus}
                                        </Badge>
                                      </div>
                                    </div>
                                  </TableCell>

                                  {/* Col 4: Bobot & Progres Fisik */}
                                  <TableCell className="align-top py-2.5">
                                    {pkg.hasPhysicalWork !== false ? (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[10px]">
                                          <span className="text-muted-foreground">
                                            Bobot: {pkg.weightPct}%
                                          </span>
                                          <span className="font-semibold text-foreground">
                                            {pkg.progressPct}%
                                          </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className="bg-emerald-500 h-1.5 rounded-full"
                                            style={{
                                              width: `${Math.min(
                                                100,
                                                pkg.progressPct
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-0.5 text-[10px]">
                                        <span className="text-muted-foreground block">
                                          Bobot: {pkg.weightPct}%
                                        </span>
                                        <span className="text-[10px] text-muted-foreground italic block">
                                          Material Saja (Tanpa Fisik)
                                        </span>
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* Col 5: Target vs Capaian Volume + Tanggal Selesai / Masuk */}
                                  <TableCell className="align-top py-2.5">
                                    <div className="space-y-1.5">
                                      <div className="text-[11px] font-mono font-medium">
                                        {pkg.volumeAchieved ?? 0} /{" "}
                                        {pkg.targetQuantity ?? "-"}{" "}
                                        <span className="text-muted-foreground text-[10px]">
                                          {pkg.uom || ""}
                                        </span>
                                      </div>

                                      {/* Realisasi Tanggal Selesai / Barang Masuk */}
                                      <div className="space-y-0.5 text-[10px] font-mono pt-0.5 border-t border-border/40">
                                        {pkg.hasPhysicalWork !== false ? (
                                          <div className="grid grid-cols-[46px_1fr] items-baseline">
                                            <span className="text-muted-foreground">Selesai</span>
                                            <span className="text-foreground">
                                              : {pkg.progressPct >= 100
                                                ? pkg.actualEndDate
                                                  ? formatDayMonth(pkg.actualEndDate)
                                                  : pkg.actualStartDate
                                                  ? formatDayMonth(pkg.actualStartDate)
                                                  : "100%"
                                                : pkg.actualStartDate || pkg.progressPct > 0
                                                ? "WIP"
                                                : "-"}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="grid grid-cols-[46px_1fr] items-baseline">
                                            <span className="text-muted-foreground">Masuk</span>
                                            <span className="text-foreground">
                                              : {pkg.actualDeliveryDate
                                                ? formatDayMonth(pkg.actualDeliveryDate)
                                                : "-"}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>

                                  {/* Col 6: Jadwal Pengadaan (Plan, Rev, Tiba/Est/Terlambat dengan titik dua lurus) */}
                                  <TableCell className="align-top py-2.5">
                                    <div className="space-y-0.5 text-[10px] font-mono">
                                      {/* Plan */}
                                      <div className="grid grid-cols-[38px_1fr] items-baseline">
                                        <span className="text-muted-foreground">Plan</span>
                                        <span className="text-muted-foreground">: {procPlan}</span>
                                      </div>

                                      {/* Rev */}
                                      {pkg.procurementRevisedEndDate && (
                                        <div className="grid grid-cols-[38px_1fr] items-baseline text-amber-600 dark:text-amber-400 font-semibold">
                                          <span>Rev</span>
                                          <span>
                                            : {formatDayMonth(pkg.procurementRevisedEndDate)}
                                          </span>
                                        </div>
                                      )}

                                      {/* Tiba / Est / Terlambat */}
                                      {pkg.isDelayed ? (
                                        <div className="grid grid-cols-[38px_1fr] items-baseline text-rose-600 dark:text-rose-400 font-semibold">
                                          <span>Est</span>
                                          <span className="flex items-center gap-1">
                                            : {pkg.estDeliveryDate
                                              ? formatDayMonth(pkg.estDeliveryDate)
                                              : "-"}{" "}
                                            <span className="text-[9px] font-sans font-normal">(Telat)</span>
                                          </span>
                                        </div>
                                      ) : pkg.actualDeliveryDate ? (
                                        <div className="grid grid-cols-[38px_1fr] items-baseline text-emerald-600 dark:text-emerald-400">
                                          <span>Tiba</span>
                                          <span>
                                            : {formatDayMonth(pkg.actualDeliveryDate)}
                                          </span>
                                        </div>
                                      ) : pkg.estDeliveryDate ? (
                                        <div className="grid grid-cols-[38px_1fr] items-baseline text-muted-foreground">
                                          <span>Est</span>
                                          <span>
                                            : {formatDayMonth(pkg.estDeliveryDate)}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-[38px_1fr] items-baseline text-muted-foreground">
                                          <span>Tiba</span>
                                          <span>: -</span>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Col 7: Jadwal Fisik (Plan, Rev, Selesai dengan titik dua lurus) */}
                                  <TableCell className="align-top py-2.5">
                                    {pkg.hasPhysicalWork !== false ? (
                                      <div className="space-y-0.5 text-[10px] font-mono">
                                        {/* Plan */}
                                        <div className="grid grid-cols-[44px_1fr] items-baseline">
                                          <span className="text-muted-foreground">Plan</span>
                                          <span className="text-muted-foreground">: {physPlan}</span>
                                        </div>

                                        {/* Rev */}
                                        {pkg.revisedEndDate && (
                                          <div className="grid grid-cols-[44px_1fr] items-baseline text-amber-600 dark:text-amber-400 font-semibold">
                                            <span>Rev</span>
                                            <span>
                                              : {formatDayMonth(pkg.revisedEndDate)}
                                            </span>
                                          </div>
                                        )}

                                        {/* Selesai: isi tanggal ketika 100%, jika belum 100% tampilkan WIP / - */}
                                        {pkg.progressPct >= 100 ? (
                                          <div className="grid grid-cols-[44px_1fr] items-baseline text-emerald-600 dark:text-emerald-400 font-medium">
                                            <span>Selesai</span>
                                            <span>
                                              : {pkg.actualEndDate
                                                ? formatDayMonth(pkg.actualEndDate)
                                                : pkg.actualStartDate
                                                ? formatDayMonth(pkg.actualStartDate)
                                                : "100%"}
                                            </span>
                                          </div>
                                        ) : pkg.actualStartDate || pkg.progressPct > 0 ? (
                                          <div className="grid grid-cols-[44px_1fr] items-baseline text-sky-600 dark:text-sky-400">
                                            <span>Selesai</span>
                                            <span>: WIP ({pkg.progressPct}%)</span>
                                          </div>
                                        ) : (
                                          <div className="grid grid-cols-[44px_1fr] items-baseline text-muted-foreground">
                                            <span>Selesai</span>
                                            <span>: -</span>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground italic">
                                        Tanpa Pekerjaan Fisik
                                      </span>
                                    )}
                                  </TableCell>

                                  {/* Col 8: Status Paket */}
                                  <TableCell className="align-top py-2.5">
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] px-1.5 py-0 h-4 border ${
                                        pkgStatusCfg?.badgeClass || ""
                                      }`}
                                    >
                                      {pkgStatusCfg?.label || pkg.status}
                                    </Badge>
                                  </TableCell>

                                  {/* Col 9: Aksi */}
                                  <TableCell className="align-top py-2.5 text-center"></TableCell>
                                </TableRow>
                              );
                            })
                          ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
