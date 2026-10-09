"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PACKAGE_CATEGORY_CONFIG } from "@/lib/constants/status";
import { cn } from "@/lib/utils";
import { PackageCategory } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Edit,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import * as React from "react";
import { ItemRow } from "./master-client";

interface MasterItemTabProps {
  canModify: boolean;
  onEditItem: (item: ItemRow) => void;
  onDeleteItem: (target: { type: string; id: string; name: string }) => void;
}

const CATEGORY_TABS: Array<{ value: "ALL" | PackageCategory; label: string }> = [
  { value: "ALL", label: "Semua Kategori" },
  { value: "MATERIAL", label: PACKAGE_CATEGORY_CONFIG.MATERIAL.label },
  { value: "FABRICATION", label: PACKAGE_CATEGORY_CONFIG.FABRICATION.label },
  { value: "HEAVY_EQUIPMENT", label: PACKAGE_CATEGORY_CONFIG.HEAVY_EQUIPMENT.label },
  { value: "CONTRACTOR", label: PACKAGE_CATEGORY_CONFIG.CONTRACTOR.label },
  { value: "SWAKELOLA", label: PACKAGE_CATEGORY_CONFIG.SWAKELOLA.label },
];

export function MasterItemTab({ canModify, onEditItem, onDeleteItem }: MasterItemTabProps) {
  // Query parameters via nuqs
  const [selectedCategory, setSelectedCategory] = useQueryState(
    "itemCat",
    parseAsString.withDefault("ALL")
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "itemStatus",
    parseAsString.withDefault("ALL")
  );
  const [searchQuery, setSearchQuery] = useQueryState(
    "itemSearch",
    parseAsString.withDefault("")
  );

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "itemCode", desc: false },
  ]);
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  // Fetch all items with TanStack Query (cached, high performance)
  const { data: rawItems = [], isLoading } = useQuery<ItemRow[]>({
    queryKey: ["master", "item"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=item");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat data material");
      return json.data;
    },
  });

  // Calculate category counts for quick pills
  const counts = React.useMemo(() => {
    const map: Record<string, number> = {
      ALL: rawItems.length,
      MATERIAL: 0,
      FABRICATION: 0,
      HEAVY_EQUIPMENT: 0,
      CONTRACTOR: 0,
      SWAKELOLA: 0,
    };
    rawItems.forEach((it) => {
      if (map[it.category] !== undefined) {
        map[it.category] += 1;
      }
    });
    return map;
  }, [rawItems]);

  // Client-side filtering for zero-latency instant search & category switching
  const filteredData = React.useMemo(() => {
    return rawItems.filter((item) => {
      // Category filter
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;

      // Text search: matches itemCode, name, or specification
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const codeMatch = item.itemCode.toLowerCase().includes(query);
        const nameMatch = item.name.toLowerCase().includes(query);
        const specMatch = item.specification ? item.specification.toLowerCase().includes(query) : false;
        if (!codeMatch && !nameMatch && !specMatch) {
          return false;
        }
      }

      return true;
    });
  }, [rawItems, selectedCategory, statusFilter, searchQuery]);

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatUom = (item: ItemRow) => {
    if (!item.uom) return "-";
    const name = item.uom.name.trim();
    const code = item.uom.code.trim();
    // Hindari duplikasi teks seperti "Zak (sak) (zak)"
    if (name.toLowerCase().includes(`(${code.toLowerCase()})`)) {
      return name;
    }
    if (name.toLowerCase() === code.toLowerCase()) {
      return name;
    }
    return `${name} (${code})`;
  };

  // Table Columns
  const columns = React.useMemo<ColumnDef<ItemRow>[]>(() => [
    {
      accessorKey: "itemCode",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold hover:text-foreground text-xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            KODE ITEM
            {isSorted === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            ) : isSorted === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        const code = row.original.itemCode;
        const isCopied = copiedCode === code;
        return (
          <div className="flex items-center gap-1.5 group">
            <span className="font-mono font-medium text-xs text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20">
              {code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              onClick={() => handleCopyCode(code)}
              title="Salin Kode Item"
              aria-label={`Salin kode ${code}`}
            >
              {isCopied ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold hover:text-foreground text-xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            NAMA MATERIAL & SPESIFIKASI
            {isSorted === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            ) : isSorted === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        );
      },
      cell: ({ row }) => (
        <div className="flex flex-col py-0.5 max-w-md">
          <span className="font-semibold text-foreground text-sm leading-tight">
            {row.original.name}
          </span>
          {row.original.specification ? (
            <span className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
              {row.original.specification}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/60 italic mt-0.5">
              Tanpa rincian spesifikasi
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold hover:text-foreground text-xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            KATEGORI
            {isSorted === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            ) : isSorted === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        const cat = row.original.category;
        const conf = PACKAGE_CATEGORY_CONFIG[cat] || {
          label: cat,
          badgeClass: "bg-muted text-muted-foreground border-border",
        };
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border shadow-2xs",
              conf.badgeClass
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", conf.dotClass)} />
            {conf.label}
          </span>
        );
      },
    },
    {
      accessorKey: "uom",
      header: "SATUAN",
      cell: ({ row }) => (
        <span className="text-xs text-foreground font-medium">
          {formatUom(row.original)}
        </span>
      ),
    },
    {
      accessorKey: "standardPrice",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <div className="flex justify-end">
            <button
              type="button"
              className="flex items-center gap-1 font-semibold hover:text-foreground text-xs"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              HARGA STANDAR
              {isSorted === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5 text-primary" />
              ) : isSorted === "desc" ? (
                <ArrowDown className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ArrowUpDown className="h-3 w-3 opacity-40" />
              )}
            </button>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="text-right">
          <span className="font-mono tabular-nums font-semibold text-xs text-foreground">
            {formatCurrency(row.original.standardPrice)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "STATUS",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "text-[11px] font-medium font-sans border",
            row.original.isActive
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900"
              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          )}
        >
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    ...(canModify
      ? [
          {
            id: "actions",
            header: () => <div className="text-right">AKSI</div>,
            cell: ({ row }: { row: { original: ItemRow } }) => (
              <div className="flex items-center justify-end space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Ubah item ${row.original.name}`}
                  onClick={() => onEditItem(row.original)}
                  title="Ubah Item"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  aria-label={`Hapus item ${row.original.name}`}
                  onClick={() =>
                    onDeleteItem({
                      type: "item",
                      id: row.original.id,
                      name: row.original.name,
                    })
                  }
                  title="Hapus Item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ], [canModify, copiedCode, onEditItem, onDeleteItem]);

  // TanStack React Table instance with in-memory sorting & pagination
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Reset pagination index when filters change
  React.useEffect(() => {
    table.setPageIndex(0);
  }, [selectedCategory, statusFilter, searchQuery, pageSize, table]);

  const hasActiveFilters =
    Boolean(searchQuery) || selectedCategory !== "ALL" || statusFilter !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("ALL");
    setStatusFilter("ALL");
  };

  return (
    <div className="space-y-4">
      {/* 1. Quick Tabs / Pills Kategori */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab.value;
          const count = counts[tab.value] ?? 0;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedCategory(tab.value)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border cursor-pointer select-none",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-semibold",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Main Card with Search, Filter & Table */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" />
                Katalog Master Material & Harga
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Daftar barang material yang dipakai dalam penyusunan RAB, WorkPackage, dan template BOQ.
              </CardDescription>
            </div>

            {/* Quick Status Count */}
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>
                Total: <strong className="text-foreground">{rawItems.length}</strong> item
              </span>
              <span>•</span>
              <span>
                Hasil filter: <strong className="text-primary">{filteredData.length}</strong> item
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Toolbar: Search input + Status dropdown + Reset button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Box with Clear Icon */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari kode item (MAT-...), nama material, atau spesifikasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Hapus pencarian"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Status */}
            <div className="w-full sm:w-44">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Status: Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="ACTIVE">Hanya Aktif</SelectItem>
                  <SelectItem value="INACTIVE">Hanya Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>

          {/* Table Container */}
          <div className="rounded-md border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-xs font-semibold text-muted-foreground uppercase py-3"
                      >
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
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-xs">Memuat katalog material...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-36 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
                        <Boxes className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm font-semibold text-foreground">
                          {hasActiveFilters
                            ? "Tidak ada item yang cocok dengan filter"
                            : "Belum ada item material"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {hasActiveFilters
                            ? "Coba sesuaikan kata kunci pencarian atau ubah filter kategori/status."
                            : "Tambahkan item material baru atau lakukan import file Excel."}
                        </p>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="text-xs mt-1"
                          >
                            Reset Semua Filter
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filteredData.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
              {/* Rows per page selector */}
              <div className="flex items-center gap-2">
                <span>Baris per halaman:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    const newSize = Number(val);
                    setPageSize(newSize);
                    table.setPageSize(newSize);
                  }}
                >
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page Navigator */}
              <div className="flex items-center gap-3">
                <span>
                  Halaman{" "}
                  <strong className="text-foreground">
                    {table.getState().pagination.pageIndex + 1}
                  </strong>{" "}
                  dari{" "}
                  <strong className="text-foreground">
                    {Math.max(1, table.getPageCount())}
                  </strong>{" "}
                  ({filteredData.length} item)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    title="Halaman Pertama"
                    aria-label="Halaman Pertama"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    title="Halaman Sebelumnya"
                    aria-label="Halaman Sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    title="Halaman Berikutnya"
                    aria-label="Halaman Berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                    title="Halaman Terakhir"
                    aria-label="Halaman Terakhir"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
