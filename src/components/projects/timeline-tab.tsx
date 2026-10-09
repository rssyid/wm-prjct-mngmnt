"use client";

import {
  GanttPackageItem,
  ProjectGanttChart,
  ProjectMilestoneInfo,
} from "@/components/projects/project-gantt-chart";
import { ProjectMatrixGanttChart } from "@/components/projects/project-matrix-gantt-chart";
import {
  ProjectSCurveChart,
  SCurveLog,
  SCurvePackage,
} from "@/components/projects/project-scurve-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, GanttChartSquare, TableProperties } from "lucide-react";
import { AfceStatus } from "@prisma/client";
import React, { useMemo, useState } from "react";

interface ProjectTimelineTabProps {
  projectId: string;
  project: {
    id: string;
    targetStartDate?: string | Date | null;
    targetEndDate?: string | Date | null;
    revisedEndDate?: string | Date | null;
    status?: AfceStatus | string | null;
    currentWeek?: number;
    afceDocument?: {
      id?: string;
      emailSubmittedDate?: string | Date | null;
      mcaApprovalDate?: string | Date | null;
      status?: AfceStatus | string | null;
      noAr?: string | null;
      currentAttempt?: number;
      approvals?: Array<{
        role: string;
        status: string;
        approvedAt?: string | Date | null;
      }> | null;
    } | null;
    bastDocument?: {
      submittedAt?: string | Date | null;
      verifiedAt?: string | Date | null;
    } | null;
  };
}

export function ProjectTimelineTab({
  projectId,
  project,
}: ProjectTimelineTabProps) {
  const [ganttViewMode, setGanttViewMode] = useState<"matrix" | "bar">("matrix");

  // 1. Fetch paket kerja
  const {
    data: packagesData,
    isLoading: isPackagesLoading,
    error: packagesError,
  } = useQuery({
    queryKey: ["project-packages", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages`);
      if (!res.ok) throw new Error("Gagal mengambil data paket kerja");
      const json = await res.json();
      return json.data as GanttPackageItem[];
    },
  });

  // 2. Fetch log progres mingguan
  const {
    data: logsData,
    isLoading: isLogsLoading,
    error: logsError,
  } = useQuery({
    queryKey: ["project-progress", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/progress`);
      if (!res.ok) throw new Error("Gagal mengambil log progres mingguan");
      const json = await res.json();
      return json.data as SCurveLog[];
    },
  });

  const isLoading = isPackagesLoading || isLogsLoading;
  const hasError = packagesError || logsError;

  // Memoize Milestones
  const milestones: ProjectMilestoneInfo = useMemo(() => {
    return {
      targetStartDate: project.targetStartDate,
      targetEndDate: project.targetEndDate,
      afceSubmittedDate: project.afceDocument?.emailSubmittedDate,
      afceApprovedDate: project.afceDocument?.mcaApprovalDate,
      bastDate:
        project.bastDocument?.verifiedAt || project.bastDocument?.submittedAt,
    };
  }, [project]);

  const rawPackages: GanttPackageItem[] = useMemo(() => {
    if (Array.isArray(packagesData)) return packagesData;
    if (Array.isArray((packagesData as unknown as { data: GanttPackageItem[] })?.data)) {
      return (packagesData as unknown as { data: GanttPackageItem[] }).data;
    }
    return [];
  }, [packagesData]);

  const rawLogs: SCurveLog[] = useMemo(() => {
    if (Array.isArray(logsData)) return logsData;
    if (Array.isArray((logsData as unknown as { data: SCurveLog[] })?.data)) {
      return (logsData as unknown as { data: SCurveLog[] }).data;
    }
    return [];
  }, [logsData]);

  // Memoize Packages untuk S-Curve
  const sCurvePackages: SCurvePackage[] = useMemo(() => {
    return rawPackages.map((pkg) => ({
      id: pkg.id,
      packageName: pkg.packageName,
      weightPct: Number(pkg.weightPct) || 0,
      planStartDate: pkg.planStartDate,
      planEndDate: pkg.planEndDate,
      revisedEndDate: pkg.revisedEndDate,
    }));
  }, [rawPackages]);

  if (isLoading) {
    return <TimelineTabSkeleton />;
  }

  if (hasError) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20">
        <CardContent className="p-6 flex items-center gap-3 text-rose-700 dark:text-rose-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            Terjadi kesalahan saat memuat jadwal dan timeline proyek. Silakan coba muat ulang.
          </span>
        </CardContent>
      </Card>
    );
  }

  const packages = rawPackages;
  const logs = rawLogs;

  return (
    <div className="space-y-6">
      {/* 1. Mode Switcher Gantt Chart */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 border border-border rounded-lg p-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            Mode Tampilan Gantt:
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            &bull; Pilih format matriks mingguan (spreadsheet) atau bar horizontal
          </span>
        </div>
        <div className="flex items-center rounded-md border border-border bg-background p-0.5 shadow-2xs">
          <Button
            size="sm"
            variant={ganttViewMode === "matrix" ? "secondary" : "ghost"}
            onClick={() => setGanttViewMode("matrix")}
            className="h-7 px-3 text-xs gap-1.5 font-medium"
          >
            <TableProperties className="h-3.5 w-3.5 text-primary" />
            Matriks Mingguan
          </Button>
          <Button
            size="sm"
            variant={ganttViewMode === "bar" ? "secondary" : "ghost"}
            onClick={() => setGanttViewMode("bar")}
            className="h-7 px-3 text-xs gap-1.5 font-medium"
          >
            <GanttChartSquare className="h-3.5 w-3.5 text-primary" />
            Timeline Bar
          </Button>
        </div>
      </div>

      {/* 2. Visualisasi Gantt Chart Terpilih */}
      {ganttViewMode === "matrix" ? (
        <ProjectMatrixGanttChart
          packages={packages}
          milestones={milestones}
          targetStartDate={project.targetStartDate}
          targetEndDate={project.targetEndDate}
          afceDocument={project.afceDocument}
        />
      ) : (
        <ProjectGanttChart packages={packages} milestones={milestones} />
      )}

      {/* 3. S-Curve Recharts */}
      <ProjectSCurveChart
        targetStartDate={project.targetStartDate}
        targetEndDate={project.targetEndDate}
        revisedEndDate={project.revisedEndDate}
        isCompleted={project.status === "COMPLETED"}
        currentWeek={project.currentWeek || 1}
        packages={sCurvePackages}
        logs={logs}
        afceDocument={project.afceDocument}
      />
    </div>
  );
}

/**
 * Skeleton Loader berbentuk konten untuk lazy loading Tab Timeline
 */
export function TimelineTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Toolbar Skeleton */}
      <div className="h-14 rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>

      {/* Gantt Canvas Skeleton */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="h-10 bg-muted/50 border-b border-border flex">
          <Skeleton className="w-64 h-full" />
          <div className="flex-1" />
        </div>
        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 flex items-center px-4 gap-4">
              <Skeleton className="w-56 h-6" />
              <div className="flex-1 px-4">
                <Skeleton className="h-5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* S-Curve Skeleton */}
      <div className="border border-border rounded-lg bg-card p-4 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
