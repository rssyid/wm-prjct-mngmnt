"use client";

import { AppShell } from "@/components/layout/app-shell";
import { AfceTab } from "@/components/projects/afce-tab";
import { ProcurementTab } from "@/components/procurement/procurement-tab";
import { RealizationTab } from "@/components/projects/realization-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AFCE_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
  STATUS_INDICATOR_CONFIG,
} from "@/lib/constants/status";
import { cn } from "@/lib/utils";
import { AfceStatus, ProjectStatus, StatusIndicator } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Coins,
  FolderKanban,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import React from "react";

interface ProjectDetailResponse {
  success: boolean;
  data: {
    id: string;
    projectCode: string;
    projectName: string;
    displayName: string;
    status: ProjectStatus;
    statusIndicator: StatusIndicator;
    progressPct: number;
    currentWeek?: number;
    totalBudgetAmount: string | number;
    budgetType: string;
    targetQuantity: number | null;
    uom: string | null;
    targetStartDate: string | null;
    targetEndDate: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
    company: { id: string; code: string; name: string };
    estate: { id: string; code: string; name: string };
    block: { id: string; blockCode: string; name: string } | null;
    folderCategory: { id: string; code: string; name: string };
    structureType: { id: string; name: string };
    structureVariant: { id: string; code: string; name: string } | null;
    createdBy: { id: string; name: string; email: string } | null;
    afceDocument: {
      id: string;
      status: AfceStatus;
      noAr: string | null;
      currentAttempt: number;
    } | null;
  };
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error, refetch } = useQuery<ProjectDetailResponse>({
    queryKey: ["project-detail", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${params.id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengambil data proyek");
      }
      return res.json();
    },
  });

  const project = data?.data;
  const statusCfg = project ? PROJECT_STATUS_CONFIG[project.status] : null;
  const ewsCfg = project ? STATUS_INDICATOR_CONFIG[project.statusIndicator] : null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Navigation Back */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/projects">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali ke Daftar Proyek
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : error || !project ? (
          <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
            <CardContent className="py-12 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-semibold text-rose-700 dark:text-rose-400">
                Proyek Tidak Ditemukan
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {error instanceof Error ? error.message : "Data proyek yang Anda tuju mungkin telah dihapus."}
              </p>
              <Button size="sm" asChild variant="outline">
                <Link href="/projects">Kembali ke Daftar</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Header Informasi Proyek */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-bold bg-muted px-2.5 py-0.5 rounded-md border text-foreground tabular-nums">
                      {project.projectCode}
                    </span>
                    {statusCfg && (
                      <Badge
                        variant="outline"
                        className={cn("text-xs px-2.5 py-0.5 font-medium border", statusCfg.badgeClass)}
                      >
                        {statusCfg.label}
                      </Badge>
                    )}
                    {/* Badge Status AFCE */}
                    {project.afceDocument ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs px-2.5 py-0.5 font-medium border",
                          AFCE_STATUS_CONFIG[project.afceDocument.status].badgeClass
                        )}
                      >
                        AFCE: {AFCE_STATUS_CONFIG[project.afceDocument.status].label}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs px-2.5 py-0.5 font-medium border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        AFCE: Belum Ada
                      </Badge>
                    )}
                    {ewsCfg && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium pl-1">
                        <span className={cn("h-2 w-2 rounded-full", ewsCfg.dotClass)} />
                        <span>{ewsCfg.label}</span>
                      </div>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {project.projectName}
                  </h1>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>Display: {project.displayName}</span>
                    <span>•</span>
                    <span>Tipe: {project.structureType?.name}</span>
                    {project.structureVariant && (
                      <>
                        <span>•</span>
                        <span>Varian: {project.structureVariant.name}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Progress Mini Box */}
                <div className="bg-muted/40 border border-border rounded-lg p-3 min-w-[180px] text-right space-y-1.5">
                  <div className="text-xs text-muted-foreground">Progres Fisik Aktual</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                    {Math.round(project.progressPct * 10) / 10}%
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, project.progressPct))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border text-xs">
                <div className="space-y-0.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Lokasi
                  </div>
                  <div className="font-semibold text-foreground">
                    {project.company.code} - {project.estate.code}
                    {project.block && ` (${project.block.blockCode})`}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" /> Total Anggaran
                  </div>
                  <div className="font-semibold text-foreground font-mono tabular-nums">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    }).format(Number(project.totalBudgetAmount) || 0)}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Target Waktu
                  </div>
                  <div className="font-semibold text-foreground">
                    {project.targetStartDate
                      ? new Date(project.targetStartDate).toLocaleDateString("id-ID")
                      : "-"}{" "}
                    s/d{" "}
                    {project.targetEndDate
                      ? new Date(project.targetEndDate).toLocaleDateString("id-ID")
                      : "-"}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Dibuat Oleh
                  </div>
                  <div className="font-semibold text-foreground">
                    {project.createdBy?.name || "System"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigasi Modul Selanjutnya */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-muted/60 p-1">
                <TabsTrigger value="overview" className="text-xs">
                  Ikhtisar
                </TabsTrigger>
                <TabsTrigger value="afce" className="text-xs">
                  AFCE & AR
                </TabsTrigger>
                <TabsTrigger value="packages" className="text-xs">
                  Paket Pengadaan
                </TabsTrigger>
                <TabsTrigger value="progress" className="text-xs">
                  Realisasi
                </TabsTrigger>
                <TabsTrigger value="bast" className="text-xs">
                  BAST
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <Card className="border-border shadow-xs">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      Detail Teknis & Geografis Proyek
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Parameter fisik struktur, koordinat titik GIS, dan spesifikasi pelaksanaan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-md border p-4 space-y-2 bg-muted/20">
                        <h4 className="font-semibold text-foreground">Koordinat Lokasi</h4>
                        <p className="text-muted-foreground">
                          Latitude:{" "}
                          <span className="font-mono text-foreground font-medium">
                            {project.latitude ?? "Belum ditentukan"}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Longitude:{" "}
                          <span className="font-mono text-foreground font-medium">
                            {project.longitude ?? "Belum ditentukan"}
                          </span>
                        </p>
                      </div>

                      <div className="rounded-md border p-4 space-y-2 bg-muted/20">
                        <h4 className="font-semibold text-foreground">Target Fisik</h4>
                        <p className="text-muted-foreground">
                          Target Kuantitas:{" "}
                          <span className="font-semibold text-foreground">
                            {project.targetQuantity ?? 1} {project.uom || "unit"}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Kategori Folder:{" "}
                          <span className="font-semibold text-foreground">
                            {project.folderCategory.name}
                          </span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="afce">
                <AfceTab
                  projectId={project.id}
                  projectStatus={project.status}
                  onProjectUpdated={refetch}
                />
              </TabsContent>

              <TabsContent value="packages">
                <ProcurementTab
                  projectId={project.id}
                  projectStatus={project.status}
                  afceStatus={project.afceDocument?.status ?? null}
                />
              </TabsContent>

              <TabsContent value="progress">
                <RealizationTab
                  projectId={project.id}
                  projectStatus={project.status}
                  currentWeek={project.currentWeek}
                  projectProgressPct={project.progressPct}
                  onProjectUpdated={refetch}
                />
              </TabsContent>

              <TabsContent value="bast">
                <Card className="border-border shadow-xs">
                  <CardContent className="py-12 text-center space-y-2">
                    <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Berita Acara Serah Terima (BAST)
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Dokumen serah terima fisik dan verifikasi akhir SUPER_ADMIN.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AppShell>
  );
}
