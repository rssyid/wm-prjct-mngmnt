import { AppShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BarChart3 } from "lucide-react";
import { getServerSession } from "next-auth";
import React, { Suspense } from "react";

export const metadata = {
  title: "Laporan & Portofolio Proyek | WM PRJCT MNGMNT",
};

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);

  // Ambil daftar perusahaan aktif dan region untuk filter terpadu
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      region: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

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
              Pusat kendali laporan: Overview jadwal portofolio, matriks persetujuan dokumen AR, serta pemantauan progres siklus hidup & bagian kerja.
            </p>
          </div>
        </div>

        {/* Tab Laporan (Overview | Persetujuan | Progress) */}
        <Suspense fallback={<div className="h-40 animate-pulse bg-muted/40 rounded-lg" />}>
          <ReportsView companies={companies} />
        </Suspense>
      </div>
    </AppShell>
  );
}
