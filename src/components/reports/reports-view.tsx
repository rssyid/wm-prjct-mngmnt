"use client";

import { ApprovalMatrixTab } from "@/components/reports/approval-matrix-tab";
import { CompanyWithRegion } from "@/components/reports/company-multi-select";
import { ProjectProgressTab } from "@/components/reports/project-progress-tab";
import { ReportExportSection } from "@/components/reports/report-export-section";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Compass,
  FileCheck2,
  LayoutDashboard,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useTransition } from "react";

// Lazy load PortfolioGanttChart sesuai aturan docs/design.md §4
const PortfolioGanttChart = dynamic(
  () =>
    import("@/components/reports/portfolio-gantt-chart").then(
      (m) => m.PortfolioGanttChart
    ),
  {
    loading: () => <PortfolioGanttSkeleton />,
    ssr: false,
  }
);

function PortfolioGanttSkeleton() {
  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-56 mb-1" />
        <Skeleton className="h-3 w-80" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ReportsViewProps {
  companies: CompanyWithRegion[];
}

export function ReportsView({ companies }: ReportsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentTab = searchParams.get("tab") || "overview";

  const handleTabChange = useCallback(
    (value: string) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", value);
        router.replace(`/reports?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  return (
    <Tabs
      value={currentTab}
      onValueChange={handleTabChange}
      className="space-y-6"
    >
      <div className="border-b border-border pb-2">
        <TabsList className="h-10 bg-muted/50 p-1">
          <TabsTrigger
            value="overview"
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs gap-1.5 px-4"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Tab 1: Overview
          </TabsTrigger>
          <TabsTrigger
            value="approval"
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs gap-1.5 px-4"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            Tab 2: Persetujuan
          </TabsTrigger>
          <TabsTrigger
            value="progress"
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs gap-1.5 px-4"
          >
            <Compass className="h-3.5 w-3.5" />
            Tab 3: Progress
          </TabsTrigger>
        </TabsList>
      </div>

      {/* TAB 1: OVERVIEW */}
      <TabsContent value="overview" className="space-y-6 m-0 focus-visible:outline-hidden">
        {/* Timeline Portofolio Seluruh Proyek */}
        <PortfolioGanttChart
          title="Timeline Portofolio Seluruh Proyek"
          description="Pantau sebaran jadwal dan deviasi seluruh proyek aktif dalam satu timeline interaktif."
        />

        {/* Modul Ekspor Laporan Manajemen (F-09) */}
        <ReportExportSection />
      </TabsContent>

      {/* TAB 2: PERSETUJUAN */}
      <TabsContent value="approval" className="space-y-6 m-0 focus-visible:outline-hidden">
        <ApprovalMatrixTab companies={companies} />
      </TabsContent>

      {/* TAB 3: PROGRESS */}
      <TabsContent value="progress" className="space-y-6 m-0 focus-visible:outline-hidden">
        <ProjectProgressTab companies={companies} />
      </TabsContent>
    </Tabs>
  );
}
