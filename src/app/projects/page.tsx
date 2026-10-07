import { AppShell } from "@/components/layout/app-shell";
import { ProjectsClient } from "@/components/projects/projects-client";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

export const metadata = {
  title: "Daftar Proyek | WM PRJCT MNGMNT",
};

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);

  return (
    <AppShell user={session?.user}>
      <Suspense
        fallback={
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Memuat modul Daftar Proyek...</span>
          </div>
        }
      >
        <ProjectsClient userRole={session?.user?.role} />
      </Suspense>
    </AppShell>
  );
}
