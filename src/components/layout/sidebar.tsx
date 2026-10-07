"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Droplets,
  FolderKanban,
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  onNavigate?: () => void;
}

const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Proyek",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Master Data",
    href: "/master",
    icon: Database,
  },
  {
    title: "Pengguna",
    href: "/users",
    icon: Users,
  },
];

export function Sidebar({ collapsed, onToggle, className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  const isRouteActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex flex-col h-full bg-card border-r border-border transition-all duration-200 ease-in-out select-none",
          collapsed ? "w-16" : "w-64",
          className
        )}
      >
        {/* Header / Brand */}
        <div className="h-16 flex items-center px-4 border-b border-border justify-between">
          <Link
            href="/"
            onClick={onNavigate}
            className={cn(
              "flex items-center space-x-3 overflow-hidden transition-all",
              collapsed ? "justify-center w-full" : ""
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
              <Droplets className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm tracking-tight text-foreground">
                  WM PRJCT
                </span>
                <span className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
                  MNGMNT
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.href);

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "space-x-3",
                  active
                    ? "bg-primary/10 text-primary font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Footer / Toggle Button */}
        <div className="p-2 border-t border-border hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn(
              "w-full flex items-center text-muted-foreground hover:text-foreground hover:bg-muted",
              collapsed ? "justify-center px-0" : "justify-between px-3"
            )}
            aria-label={collapsed ? "Perluas menu sidebar" : "Ciutkan menu sidebar"}
          >
            {!collapsed && <span className="text-xs font-medium">Sembunyikan Menu</span>}
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
