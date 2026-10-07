import { AppShell } from "@/components/layout/app-shell";
import { ReportExportSection } from "@/components/reports/report-export-section";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authOptions } from "@/lib/auth";
import { BarChart3 } from "lucide-react";
import { getServerSession } from "next-auth";
import dynamic from "next/dynamic";
import React from "react";

export const metadata = {
  title: "Laporan & Portofolio Proyek | WM PRJCT MNGMNT",
};

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

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);

  return (
    <AppShell user={session?.user}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Halaman */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Laporan & Portofolio Proyek
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Visualisasi terpadu jadwal portofolio, timeline proyek aktif, dan ringkasan ekspor laporan.
            </p>
          </div>
        </div>

        {/* 1. Timeline Portofolio Proyek Aktif */}
        <PortfolioGanttChart
          title="Timeline Portofolio Seluruh Proyek"
          description="Pantau sebaran jadwal dan deviasi seluruh proyek aktif dalam satu timeline interaktif."
        />

        {/* 2. Modul Ekspor Laporan Manajemen (F-09) */}
        <ReportExportSection />
      </div>
    </AppShell>
  );
}
