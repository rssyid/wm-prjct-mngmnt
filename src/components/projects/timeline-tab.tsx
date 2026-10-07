"use client";

import {
  GanttPackageItem,
  ProjectGanttChart,
  ProjectMilestoneInfo,
} from "@/components/projects/project-gantt-chart";
import {
  ProjectSCurveChart,
  SCurveLog,
  SCurvePackage,
} from "@/components/projects/project-scurve-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import React, { useMemo } from "react";

interface ProjectTimelineTabProps {
  projectId: string;
  project: {
    id: string;
    targetStartDate?: string | Date | null;
    targetEndDate?: string | Date | null;
    currentWeek?: number;
    afceDocument?: {
      emailSubmittedDate?: string | Date | null;
      mcaApprovalDate?: string | Date | null;
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

  // Memoize Packages untuk S-Curve
  const sCurvePackages: SCurvePackage[] = useMemo(() => {
    if (!packagesData) return [];
    return packagesData.map((pkg) => ({
      id: pkg.id,
      packageName: pkg.packageName,
      weightPct: pkg.weightPct,
    }));
  }, [packagesData]);

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

  const packages = packagesData || [];
  const logs = logsData || [];

  return (
    <div className="space-y-6">
      {/* 1. Gantt Chart Detail Paket Kerja */}
      <ProjectGanttChart packages={packages} milestones={milestones} />

      {/* 2. S-Curve Recharts */}
      <ProjectSCurveChart
        targetStartDate={project.targetStartDate}
        targetEndDate={project.targetEndDate}
        currentWeek={project.currentWeek || 1}
        packages={sCurvePackages}
        logs={logs}
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
