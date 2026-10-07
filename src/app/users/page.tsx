import { AppShell } from "@/components/layout/app-shell";
import { UserManagementClient } from "@/components/users/user-management-client";
import { authOptions } from "@/lib/auth";
import { ShieldAlert } from "lucide-react";
import { getServerSession } from "next-auth";

export const metadata = {
  title: "Manajemen Pengguna | WM PRJCT MNGMNT",
};

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  return (
    <AppShell user={session?.user}>
      {!isSuperAdmin ? (
        <div className="space-y-4 max-w-xl mx-auto py-12 text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Akses Dibatasi (SUPER_ADMIN Saja)
          </h2>
          <p className="text-sm text-muted-foreground">
            Halaman manajemen pengguna dan hak akses akun staf hanya dapat dibuka dan dimodifikasi oleh pengguna dengan peran <span className="font-mono font-bold text-foreground">SUPER_ADMIN</span>.
          </p>
        </div>
      ) : (
        <UserManagementClient currentUserId={session?.user?.id} />
      )}
    </AppShell>
  );
}
