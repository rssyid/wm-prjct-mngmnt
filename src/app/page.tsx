import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { PROJECT_STATUS_CONFIG, STATUS_INDICATOR_CONFIG } from "@/lib/constants/status";
import { Activity, Clock, FolderKanban, ShieldCheck } from "lucide-react";
import { getServerSession } from "next-auth";

export const metadata = {
  title: "Dashboard | WM PRJCT MNGMNT",
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <AppShell user={session?.user}>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ringkasan Portofolio Proyek
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Selamat datang kembali, <span className="font-semibold text-foreground">{session?.user?.name}</span>. Pantau siklus hidup proyek Water Management dari perencanaan hingga serah terima.
          </p>
        </div>

        {/* Quick Stat Placeholders */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Proyek Aktif
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Data akan tampil setelah modul proyek diisi
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status EWS (SLA)
              </CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold tabular-nums">100%</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_INDICATOR_CONFIG.ON_TRACK.badgeClass}`}>
                  {STATUS_INDICATOR_CONFIG.ON_TRACK.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Linear progress vs realisasi
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Menunggu Approval AR
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Dokumen AFCE dalam proses review
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Peran Pengguna
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-mono font-bold text-primary truncate">
                {session?.user?.role || "GUEST"}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {session?.user?.email}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Constants Showcase Card */}
        <Card className="border-border shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Kamus Status Proyek & Indikator Semantik
            </CardTitle>
            <CardDescription>
              Warna dan label status baku sesuai spesifikasi docs/design.md §2 (src/lib/constants/status.ts).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROJECT_STATUS_CONFIG).map(([key, config]) => (
                <span
                  key={key}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${config.badgeClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
                  <span>{config.label}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
