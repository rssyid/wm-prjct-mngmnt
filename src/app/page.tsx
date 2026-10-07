import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { AppShell } from "@/components/layout/app-shell";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

export const metadata = {
  title: "Dashboard & EWS | WM PRJCT MNGMNT",
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <AppShell user={session?.user}>
      <DashboardClient user={session?.user} />
    </AppShell>
  );
}
