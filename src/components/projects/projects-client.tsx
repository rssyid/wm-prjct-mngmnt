"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PROJECT_STATUS_CONFIG,
  STATUS_INDICATOR_CONFIG,
} from "@/lib/constants/status";
import { cn } from "@/lib/utils";
import { ProjectStatus, Role, StatusIndicator } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import React, { useEffect, useMemo, useState } from "react";

interface ProjectItem {
  id: string;
  projectCode: string;
  projectName: string;
  displayName: string;
  status: ProjectStatus;
  statusIndicator: StatusIndicator;
  progressPct: number;
  totalBudgetAmount: string | number;
  budgetType: string;
  targetStartDate: string | null;
  targetEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; code: string; name: string };
  estate: { id: string; code: string; name: string };
  folderCategory: { id: string; code: string; name: string };
  structureType: { id: string; name: string };
}

interface ProjectsResponse {
  success: boolean;
  data: ProjectItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface ProjectsClientProps {
  userRole?: Role;
}

export function ProjectsClient({ userRole }: ProjectsClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State filter via nuqs URL query string
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsString.withDefault("ALL"));
  const [statusIndicator, setStatusIndicator] = useQueryState(
    "indicator",
    parseAsString.withDefault("ALL")
  );
  const [companyId, setCompanyId] = useQueryState(
    "companyId",
    parseAsString.withDefault("ALL")
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState("pageSize", parseAsInteger.withDefault(10));

  // Local state untuk search debounce 300 ms
  const [searchInput, setSearchInput] = useState(search);

  // Sync legacy query param ?statusIndicator jika ada
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const legacyIndicator = urlParams.get("statusIndicator");
      if (legacyIndicator && (!statusIndicator || statusIndicator === "ALL")) {
        setStatusIndicator(legacyIndicator);
      }
    }
  }, [setStatusIndicator, statusIndicator]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput ? searchInput : null);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, search, setSearch, setPage]);

  // Modal dialog hapus
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);

  // Fetch data perusahaan untuk filter dropdown
  const { data: companiesData } = useQuery<{
    success: boolean;
    data: { id: string; code: string; name: string }[];
  }>({
    queryKey: ["filter-companies"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=company");
      if (!res.ok) throw new Error("Gagal mengambil data perusahaan");
      return res.json();
    },
  });
  const companies = companiesData?.data || [];

  // Query parameter untuk fetch
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search) params.set("search", search);
    if (status && status !== "ALL") params.set("status", status);
    if (statusIndicator && statusIndicator !== "ALL")
      params.set("statusIndicator", statusIndicator);
    if (companyId && companyId !== "ALL") params.set("companyId", companyId);
    return params.toString();
  }, [page, pageSize, search, status, statusIndicator, companyId]);

  // Fetch daftar proyek via TanStack Query
  const { data, isLoading, isFetching, refetch } = useQuery<ProjectsResponse>({
    queryKey: ["projects", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/projects?${queryParams}`);
      if (!res.ok) throw new Error("Gagal mengambil data proyek");
      return res.json();
    },
  });

  // Mutasi Hapus Proyek (Soft Delete Berantai B11)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Gagal menghapus proyek");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTarget(null);
    },
  });

  const projects = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, pageSize: 10, totalPages: 1 };

  const canManage = userRole === Role.SUPER_ADMIN || userRole === Role.WM_HO_SPECIALIST;

  // Definisi kolom TanStack Table
  const columns = useMemo<ColumnDef<ProjectItem>[]>(
    () => [
      {
        accessorKey: "projectCode",
        header: "Kode Proyek",
        cell: ({ row }) => (
          <Link
            href={`/projects/${row.original.id}`}
            className="font-mono text-xs font-semibold text-primary hover:underline tabular-nums"
          >
            {row.original.projectCode}
          </Link>
        ),
      },
      {
        accessorKey: "projectName",
        header: "Nama Proyek",
        cell: ({ row }) => (
          <div className="max-w-[280px]">
            <Link
              href={`/projects/${row.original.id}`}
              className="text-xs font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
            >
              {row.original.projectName}
            </Link>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>{row.original.structureType?.name || "-"}</span>
              <span>•</span>
              <span className="truncate">{row.original.displayName}</span>
            </div>
          </div>
        ),
      },
      {
        id: "location",
        header: "Lokasi & Unit",
        cell: ({ row }) => (
          <div className="text-xs">
            <div className="font-medium text-foreground">
              {row.original.company?.code || "-"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Estate: {row.original.estate?.code || "-"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "progressPct",
        header: "Progres Fisik",
        cell: ({ row }) => {
          const pct = Math.round(row.original.progressPct * 10) / 10;
          return (
            <div className="w-[110px] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status Proyek",
        cell: ({ row }) => {
          const cfg = PROJECT_STATUS_CONFIG[row.original.status];
          return (
            <Badge
              variant="outline"
              className={cn("text-[11px] px-2 py-0.5 font-medium border", cfg?.badgeClass)}
            >
              {cfg?.label || row.original.status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "statusIndicator",
        header: "EWS",
        cell: ({ row }) => {
          const ind = STATUS_INDICATOR_CONFIG[row.original.statusIndicator];
          return (
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full shrink-0", ind?.dotClass)} />
              <span className="text-[11px] font-medium text-muted-foreground">
                {ind?.label || row.original.statusIndicator}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "totalBudgetAmount",
        header: "Nilai Anggaran",
        cell: ({ row }) => {
          const val = Number(row.original.totalBudgetAmount) || 0;
          return (
            <div className="text-right text-xs font-mono tabular-nums font-medium">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(val)}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const project = row.original;
          const isLocked =
            project.status === ProjectStatus.COMPLETED ||
            project.status === ProjectStatus.CANCELLED;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Menu aksi proyek ${project.projectCode}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                  Lihat Detail Proyek
                </DropdownMenuItem>
                {canManage && !isLocked && (
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                    onClick={() => setDeleteTarget(project)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Hapus ke Recycle Bin
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [router, canManage]
  );

  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: meta.totalPages,
  });

  const resetFilters = () => {
    setSearchInput("");
    setSearch(null);
    setStatus("ALL");
    setStatusIndicator("ALL");
    setCompanyId("ALL");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search) || status !== "ALL" || statusIndicator !== "ALL" || companyId !== "ALL";

  return (
    <div className="space-y-6">
      {/* Header Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Daftar Proyek
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola dan pantau seluruh proyek Water Management di seluruh unit operasional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs"
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
            Segarkan
          </Button>
          {canManage && (
            <Button size="sm" asChild className="font-semibold shadow-xs text-xs">
              <Link href="/projects/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Proyek Baru
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Debounced */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari kode proyek, nama proyek, atau display name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Filter Status Proyek */}
        <div className="w-full sm:w-[170px]">
          <Select
            value={status}
            onValueChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status Proyek" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="ACTIVE">Proyek Aktif (Berjalan)</SelectItem>
              {Object.keys(PROJECT_STATUS_CONFIG).map((st) => (
                <SelectItem key={st} value={st}>
                  {PROJECT_STATUS_CONFIG[st as ProjectStatus].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter EWS */}
        <div className="w-full sm:w-[160px]">
          <Select
            value={statusIndicator}
            onValueChange={(val) => {
              setStatusIndicator(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Indikator EWS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua EWS</SelectItem>
              {Object.keys(STATUS_INDICATOR_CONFIG).map((ind) => (
                <SelectItem key={ind} value={ind}>
                  {STATUS_INDICATOR_CONFIG[ind as StatusIndicator].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Perusahaan */}
        <div className="w-full sm:w-[170px]">
          <Select
            value={companyId}
            onValueChange={(val) => {
              setCompanyId(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Semua Perusahaan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Perusahaan</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-9 text-xs px-2.5 text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Tabel Data Proyek */}
      <div className="rounded-md border border-border bg-card shadow-xs overflow-hidden">
        {/* Header Hint Jumlah Total Konsisten */}
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Menampilkan <strong className="text-foreground">{projects.length}</strong> dari{" "}
            <strong className="text-foreground">{meta.total}</strong> proyek terdaftar
          </span>
          {isFetching && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Memperbarui data...
            </span>
          )}
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton Rows
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell className="p-3">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="p-3">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </TableCell>
                  <TableCell className="p-3">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-3 w-20" />
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="p-3 text-right">
                    <Skeleton className="h-4 w-24 ml-auto" />
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              // Empty State
              <TableRow>
                <TableCell colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <FolderKanban className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">
                      {hasActiveFilters
                        ? "Tidak Ada Proyek yang Sesuai Filter"
                        : "Belum Ada Proyek yang Dibuat"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {hasActiveFilters
                        ? "Coba ubah kata kunci pencarian atau sesuaikan opsi filter status/perusahaan."
                        : "Mulai inisiasi proyek Water Management baru untuk unit operasional Anda."}
                    </p>
                    <div className="pt-2">
                      {hasActiveFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="text-xs"
                        >
                          Reset Filter
                        </Button>
                      ) : canManage ? (
                        <Button size="sm" asChild className="text-xs font-semibold">
                          <Link href="/projects/new">
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Buat Proyek Pertama
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {meta.total > 0 && (
          <div className="px-4 py-3 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Baris per halaman:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <span>
                Halaman <strong className="text-foreground">{meta.page}</strong> dari{" "}
                <strong className="text-foreground">{meta.totalPages}</strong>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Halaman sebelumnya"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Halaman selanjutnya"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AlertDialog Konfirmasi Hapus Proyek */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Hapus Proyek ke Recycle Bin?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <span>
                Proyek <strong>{deleteTarget?.projectCode}</strong> (
                {deleteTarget?.projectName}) beserta seluruh data terkait (paket kerja, log
                progres, pengiriman, dan BAST) akan dipindahkan ke Recycle Bin (Soft Delete Berantai).
              </span>
              <span className="block text-amber-600 dark:text-amber-400 font-medium">
                Data dapat dipulihkan sewaktu-waktu oleh SUPER_ADMIN melalui Recycle Bin.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} className="text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Proyek"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
