"use client";
/* eslint-disable @next/next/no-img-element */

import { AppShell } from "@/components/layout/app-shell";
import dynamic from "next/dynamic";
import { TimelineTabSkeleton } from "@/components/projects/timeline-tab";

const ProjectTimelineTab = dynamic(
  () => import("@/components/projects/timeline-tab").then((mod) => mod.ProjectTimelineTab),
  {
    loading: () => <TimelineTabSkeleton />,
    ssr: false,
  }
);
import { ProcurementTab } from "@/components/procurement/procurement-tab";
import { AfceTab } from "@/components/projects/afce-tab";
import { BastTab } from "@/components/projects/bast-tab";
import { RealizationTab } from "@/components/projects/realization-tab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AFCE_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
  STATUS_INDICATOR_CONFIG,
} from "@/lib/constants/status";
import { cn } from "@/lib/utils";
import {
  AfceStatus,
  ProjectStatus,
  Role,
  StatusIndicator,
} from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUploadButton } from "@/components/ui/file-upload-button";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Coins,
  ExternalLink,
  FileText,
  HardHat,
  Lock,
  MapPin,
  PauseCircle,
  Play,
  Search,
  ShieldAlert,
  Upload,
  XCircle,
} from "lucide-react";
import { getSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";

interface ProjectDetailResponse {
  success: boolean;
  data: {
    id: string;
    projectCode: string;
    projectName: string;
    displayName: string;
    status: ProjectStatus;
    statusBeforeHold?: ProjectStatus | null;
    onHoldReason?: string | null;
    cancellationReason?: string | null;
    statusIndicator: StatusIndicator;
    progressPct: number;
    currentWeek?: number;
    totalBudgetAmount: string | number;
    budgetType: string;
    targetQuantity: number | null;
    uom: string | null;
    targetStartDate: string | null;
    targetEndDate: string | null;
    revisedEndDate?: string | null;
    latitude: number | null;
    longitude: number | null;
    sitePlanUrl?: string | null;
    drawingUrl?: string | null;
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
      emailSubmittedDate?: string | null;
      mcaApprovalDate?: string | null;
      approvals?: Array<{
        role: string;
        status: string;
        approvedAt?: string | null;
      }> | null;
    } | null;
    bastDocument?: {
      id: string;
      submittedAt?: string | null;
      verifiedAt?: string | null;
    } | null;
  };
}

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const routeParams = useParams();
  const projectId = (routeParams?.id as string) || params?.id;
  const queryClient = useQueryClient();

  // Sesi Pengguna
  const { data: sessionData } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => getSession(),
  });
  const user = sessionData?.user;
  const userRole = user?.role as Role | undefined;

  // Dialog Transisi State
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [isResumeConfirmOpen, setIsResumeConfirmOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isStartSurveyConfirmOpen, setIsStartSurveyConfirmOpen] = useState(false);
  const [isStartWorkConfirmOpen, setIsStartWorkConfirmOpen] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Fetch Detail Proyek
  const { data, isLoading, error, refetch } = useQuery<ProjectDetailResponse>({
    queryKey: ["project-detail", projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error("ID Proyek tidak valid");
      }
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Gagal mengambil data proyek (HTTP ${res.status})`);
      }
      return res.json();
    },
    enabled: Boolean(projectId),
  });

  const project = data?.data;
  const statusCfg = project ? PROJECT_STATUS_CONFIG[project.status] : null;
  const ewsCfg = project
    ? STATUS_INDICATOR_CONFIG[project.statusIndicator]
    : null;

  const isCompleted = project?.status === ProjectStatus.COMPLETED;
  const isCancelled = project?.status === ProjectStatus.CANCELLED;
  const isOnHold = project?.status === ProjectStatus.ON_HOLD;
  const isSuperAdmin = userRole === Role.SUPER_ADMIN;
  const canManage =
    userRole === Role.SUPER_ADMIN || userRole === Role.WM_HO_SPECIALIST;

  // Dialog & Form Dokumen Proyek
  const [isEditDocDialogOpen, setIsEditDocDialogOpen] = useState(false);
  const [editSitePlanUrl, setEditSitePlanUrl] = useState<string | null>(null);
  const [editDrawingUrl, setEditDrawingUrl] = useState<string | null>(null);
  const [docUpdateError, setDocUpdateError] = useState<string | null>(null);

  const openDocEditDialog = () => {
    setEditSitePlanUrl(project?.sitePlanUrl || null);
    setEditDrawingUrl(project?.drawingUrl || null);
    setDocUpdateError(null);
    setIsEditDocDialogOpen(true);
  };

  const updateDocsMutation = useMutation({
    mutationFn: async () => {
      setDocUpdateError(null);
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitePlanUrl: editSitePlanUrl,
          drawingUrl: editDrawingUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memperbarui dokumen");
      }
      return json.data;
    },
    onSuccess: () => {
      setIsEditDocDialogOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
    },
    onError: (err: Error) => {
      setDocUpdateError(err.message);
    },
  });

  // Mutasi Transisi Status Proyek
  const transitionMutation = useMutation({
    mutationFn: async ({
      action,
      reason,
      remarks,
    }: {
      action: string;
      reason?: string;
      remarks?: string;
    }) => {
      setTransitionError(null);
      const res = await fetch(`/api/projects/${projectId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, remarks }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengubah status proyek");
      }
      return json.data;
    },
    onSuccess: () => {
      setIsHoldDialogOpen(false);
      setHoldReason("");
      setIsResumeConfirmOpen(false);
      setIsCancelConfirmOpen(false);
      setCancelReason("");
      setIsStartSurveyConfirmOpen(false);
      setIsStartWorkConfirmOpen(false);

      refetch();
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["bast-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => {
      setTransitionError(err.message);
    },
  });

  return (
    <AppShell user={user}>
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

        {/* Notifikasi Error Transisi */}
        {transitionError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="space-y-1">
              <p className="font-semibold">Transisi Gagal</p>
              <p>{transitionError}</p>
            </div>
          </div>
        )}

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
                {error instanceof Error
                  ? error.message
                  : "Data proyek yang Anda tuju mungkin telah dihapus."}
              </p>
              <Button size="sm" asChild variant="outline">
                <Link href="/projects">Kembali ke Daftar</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Banner Status Khusus: COMPLETED, CANCELLED, ON_HOLD */}
            {isCompleted && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/90 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-4 shadow-xs flex items-start gap-3.5">
                <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h3 className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                    Proyek Terkunci (Read-Only Permanen)
                  </h3>
                  <p className="text-emerald-800 dark:text-emerald-400">
                    Proyek telah berstatus{" "}
                    <span className="font-semibold font-mono">COMPLETED</span>{" "}
                    dan BAST telah diverifikasi. Sesuai aturan bisnis B9, seluruh
                    mutasi data pada proyek ini terkunci secara permanen dan tidak
                    dapat diubah kembali.
                  </p>
                </div>
              </div>
            )}

            {isCancelled && (
              <div className="rounded-lg border border-rose-300 bg-rose-50/90 dark:border-rose-900/60 dark:bg-rose-950/40 p-4 shadow-xs flex items-start gap-3.5">
                <div className="rounded-md bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400 shrink-0">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h3 className="font-bold text-rose-900 dark:text-rose-300 text-sm">
                    Proyek Dibatalkan (CANCELLED)
                  </h3>
                  <p className="text-rose-800 dark:text-rose-400">
                    Proyek telah dibatalkan oleh SUPER_ADMIN. Alasan pembatalan:{" "}
                    <span className="font-medium italic">
                      &quot;{project.cancellationReason || "Tidak disebutkan"}&quot;
                    </span>
                    . Tidak ada aktivitas atau mutasi yang dapat dilanjutkan.
                  </p>
                </div>
              </div>
            )}

            {isOnHold && (
              <div className="rounded-lg border border-amber-300 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/40 p-4 shadow-xs flex items-start gap-3.5">
                <div className="rounded-md bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400 shrink-0">
                  <PauseCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h3 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                    Proyek Ditahan Sementara (ON_HOLD)
                  </h3>
                  <p className="text-amber-800 dark:text-amber-400">
                    Proyek sedang ditangguhkan dan kalkulasi EWS SLA dibekukan.
                    Alasan penahanan:{" "}
                    <span className="font-medium italic">
                      &quot;{project.onHoldReason || "Tidak disebutkan"}&quot;
                    </span>
                    .
                  </p>
                </div>
              </div>
            )}

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
                        className={cn(
                          "text-xs px-2.5 py-0.5 font-medium border",
                          statusCfg.badgeClass
                        )}
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
                        <span
                          className={cn("h-2 w-2 rounded-full", ewsCfg.dotClass)}
                        />
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
                <div className="bg-muted/40 border border-border rounded-lg p-3 min-w-[180px] text-right space-y-1.5 shrink-0">
                  <div className="text-xs text-muted-foreground">
                    Progres Fisik Aktual
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                    {Math.round(project.progressPct * 10) / 10}%
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, project.progressPct)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Toolbar Transisi */}
              {!isCompleted && !isCancelled && canManage && (
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* T1: START_SURVEY (hanya dari DRAFT) */}
                    {project.status === ProjectStatus.DRAFT && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsStartSurveyConfirmOpen(true)}
                        className="h-8 text-xs border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40"
                      >
                        <Search className="h-3.5 w-3.5 mr-1 text-sky-600" />
                        Mulai Survei
                      </Button>
                    )}

                    {/* T6: START_PHYSICAL_WORK (hanya dari PROCUREMENT) */}
                    {project.status === ProjectStatus.PROCUREMENT && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsStartWorkConfirmOpen(true)}
                        className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                      >
                        <HardHat className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                        Mulai Pekerjaan Fisik
                      </Button>
                    )}

                    {/* T9: HOLD (dari status aktif mana pun kecuali ON_HOLD) */}
                    {!isOnHold && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setHoldReason("");
                          setIsHoldDialogOpen(true);
                        }}
                        className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                      >
                        <PauseCircle className="h-3.5 w-3.5 mr-1 text-amber-600" />
                        Tahan Proyek
                      </Button>
                    )}

                    {/* T9: RESUME (hanya saat ON_HOLD) */}
                    {isOnHold && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setIsResumeConfirmOpen(true)}
                        className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Lanjutkan Proyek
                      </Button>
                    )}
                  </div>

                  {/* T10: CANCEL (khusus SUPER_ADMIN) */}
                  {isSuperAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCancelReason("");
                        setIsCancelConfirmOpen(true);
                      }}
                      className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 mr-1 text-rose-500" />
                      Batalkan Proyek
                    </Button>
                  )}
                </div>
              )}

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
                      ? new Date(project.targetStartDate).toLocaleDateString(
                          "id-ID"
                        )
                      : "-"}{" "}
                    s/d{" "}
                    {project.targetEndDate
                      ? new Date(project.targetEndDate).toLocaleDateString(
                          "id-ID"
                        )
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

            {/* Tab Navigasi Modul */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="h-11 sm:h-12 p-1.5 gap-1.5 bg-muted/80 border border-border/80 rounded-xl shadow-xs">
                <TabsTrigger
                  value="overview"
                  className="text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                >
                  Ikhtisar
                </TabsTrigger>
                <TabsTrigger
                  value="timeline"
                  className="text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                >
                  Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="afce"
                  className="text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                >
                  AFCE & AR
                </TabsTrigger>
                <TabsTrigger
                  value="packages"
                  className="text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                >
                  Paket Pengadaan
                </TabsTrigger>
                <TabsTrigger
                  value="progress"
                  className="text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                >
                  Realisasi
                </TabsTrigger>
                <TabsTrigger
                  value="bast"
                  className="text-xs sm:text-sm font-medium px-3.5 py-2 rounded-lg transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                >
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
                        <h4 className="font-semibold text-foreground">
                          Koordinat Lokasi
                        </h4>
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
                        <h4 className="font-semibold text-foreground">
                          Target Fisik
                        </h4>
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

                    {/* Card Dokumen & Gambar Teknis */}
                    <div className="rounded-md border p-4 space-y-3 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-primary" />
                          Dokumen Perencanaan & Gambar Teknis (R2 Storage)
                        </h4>
                        {!isCompleted && !isCancelled && canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={openDocEditDialog}
                          >
                            <Upload className="h-3 w-3" />
                            Unggah / Ubah Berkas
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Site Plan Preview / Link */}
                        <div className="rounded border bg-background p-3 space-y-2">
                          <span className="text-[11px] font-medium text-muted-foreground block">
                            Site Plan / Peta Denah:
                          </span>
                          {project.sitePlanUrl ? (
                            <div className="space-y-2">
                              {project.sitePlanUrl.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ? (
                                <div className="rounded overflow-hidden border aspect-video max-h-36 bg-muted/20">
                                  {/* Native img tag - TANPA next/image optimizer sesuai aturan STACK.md §4 */}
                                  <img
                                    src={project.sitePlanUrl}
                                    alt="Site Plan"
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : null}
                              <a
                                href={project.sitePlanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Buka Dokumen Site Plan
                              </a>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Belum ada berkas Site Plan yang diunggah.
                            </p>
                          )}
                        </div>

                        {/* Drawing / DED Link */}
                        <div className="rounded border bg-background p-3 space-y-2">
                          <span className="text-[11px] font-medium text-muted-foreground block">
                            Gambar Kerja Teknis (DED / Drawing):
                          </span>
                          {project.drawingUrl ? (
                            <div className="space-y-2">
                              {project.drawingUrl.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ? (
                                <div className="rounded overflow-hidden border aspect-video max-h-36 bg-muted/20">
                                  {/* Native img tag - TANPA next/image optimizer sesuai aturan STACK.md §4 */}
                                  <img
                                    src={project.drawingUrl}
                                    alt="Drawing"
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : null}
                              <a
                                href={project.drawingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Buka Gambar Kerja (DED)
                              </a>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Belum ada berkas Gambar Kerja yang diunggah.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeline">
                <ProjectTimelineTab
                  projectId={project.id}
                  project={{
                    id: project.id,
                    targetStartDate: project.targetStartDate,
                    targetEndDate: project.targetEndDate,
                    revisedEndDate: project.revisedEndDate,
                    status: project.status,
                    currentWeek: project.currentWeek,
                    afceDocument: project.afceDocument,
                    bastDocument: project.bastDocument,
                  }}
                />
              </TabsContent>

              <TabsContent value="afce">
                <AfceTab
                  projectId={project.id}
                  projectStatus={project.status}
                  defaultBudgetAmount={
                    project.totalBudgetAmount ? Number(project.totalBudgetAmount) : 0
                  }
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
                <BastTab
                  projectId={project.id}
                  projectStatus={project.status}
                  userRole={userRole}
                  onProjectUpdated={refetch}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Dialog HOLD: Tahan Proyek */}
      <Dialog open={isHoldDialogOpen} onOpenChange={setIsHoldDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <PauseCircle className="h-5 w-5" />
              Tahan Proyek (ON_HOLD)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Proyek akan ditangguhkan sementara dan perhitungan SLA EWS dibekukan. Masukkan alasan penahanan yang valid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="holdReason" className="text-xs font-semibold">
              Alasan Penahanan <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="holdReason"
              rows={3}
              placeholder="Contoh: Menunggu keputusan revisi desain oleh pihak manajemen..."
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHoldDialogOpen(false)}
              disabled={transitionMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!holdReason.trim()) return;
                transitionMutation.mutate({
                  action: "HOLD",
                  reason: holdReason.trim(),
                });
              }}
              disabled={!holdReason.trim() || transitionMutation.isPending}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {transitionMutation.isPending ? "Menyimpan..." : "Tahan Proyek"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog RESUME: Lanjutkan Proyek */}
      <AlertDialog
        open={isResumeConfirmOpen}
        onOpenChange={setIsResumeConfirmOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-600" />
              Lanjutkan Proyek
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-1 text-muted-foreground">
              <span>
                Status proyek akan dikembalikan ke status sebelum ditahan:
              </span>
              <span className="block font-semibold font-mono text-foreground">
                {project?.statusBeforeHold || "STATUS SEBELUMNYA"}
              </span>
              <span className="block mt-1">
                Kalkulasi EWS SLA akan kembali diaktifkan.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={transitionMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                transitionMutation.mutate({ action: "RESUME" });
              }}
              disabled={transitionMutation.isPending}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {transitionMutation.isPending ? "Memproses..." : "Ya, Lanjutkan Proyek"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog CANCEL: Batalkan Proyek (SUPER_ADMIN) */}
      <AlertDialog
        open={isCancelConfirmOpen}
        onOpenChange={setIsCancelConfirmOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
              Batalkan Proyek (CANCEL)
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2 text-muted-foreground">
              <span className="block text-rose-700 dark:text-rose-400 font-medium">
                PERINGATAN: Pembatalan proyek bersifat final dan permanen. Proyek yang dibatalkan tidak dapat diaktifkan kembali.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="cancelReason" className="text-xs font-semibold">
              Alasan Pembatalan <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="cancelReason"
              rows={3}
              placeholder="Contoh: Pembatalan program investasi regional oleh BOD..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={transitionMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!cancelReason.trim()) return;
                transitionMutation.mutate({
                  action: "CANCEL",
                  reason: cancelReason.trim(),
                });
              }}
              disabled={!cancelReason.trim() || transitionMutation.isPending}
              className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {transitionMutation.isPending ? "Membatalkan..." : "Batalkan Proyek"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Mulai Survei (T1) */}
      <AlertDialog
        open={isStartSurveyConfirmOpen}
        onOpenChange={setIsStartSurveyConfirmOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Konfirmasi Mulai Survei Lapangan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Status proyek akan berpindah dari <span className="font-mono font-semibold text-foreground">DRAFT</span> ke <span className="font-mono font-semibold text-primary">SURVEY</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={transitionMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                transitionMutation.mutate({ action: "START_SURVEY" });
              }}
              disabled={transitionMutation.isPending}
              className="h-8 text-xs"
            >
              {transitionMutation.isPending ? "Memproses..." : "Mulai Survei"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Mulai Pekerjaan Fisik (T6) */}
      <AlertDialog
        open={isStartWorkConfirmOpen}
        onOpenChange={setIsStartWorkConfirmOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Konfirmasi Mulai Pekerjaan Fisik
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Status proyek akan berpindah dari <span className="font-mono font-semibold text-foreground">PROCUREMENT</span> ke <span className="font-mono font-semibold text-primary">EXECUTION</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={transitionMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                transitionMutation.mutate({ action: "START_PHYSICAL_WORK" });
              }}
              disabled={transitionMutation.isPending}
              className="h-8 text-xs"
            >
              {transitionMutation.isPending ? "Memproses..." : "Mulai Pekerjaan Fisik"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Unggah / Ubah Dokumen Teknis Proyek */}
      <Dialog open={isEditDocDialogOpen} onOpenChange={setIsEditDocDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Unggah / Perbarui Dokumen Teknis
            </DialogTitle>
            <DialogDescription className="text-xs">
              Unggah berkas Site Plan dan Gambar Kerja (DED) langsung ke Cloudflare R2.
            </DialogDescription>
          </DialogHeader>

          {docUpdateError && (
            <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{docUpdateError}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5 rounded-md border p-3 bg-muted/10">
              <Label className="text-xs font-semibold">
                Site Plan / Peta Denah
              </Label>
              <FileUploadButton
                value={editSitePlanUrl}
                onChange={setEditSitePlanUrl}
                folder="projects"
                accept="image/*,application/pdf"
                label="Unggah Site Plan"
              />
            </div>

            <div className="space-y-1.5 rounded-md border p-3 bg-muted/10">
              <Label className="text-xs font-semibold">
                Gambar Kerja Teknis (DED / Drawing)
              </Label>
              <FileUploadButton
                value={editDrawingUrl}
                onChange={setEditDrawingUrl}
                folder="projects"
                accept="image/*,application/pdf,.xlsx,.xls"
                label="Unggah Gambar Kerja"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDocDialogOpen(false)}
              disabled={updateDocsMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => updateDocsMutation.mutate()}
              disabled={updateDocsMutation.isPending}
              className="h-8 text-xs font-semibold"
            >
              {updateDocsMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
