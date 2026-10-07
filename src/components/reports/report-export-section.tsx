"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STATUS_CONFIG } from "@/lib/constants/status";
import {
  BudgetRealizationItem,
  exportBudgetRealizationExcel,
  exportProcurementOutstandingExcel,
  OutstandingProcurementItem,
} from "@/lib/export/report-excel";
import {
  exportProjectStatusPdf,
  ProjectStatusReportData,
} from "@/lib/export/report-pdf";
import { formatDate } from "@/lib/utils";
import { ProjectStatus } from "@prisma/client";
import {
  AlertCircle,
  Download,
  FileText,
  Filter,
  Layers,
  Loader2,
  PieChart,
  RotateCcw,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface CompanyOption {
  id: string;
  code: string;
  name: string;
}

export function ReportExportSection() {
  // Pilihan master filter
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Filter state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Loading state per jenis laporan
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambil daftar perusahaan untuk dropdown
  useEffect(() => {
    async function fetchCompanies() {
      try {
        setLoadingCompanies(true);
        const res = await fetch("/api/master?type=company");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setCompanies(json.data);
          }
        }
      } catch (err) {
        console.error("Gagal memuat daftar perusahaan:", err);
      } finally {
        setLoadingCompanies(false);
      }
    }
    fetchCompanies();
  }, []);

  const resetFilter = () => {
    setSelectedCompanyId("ALL");
    setSelectedStatus("ALL");
    setStartDate("");
    setEndDate("");
    setErrorMessage(null);
  };

  const buildQueryParams = (type: string) => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (selectedCompanyId && selectedCompanyId !== "ALL") {
      params.set("companyId", selectedCompanyId);
    }
    if (selectedStatus && selectedStatus !== "ALL") {
      params.set("status", selectedStatus);
    }
    if (startDate) {
      params.set("startDate", startDate);
    }
    if (endDate) {
      params.set("endDate", endDate);
    }
    return params.toString();
  };

  const getFilterMeta = () => {
    const company = companies.find((c) => c.id === selectedCompanyId);
    const statusCfg =
      selectedStatus !== "ALL"
        ? PROJECT_STATUS_CONFIG[selectedStatus as ProjectStatus]
        : null;

    let dateRange = "";
    if (startDate && endDate) {
      dateRange = `${formatDate(startDate)} s/d ${formatDate(endDate)}`;
    } else if (startDate) {
      dateRange = `Mulai ${formatDate(startDate)}`;
    } else if (endDate) {
      dateRange = `Hingga ${formatDate(endDate)}`;
    }

    return {
      companyName: company ? `${company.code} - ${company.name}` : undefined,
      statusLabel: statusCfg?.label,
      dateRangeLabel: dateRange || undefined,
    };
  };

  // Handler ekspor 1: Laporan Status Proyek (PDF)
  const handleExportProjectStatus = async () => {
    try {
      setExportingType("project-status");
      setErrorMessage(null);

      const qs = buildQueryParams("project-status");
      const res = await fetch(`/api/reports?${qs}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengambil data laporan status proyek");
      }

      const reportData: ProjectStatusReportData = json.data;
      if (!reportData.projects || reportData.projects.length === 0) {
        throw new Error("Tidak ada data proyek yang sesuai dengan filter yang dipilih.");
      }

      await exportProjectStatusPdf(reportData, getFilterMeta());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat mengekspor PDF.";
      setErrorMessage(msg);
    } finally {
      setExportingType(null);
    }
  };

  // Handler ekspor 2: Pengadaan Outstanding (Excel)
  const handleExportProcurementOutstanding = async () => {
    try {
      setExportingType("procurement-outstanding");
      setErrorMessage(null);

      const qs = buildQueryParams("procurement-outstanding");
      const res = await fetch(`/api/reports?${qs}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengambil data pengadaan outstanding");
      }

      const items: OutstandingProcurementItem[] = json.data.packages || [];
      if (items.length === 0) {
        throw new Error("Tidak ditemukan paket pengadaan yang outstanding untuk filter ini.");
      }

      await exportProcurementOutstandingExcel(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat mengekspor Excel.";
      setErrorMessage(msg);
    } finally {
      setExportingType(null);
    }
  };

  // Handler ekspor 3: Realisasi Anggaran (Excel)
  const handleExportBudgetRealization = async () => {
    try {
      setExportingType("budget-realization");
      setErrorMessage(null);

      const qs = buildQueryParams("budget-realization");
      const res = await fetch(`/api/reports?${qs}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengambil data realisasi anggaran");
      }

      const items: BudgetRealizationItem[] = json.data.realizations || [];
      if (items.length === 0) {
        throw new Error("Tidak ada data anggaran proyek untuk filter yang dipilih.");
      }

      await exportBudgetRealizationExcel(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat mengekspor Excel.";
      setErrorMessage(msg);
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Panel Filter Terpadu */}
      <Card className="border-border shadow-xs bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Filter Parameter Laporan</CardTitle>
            </div>
            {(selectedCompanyId !== "ALL" ||
              selectedStatus !== "ALL" ||
              startDate ||
              endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilter}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset Filter
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            Filter diterapkan secara real-time ke semua dokumen ekspor (PDF dan Excel).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter Company */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Perusahaan</Label>
              <Select
                value={selectedCompanyId}
                onValueChange={setSelectedCompanyId}
                disabled={loadingCompanies}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Perusahaan</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Status */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status Proyek</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  {Object.entries(PROJECT_STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Rentang Tanggal: Dari */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Periode Target Dari</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Filter Rentang Tanggal: Sampai */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Periode Target Sampai</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="mt-3 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Kartu Ekspor 3 Jenis Laporan */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Pilihan Dokumen Ekspor Manajemen
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kartu 1: Laporan Status Proyek (PDF) */}
          <Card className="border-border shadow-xs hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  PDF (A4 Landscape)
                </span>
              </div>
              <CardTitle className="text-sm font-semibold mt-2">
                Laporan Status Proyek
              </CardTitle>
              <CardDescription className="text-xs">
                Ringkasan KPI eksekutif, tabel proyek, status tahapan, deviasi SLA, progres fisik, dan target penyelesaian.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 hover:bg-primary/5 hover:text-primary hover:border-primary"
                onClick={handleExportProjectStatus}
                disabled={exportingType !== null}
              >
                {exportingType === "project-status" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Menyusun PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Unduh PDF (jsPDF)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Kartu 2: Pengadaan Outstanding (Excel) */}
          <Card className="border-border shadow-xs hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  <PieChart className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  Excel (.xlsx)
                </span>
              </div>
              <CardTitle className="text-sm font-semibold mt-2">
                Pengadaan Outstanding
              </CardTitle>
              <CardDescription className="text-xs">
                Paket belum LUNAS atau barang belum tiba, tracking PO/vendor, estimasi kedatangan, keterlambatan (hari), dan sisa bayar.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500"
                onClick={handleExportProcurementOutstanding}
                disabled={exportingType !== null}
              >
                {exportingType === "procurement-outstanding" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Menyusun Excel...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Unduh Excel (.xlsx)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Kartu 3: Realisasi Anggaran Proyek (Excel) */}
          <Card className="border-border shadow-xs hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                  Excel (.xlsx)
                </span>
              </div>
              <CardTitle className="text-sm font-semibold mt-2">
                Realisasi Anggaran Proyek
              </CardTitle>
              <CardDescription className="text-xs">
                Perbandingan komprehensif total anggaran rencana vs nilai kontrak PO vs realisasi pembayaran aktual serta rasio penyerapan.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 hover:bg-sky-500/10 hover:text-sky-600 hover:border-sky-500"
                onClick={handleExportBudgetRealization}
                disabled={exportingType !== null}
              >
                {exportingType === "budget-realization" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Menyusun Excel...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Unduh Excel (.xlsx)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
