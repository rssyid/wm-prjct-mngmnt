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
import { formatDate } from "@/lib/utils";
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

  // Helper render status milestone chip
  const renderMilestoneChip = (
    label: string,
    status: string,
    subText?: string
  ) => {
    let colorClass =
      "bg-muted text-muted-foreground border-border";
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
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}
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
                  {data.map((item, index) => {
                    const statusCfg = PROJECT_STATUS_CONFIG[item.status];
                    const indCfg = STATUS_INDICATOR_CONFIG[item.statusIndicator];

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="text-center text-muted-foreground font-mono text-[11px]">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-semibold text-foreground line-clamp-1">
                              {item.projectName}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {item.projectCode}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 h-4 border ${statusCfg?.badgeClass || ""}`}
                              >
                                {statusCfg?.label || item.status}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-foreground truncate max-w-[150px]">
                              {item.companyName}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                              {item.regionName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
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
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span>{item.progressPct}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-sky-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min(100, item.progressPct)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {renderMilestoneChip(
                            item.milestones.survey.status === "DONE"
                              ? "Selesai"
                              : item.milestones.survey.status === "IN_PROGRESS"
                              ? "Berjalan"
                              : "Belum",
                            item.milestones.survey.status
                          )}
                        </TableCell>
                        <TableCell>
                          {renderMilestoneChip(
                            item.milestones.rab.status === "READY"
                              ? "Siap"
                              : item.milestones.rab.status === "DRAFT"
                              ? "Draft"
                              : "Belum",
                            item.milestones.rab.status
                          )}
                        </TableCell>
                        <TableCell>
                          {renderMilestoneChip(
                            item.milestones.approval.status === "APPROVED"
                              ? "Approved"
                              : item.milestones.approval.status === "WAITING"
                              ? "Waiting"
                              : item.milestones.approval.status === "REJECTED"
                              ? "Rejected"
                              : "Draft",
                            item.milestones.approval.status,
                            item.milestones.approval.noAr
                          )}
                        </TableCell>
                        <TableCell>
                          {renderMilestoneChip(
                            item.milestones.procurement.status === "DELIVERED"
                              ? "Tiba Lengkap"
                              : item.milestones.procurement.status === "PO_ISSUED"
                              ? "PO Terbit"
                              : item.milestones.procurement.status === "PR_SUBMITTED"
                              ? "PR Diajukan"
                              : "Belum Ada",
                            item.milestones.procurement.status,
                            `${item.milestones.procurement.deliveredPackages}/${item.milestones.procurement.totalPackages} Paket Tiba`
                          )}
                        </TableCell>
                        <TableCell>
                          {renderMilestoneChip(
                            item.milestones.execution.status === "COMPLETED"
                              ? "Tuntas"
                              : item.milestones.execution.status === "IN_PROGRESS"
                              ? `${item.milestones.execution.progressPct}%`
                              : "Belum",
                            item.milestones.execution.status
                          )}
                        </TableCell>
                        <TableCell>
                          {renderMilestoneChip(
                            item.milestones.bast.status === "VERIFIED"
                              ? "Verified"
                              : item.milestones.bast.status === "WAITING_VERIFICATION"
                              ? "Menunggu"
                              : "Belum Ada",
                            item.milestones.bast.status,
                            item.milestones.bast.bastNumber
                          )}
                        </TableCell>
                        <TableCell className="text-center">
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
                    <TableHead className="min-w-[190px]">Proyek & Perusahaan</TableHead>
                    <TableHead className="min-w-[160px]">Paket Pekerjaan</TableHead>
                    <TableHead className="min-w-[120px]">Vendor</TableHead>
                    <TableHead className="min-w-[110px]">Bobot & Progres</TableHead>
                    <TableHead className="min-w-[120px]">Volume Target vs Capaian</TableHead>
                    <TableHead className="min-w-[110px]">Status Paket</TableHead>
                    <TableHead className="min-w-[110px]">Pembayaran</TableHead>
                    <TableHead className="min-w-[130px]">Kedatangan & Keterlambatan</TableHead>
                    <TableHead className="w-14 text-center">Aksi</TableHead>
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
                          <TableCell className="text-center">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell colSpan={2}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {item.projectName}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                ({item.projectCode})
                              </span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-1">
                                {item.companyName}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell colSpan={2}>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-muted-foreground">
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
                                      width: `${Math.min(100, item.progressPct)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell colSpan={4}>
                            <span className="text-[10px] text-muted-foreground">
                              Target Selesai:{" "}
                              {item.targetEndDate ? formatDate(item.targetEndDate) : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              title="Buka Tab Paket Pekerjaan"
                            >
                              <Link href={`/projects/${item.id}?tab=procurement`}>
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
                              <TableCell colSpan={9} className="text-muted-foreground italic py-3 text-center">
                                Belum ada paket pekerjaan pada proyek ini.
                              </TableCell>
                            </TableRow>
                          ) : (
                            item.workPackages.map((pkg) => {
                              const pkgStatusCfg =
                                PACKAGE_STATUS_CONFIG[pkg.status];
                              const payStatusCfg =
                                PAYMENT_STATUS_CONFIG[pkg.paymentStatus];

                              return (
                                <TableRow
                                  key={pkg.id}
                                  className="bg-background hover:bg-muted/15 border-b border-border/40"
                                >
                                  <TableCell></TableCell>
                                  <TableCell className="pl-6">
                                    <div className="text-[10px] text-muted-foreground">
                                      ↳ Bagian Kerja
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-foreground">
                                        {pkg.packageName}
                                      </span>
                                      <div className="text-[10px] text-muted-foreground font-mono">
                                        {PACKAGE_CATEGORY_CONFIG[pkg.category]?.label || pkg.category}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-[11px] text-muted-foreground truncate max-w-[130px] block">
                                      {pkg.vendorName}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-muted-foreground">
                                          Bobot: {pkg.weightPct}%
                                        </span>
                                        <span className="font-semibold text-foreground">
                                          {pkg.progressPct}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                                        <div
                                          className="bg-emerald-500 h-1 rounded-full"
                                          style={{
                                            width: `${Math.min(100, pkg.progressPct)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-[11px] font-mono">
                                      {pkg.volumeAchieved ?? 0} /{" "}
                                      {pkg.targetQuantity ?? "-"}{" "}
                                      <span className="text-muted-foreground text-[10px]">
                                        {pkg.uom || ""}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] px-1.5 py-0 h-4 border ${pkgStatusCfg?.badgeClass || ""}`}
                                    >
                                      {pkgStatusCfg?.label || pkg.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] px-1.5 py-0 h-4 border ${payStatusCfg?.badgeClass || ""}`}
                                    >
                                      {payStatusCfg?.label || pkg.paymentStatus}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-0.5 text-[10px]">
                                      <div className="text-muted-foreground">
                                        Est: {pkg.estDeliveryDate ? formatDate(pkg.estDeliveryDate) : "-"}
                                      </div>
                                      {pkg.isDelayed ? (
                                        <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3 shrink-0" />
                                          Terlambat
                                        </span>
                                      ) : pkg.actualDeliveryDate ? (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          Tiba: {formatDate(pkg.actualDeliveryDate)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell></TableCell>
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
