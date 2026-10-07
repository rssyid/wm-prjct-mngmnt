import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { ShieldAlert, UserPlus, Users } from "lucide-react";
import { getServerSession } from "next-auth";

export const metadata = {
  title: "Manajemen Pengguna | WM PRJCT MNGMNT",
};

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  return (
    <AppShell user={session?.user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Manajemen Pengguna
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola akun staf, hak akses peranan (Role), dan status keaktifan user.
            </p>
          </div>
          {isSuperAdmin && (
            <div>
              <Button className="font-semibold shadow-xs">
                <UserPlus className="mr-2 h-4 w-4" />
                Tambah Pengguna
              </Button>
            </div>
          )}
        </div>

        {!isSuperAdmin && (
          <div className="flex items-center space-x-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-sm">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              Halaman ini memiliki proteksi ketat. Hanya pengguna dengan peran{" "}
              <span className="font-mono font-bold">SUPER_ADMIN</span> yang memiliki hak mutasi data pengguna.
            </div>
          </div>
        )}

        <Card className="border-border shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Daftar Pengguna Aktif
            </CardTitle>
            <CardDescription>
              Tabel manajemen pengguna akan diimplementasikan pada tahap berikutnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Pengelolaan Akses Terpusat
              </h3>
              <p className="text-sm text-muted-foreground">
                Tersedia 3 tingkat hak akses sesuai standar: <span className="font-medium text-foreground">SUPER_ADMIN</span>, <span className="font-medium text-foreground">WM_HO_SPECIALIST</span>, dan <span className="font-medium text-foreground">MANAGEMENT_VIEWER</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
