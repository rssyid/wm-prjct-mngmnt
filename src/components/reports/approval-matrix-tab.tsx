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
  PROJECT_STATUS_CONFIG,
} from "@/lib/constants/status";
import {
  ApprovalMatrixItem,
  exportApprovalMatrixExcel,
} from "@/lib/export/report-excel";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileClock,
  Loader2,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

interface ApprovalMatrixTabProps {
  companies: CompanyWithRegion[];
}

export function ApprovalMatrixTab({ companies }: ApprovalMatrixTabProps) {
  const [data, setData] = useState<ApprovalMatrixItem[]>([]);
  const [kpi, setKpi] = useState({
    totalProjects: 0,
    waitingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    avgReviewDays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const fetchData = async (searchVal = search) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("type", "approval-matrix");
      if (selectedCompanyIds.length > 0) {
        params.set("companyIds", selectedCompanyIds.join(","));
      }
      if (approvalStatusFilter !== "ALL") {
        params.set("approvalStatus", approvalStatusFilter);
      }
      if (searchVal.trim()) {
        params.set("search", searchVal.trim());
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data matriks persetujuan");
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
      console.error("Gagal load approval matrix:", err);
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
  }, [selectedCompanyIds, approvalStatusFilter, search]);

  const resetFilters = () => {
    setSelectedCompanyIds([]);
    setApprovalStatusFilter("ALL");
    setSearch("");
  };

  const handleExportExcel = async () => {
    if (data.length === 0) return;
    try {
      setExporting(true);
      await exportApprovalMatrixExcel(data);
    } catch (err) {
      console.error("Gagal ekspor approval matrix:", err);
    } finally {
      setExporting(false);
    }
  };

  // Helper render badge untuk sel level approver
  const renderLevelCell = (item: ApprovalMatrixItem, level: number) => {
    const snap = item.snapshots.find((s) => s.level === level);
    if (!snap) {
      return (
        <span className="text-[11px] text-muted-foreground/40 italic">-</span>
      );
    }

    if (snap.status === "TIDAK_PERLU") {
      return (
        <span className="inline-block text-[10px] text-muted-foreground/60 border border-dashed border-border/80 bg-muted/20 px-1.5 py-0.5 rounded-xs">
          Tidak Perlu
        </span>
      );
    }

    if (snap.status === "APPROVED") {
      return (
        <div className="flex flex-col gap-0.5 text-[11px]">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span className="truncate">[{snap.role}]</span>
          </span>
          {snap.personName && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
              {snap.personName}
            </span>
          )}
          {snap.approvedAt && (
            <span className="text-[9px] text-muted-foreground/80 font-mono">
              {formatDate(snap.approvedAt)}
            </span>
          )}
        </div>
      );
    }

    if (snap.status === "REJECTED") {
      return (
        <div className="flex flex-col gap-0.5 text-[11px]">
          <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
            <XCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">[{snap.role}] Ditolak</span>
          </span>
          {snap.personName && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
              {snap.personName}
            </span>
          )}
          {snap.notes && (
            <span
              className="text-[9px] text-rose-500 italic truncate max-w-[110px]"
              title={snap.notes}
            >
              &ldquo;{snap.notes}&rdquo;
            </span>
          )}
        </div>
      );
    }

    // WAITING
    return (
      <div className="flex flex-col gap-0.5 text-[11px]">
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3 shrink-0 animate-pulse" />
          <span className="truncate">[{snap.role}]</span>
        </span>
        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
          Menunggu {snap.waitingDays > 0 ? `(${snap.waitingDays} hari)` : ""}
        </span>
      </div>
    );
  };

  const hasActiveFilter =
    selectedCompanyIds.length > 0 ||
    approvalStatusFilter !== "ALL" ||
    search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Total Dokumen AR
              <FileCheck2 className="h-4 w-4 text-primary" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{kpi.totalProjects}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Proyek dengan nomor AR
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Menunggu Approval
              <FileClock className="h-4 w-4 text-amber-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {kpi.waitingCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Tertahan dalam antrean paraf
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Telah Disetujui
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {kpi.approvedCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Siap masuk gerbang pengadaan
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs flex items-center justify-between">
              Ada Penolakan / Revisi
              <AlertCircle className="h-4 w-4 text-rose-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {kpi.rejectedCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pernah ditolak (attempt &gt; 1)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rapi Toolbar Filter & Action Bar */}
      <Card className="border-border shadow-xs bg-card">
        <CardContent className="p-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            {/* Filter controls group */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Multi-select filter grouped by region */}
              <div className="w-full sm:w-64">
                <CompanyMultiSelectFilter
                  companies={companies}
                  selectedCompanyIds={selectedCompanyIds}
                  onChange={setSelectedCompanyIds}
                  placeholder="Filter Perusahaan (Group Region)"
                  className="h-9 text-xs"
                />
              </div>

              {/* Status Approval Select */}
              <div className="w-full sm:w-44">
                <Select
                  value={approvalStatusFilter}
                  onValueChange={setApprovalStatusFilter}
                >
                  <SelectTrigger className="h-9 text-xs border-input bg-background">
                    <SelectValue placeholder="Status Approval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Status Approval</SelectItem>
                    <SelectItem value="WAITING">Sedang Menunggu Paraf</SelectItem>
                    <SelectItem value="APPROVED">Tuntas Disetujui</SelectItem>
                    <SelectItem value="REJECTED">Ada Penolakan / Revisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Box Live */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari proyek / No AR..."
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
              {hasActiveFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>

            {/* Export Excel Button */}
            <div className="shrink-0 flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={exporting || loading || data.length === 0}
                className="h-9 text-xs font-medium border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5 w-full sm:w-auto justify-center"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                Ekspor Excel Matriks
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table: Standard 8 Level Columns */}
      <Card className="border-border shadow-xs overflow-hidden">
        <CardHeader className="p-3.5 pb-2 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Matriks Persetujuan Berjenjang AR (Release Matrix SAP)
              </CardTitle>
              <CardDescription className="text-xs">
                Standar 8 Level (EM s/d Chairman) · SLA Review SAP rata-rata 2–3 minggu.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {data.length} Proyek Terdata
            </Badge>
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
              <AlertCircle className="h-8 w-8 mx-auto" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchData()}>
                Coba Lagi
              </Button>
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <FileClock className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium">
                Tidak ada data persetujuan yang cocok dengan filter.
              </p>
              <p className="text-xs text-muted-foreground">
                Coba sesuaikan filter perusahaan atau status approval di atas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 text-[11px]">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead className="min-w-[180px]">Proyek & Status</TableHead>
                    <TableHead className="min-w-[140px]">Perusahaan & Region</TableHead>
                    <TableHead className="min-w-[130px]">No AR & Nilai</TableHead>
                    <TableHead className="min-w-[110px]">Level 1</TableHead>
                    <TableHead className="min-w-[110px]">Level 2</TableHead>
                    <TableHead className="min-w-[110px]">Level 3</TableHead>
                    <TableHead className="min-w-[110px]">Level 4</TableHead>
                    <TableHead className="min-w-[110px]">Level 5</TableHead>
                    <TableHead className="min-w-[110px]">Level 6</TableHead>
                    <TableHead className="min-w-[110px]">Level 7</TableHead>
                    <TableHead className="min-w-[110px]">Level 8</TableHead>
                    <TableHead className="min-w-[140px]">Posisi / Bottleneck</TableHead>
                    <TableHead className="w-14 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {data.map((item, index) => {
                    const statusCfg = PROJECT_STATUS_CONFIG[item.status];

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
                          <div className="space-y-0.5">
                            <div className="font-medium font-mono text-foreground">
                              {item.noAr || "-"}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-semibold">
                              {formatCurrency(item.approvedAmount)}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              {item.currentAttempt > 1 ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 h-3.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                >
                                  Attempt {item.currentAttempt} (Revisi)
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-3.5 text-muted-foreground"
                                >
                                  Attempt 1
                                </Badge>
                              )}
                              {item.supplementaryCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 h-3.5 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                >
                                  +{item.supplementaryCount} Supp.
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{renderLevelCell(item, 1)}</TableCell>
                        <TableCell>{renderLevelCell(item, 2)}</TableCell>
                        <TableCell>{renderLevelCell(item, 3)}</TableCell>
                        <TableCell>{renderLevelCell(item, 4)}</TableCell>
                        <TableCell>{renderLevelCell(item, 5)}</TableCell>
                        <TableCell>{renderLevelCell(item, 6)}</TableCell>
                        <TableCell>{renderLevelCell(item, 7)}</TableCell>
                        <TableCell>{renderLevelCell(item, 8)}</TableCell>
                        <TableCell>
                          {item.activeWaitingRole ? (
                            <div className="space-y-1">
                              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0 animate-pulse" />
                                Menunggu {item.activeWaitingRole}
                              </span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {item.activeWaitingDays > 0 && (
                                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                    Tertahan {item.activeWaitingDays} hari
                                  </span>
                                )}
                                {item.activeWaitingDays >= 14 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[8px] px-1 py-0 h-3.5 border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/40 font-semibold flex items-center gap-0.5"
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    SLA &gt; 2 Mgg
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : item.afceStatus === "APPROVED" ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              Lengkap Disetujui
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="Buka Tab AFCE Proyek"
                          >
                            <Link href={`/projects/${item.id}?tab=afce`}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
