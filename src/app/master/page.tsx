import { AppShell } from "@/components/layout/app-shell";
import { MasterClient } from "@/components/master/master-client";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

export const metadata = {
  title: "Master Data | WM PRJCT MNGMNT",
};

export default async function MasterDataPage() {
  const session = await getServerSession(authOptions);

  return (
    <AppShell user={session?.user}>
      <Suspense
        fallback={
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Memuat modul Master Data...</span>
          </div>
        }
      >
        <MasterClient userRole={session?.user?.role} />
      </Suspense>
    </AppShell>
  );
}
