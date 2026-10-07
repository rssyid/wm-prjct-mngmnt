"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, Clock, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserNav } from "./user-nav";

interface NavbarProps {
  onMobileMenuToggle: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard Utama",
  "/projects": "Manajemen Proyek",
  "/master": "Master Data",
  "/users": "Manajemen Pengguna",
};

export function Navbar({ onMobileMenuToggle, user }: NavbarProps) {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (ROUTE_TITLES[pathname]) {
      return ROUTE_TITLES[pathname];
    }
    for (const [route, title] of Object.entries(ROUTE_TITLES)) {
      if (route !== "/" && pathname.startsWith(route)) {
        return title;
      }
    }
    return "WM PRJCT MNGMNT";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-card/80 px-4 sm:px-6 backdrop-blur-md transition-colors">
      <div className="flex items-center space-x-3">
        {/* Mobile menu trigger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuToggle}
          className="md:hidden text-muted-foreground hover:text-foreground"
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Dynamic page title */}
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <NotificationBadge />
        <ThemeToggle />
        <div className="h-4 w-px bg-border mx-1" />
        <UserNav user={user} />
      </div>
    </header>
  );
}

function NotificationBadge() {
  const { data } = useQuery<{
    success: boolean;
    data: {
      rejectedArCount: number;
      waitingApprovalCount: number;
      delayedProjectsCount: number;
      atRiskProjectsCount: number;
      totalPendingNotifications: number;
    };
  }>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) {
        return {
          success: false,
          data: {
            rejectedArCount: 0,
            waitingApprovalCount: 0,
            delayedProjectsCount: 0,
            atRiskProjectsCount: 0,
            totalPendingNotifications: 0,
          },
        };
      }
      return res.json();
    },
    refetchInterval: 60000,
  });

  const stats = data?.data;
  const count = stats?.totalPendingNotifications || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground h-9 w-9"
          aria-label="Notifikasi Persetujuan dan EWS"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-semibold text-xs flex items-center justify-between">
          <span>Notifikasi & Early Warning</span>
          {count > 0 && (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] py-0 px-1.5 dark:bg-rose-950/60 dark:text-rose-400">
              {count} Perlu Tindakan
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Tidak ada notifikasi atau proyek terlambat saat ini.
          </div>
        ) : (
          <div className="space-y-1 py-1">
            {stats && stats.delayedProjectsCount > 0 && (
              <DropdownMenuItem asChild>
                <Link
                  href="/projects?statusIndicator=DELAYED"
                  className="flex items-start gap-2.5 p-2 text-xs cursor-pointer hover:bg-muted"
                >
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">
                      {stats.delayedProjectsCount} Proyek Terlambat (DELAYED)
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      EWS: Proyek melewati jadwal atau deviasi &gt; 25 poin
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            )}
            {stats && stats.rejectedArCount > 0 && (
              <DropdownMenuItem asChild>
                <Link
                  href="/projects"
                  className="flex items-start gap-2.5 p-2 text-xs cursor-pointer hover:bg-muted"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">
                      {stats.rejectedArCount} AR Ditolak
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Perlu revisi atau pengajuan ulang attempt
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            )}
            {stats && stats.waitingApprovalCount > 0 && (
              <DropdownMenuItem asChild>
                <Link
                  href="/projects"
                  className="flex items-start gap-2.5 p-2 text-xs cursor-pointer hover:bg-muted"
                >
                  <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">
                      {stats.waitingApprovalCount} Menunggu Persetujuan
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Proyek menanti paraf berjenjang
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

