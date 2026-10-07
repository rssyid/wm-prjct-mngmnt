"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_CONFIG } from "@/lib/constants/status";
import { ProjectStatus } from "@prisma/client";
import {
  Database,
  FileBarChart,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Users,
} from "lucide-react";

interface ProjectSearchResult {
  id: string;
  projectCode: string;
  projectName: string;
  displayName?: string | null;
  status: ProjectStatus;
  company?: { name: string } | null;
}

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [projects, setProjects] = React.useState<ProjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (isControlled && externalOnOpenChange) {
        externalOnOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [isControlled, externalOnOpenChange]
  );

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Debounced fetch untuk pencarian proyek
  React.useEffect(() => {
    const query = search.trim();
    if (!query) {
      setProjects([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/projects?search=${encodeURIComponent(query)}&limit=8`
        );
        if (res.ok) {
          const json = await res.json();
          // API projects mengembalikan { success: true, data: { items: [...] } }
          const items = json?.data?.items || json?.data || [];
          setProjects(items);
        }
      } catch (err) {
        console.error("Gagal mencari proyek di Command Palette:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = React.useCallback(
    (callback: () => void) => {
      setOpen(false);
      setSearch("");
      callback();
    },
    [setOpen]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Ketik nama/kode proyek atau cari aksi..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? "Mencari proyek..." : "Tidak ada hasil yang ditemukan."}
        </CommandEmpty>

        {/* Hasil Pencarian Proyek */}
        {projects.length > 0 && (
          <CommandGroup heading="Proyek Ditemukan">
            {projects.map((proj) => {
              const statusCfg = PROJECT_STATUS_CONFIG[proj.status];
              return (
                <CommandItem
                  key={proj.id}
                  value={`${proj.projectCode} ${proj.projectName} ${proj.displayName || ""}`}
                  onSelect={() =>
                    handleSelect(() => router.push(`/projects/${proj.id}`))
                  }
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs font-semibold text-primary">
                      {proj.projectCode}
                    </span>
                    <span className="truncate text-xs text-foreground">
                      {proj.displayName || proj.projectName}
                    </span>
                  </div>
                  {statusCfg && (
                    <Badge
                      variant="outline"
                      className={`ml-2 text-[10px] px-1.5 py-0 shrink-0 font-medium ${statusCfg.badgeClass}`}
                    >
                      {statusCfg.label}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {projects.length > 0 && <CommandSeparator />}

        {/* Aksi Cepat */}
        <CommandGroup heading="Aksi Cepat">
          <CommandItem
            onSelect={() =>
              handleSelect(() => router.push("/projects/new"))
            }
          >
            <Plus className="mr-2 h-4 w-4 text-emerald-600" />
            <span>Buat Proyek Baru</span>
            <CommandShortcut>Proyek Baru</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigasi Menu */}
        <CommandGroup heading="Navigasi Halaman">
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/"))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Dashboard Utama</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/projects"))}
          >
            <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Manajemen Proyek</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/reports"))}
          >
            <FileBarChart className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Laporan & Rekap</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/master"))}
          >
            <Database className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Master Data</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/users"))}
          >
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Manajemen Pengguna</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
