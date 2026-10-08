"use client";

import {
  EquipmentLogRow,
  EquipmentLogTable,
} from "@/components/projects/equipment-log-table";
import {
  ProgressLogRow,
  WorkPackageData,
  WorkPackageProgressCard,
} from "@/components/projects/work-package-progress-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectStatus } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Layers,
  TrendingUp,
  Truck,
} from "lucide-react";
import React, { useMemo } from "react";

interface RealizationTabProps {
  projectId: string;
  projectStatus: ProjectStatus;
  currentWeek?: number;
  projectProgressPct?: number;
  onProjectUpdated?: () => void;
}

export function RealizationTab({
  projectId,
  projectStatus,
  currentWeek: initialCurrentWeek,
  projectProgressPct: initialProgressPct,
  onProjectUpdated,
}: RealizationTabProps) {
  const isCompleted = projectStatus === ProjectStatus.COMPLETED;

  // 1. Fetch data paket kerja
  const {
    data: packagesData,
    isLoading: isPackagesLoading,
    error: packagesError,
    refetch: refetchPackages,
  } = useQuery({
    queryKey: ["project-packages", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages`);
      if (!res.ok) throw new Error("Gagal mengambil data paket kerja");
      const json = await res.json();
      return json.data as WorkPackageData[];
    },
  });

  // 2. Fetch data log progres mingguan
  const {
    data: progressLogsData,
    isLoading: isProgressLogsLoading,
    refetch: refetchProgressLogs,
  } = useQuery({
    queryKey: ["project-progress", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/progress`);
      if (!res.ok) throw new Error("Gagal mengambil log progres");
      const json = await res.json();
      return json.data as ProgressLogRow[];
    },
  });

  // 3. Fetch data log alat berat
  const {
    data: equipmentLogsData,
    isLoading: isEquipmentLoading,
  } = useQuery({
    queryKey: ["project-equipment", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/equipment`);
      if (!res.ok) throw new Error("Gagal mengambil log alat berat");
      const json = await res.json();
      return json.data as EquipmentLogRow[];
    },
  });

  // 4. Fetch detail proyek untuk memastikan currentWeek & progressPct up-to-date
  const { data: projectRes } = useQuery({
    queryKey: ["project-detail", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Gagal mengambil info proyek");
      return res.json();
    },
  });

  interface ApiWrapper<T> {
    data?: T;
  }

  const rawProject = projectRes as ApiWrapper<{ currentWeek?: number; progressPct?: number }> | { currentWeek?: number; progressPct?: number } | undefined;
  const projectData = (rawProject && "data" in rawProject && rawProject.data) ? rawProject.data : (rawProject as { currentWeek?: number; progressPct?: number } | undefined);

  const currentWeek =
    projectData?.currentWeek ?? initialCurrentWeek ?? 1;
  const projectProgressPct =
    projectData?.progressPct ?? initialProgressPct ?? 0;

  const packages: WorkPackageData[] = useMemo(() => {
    if (Array.isArray(packagesData)) return packagesData;
    const wrapped = packagesData as unknown as ApiWrapper<WorkPackageData[]> | undefined;
    if (wrapped && Array.isArray(wrapped.data)) return wrapped.data;
    return [];
  }, [packagesData]);

  const progressLogs: ProgressLogRow[] = useMemo(() => {
    if (Array.isArray(progressLogsData)) return progressLogsData;
    const wrapped = progressLogsData as unknown as ApiWrapper<ProgressLogRow[]> | undefined;
    if (wrapped && Array.isArray(wrapped.data)) return wrapped.data;
    return [];
  }, [progressLogsData]);

  const equipmentLogs: EquipmentLogRow[] = useMemo(() => {
    if (Array.isArray(equipmentLogsData)) return equipmentLogsData;
    const wrapped = equipmentLogsData as unknown as ApiWrapper<EquipmentLogRow[]> | undefined;
    if (wrapped && Array.isArray(wrapped.data)) return wrapped.data;
    return [];
  }, [equipmentLogsData]);

  // Hitung ulang progres proyek tertimbang dari data paket lokal untuk verifikasi visual
  const calculatedTotalProgress = useMemo(() => {
    if (!packages.length) return 0;
    const sum = packages.reduce(
      (acc, wp) => acc + (wp.progressPct || 0) * (wp.weightPct || 0) / 100,
      0
    );
    return Math.min(100, Math.max(0, Math.round(sum * 100) / 100));
  }, [packages]);

  const displayProgress = projectProgressPct || calculatedTotalProgress;

  const handleMutated = () => {
    refetchPackages();
    refetchProgressLogs();
    onProjectUpdated?.();
  };

  const isLoading = isPackagesLoading || isProgressLogsLoading;

  return (
    <div className="space-y-6">
      {/* Top Banner Realisasi: Minggu Berjalan & Progres Total Tertimbang */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Info Minggu Berjalan */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    Minggu Berjalan Proyek: Minggu ke-{currentWeek}
                  </h3>
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0">
                    Aktif
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hanya log pada minggu berjalan yang dapat di-edit atau dihapus. Log minggu sebelumnya terkunci (Aturan B6).
                </p>
              </div>
            </div>

            {/* Agregat Progres Tertimbang Proyek */}
            <div className="flex items-center gap-4 bg-muted/40 p-3 rounded-lg border border-border min-w-[240px]">
              <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">
                    Total Progres Tertimbang
                  </span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {displayProgress}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub Tabs Realisasi */}
      <Tabs defaultValue="packages-progress" className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="packages-progress" className="text-xs flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Progres Paket Kerja ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="equipment" className="text-xs flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Log Alat Berat ({equipmentLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Progres Paket Kerja */}
        <TabsContent value="packages-progress" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : packagesError ? (
            <Card className="border-rose-200 bg-rose-50/50">
              <CardContent className="py-6 text-center text-xs text-rose-700 space-y-2">
                <AlertCircle className="h-6 w-6 text-rose-500 mx-auto" />
                <p>Gagal memuat daftar paket kerja.</p>
              </CardContent>
            </Card>
          ) : packages.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center space-y-3">
                <Layers className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="text-sm font-semibold text-foreground">
                  Belum Ada Paket Kerja Pengadaan
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Silakan buat paket kerja terlebih dahulu pada tab{" "}
                  <strong>Paket Pengadaan</strong> sebelum mencatat log progres mingguan.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {packages.map((wp) => (
                <WorkPackageProgressCard
                  key={wp.id}
                  workPackage={wp}
                  projectId={projectId}
                  currentWeek={currentWeek}
                  isCompleted={isCompleted}
                  logs={progressLogs}
                  onMutated={handleMutated}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Log Alat Berat */}
        <TabsContent value="equipment">
          <EquipmentLogTable
            projectId={projectId}
            isCompleted={isCompleted}
            logs={equipmentLogs}
            workPackages={packages}
            isLoading={isEquipmentLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
