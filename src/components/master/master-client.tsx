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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackageCategory } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Edit, Plus, Search, Trash2 } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import * as React from "react";

// Dialogs
import { CategoryDialog } from "./forms/category-dialog";
import { HolidayCsvDialog } from "./forms/holiday-csv-dialog";
import { HolidayDialog } from "./forms/holiday-dialog";
import { ItemDialog } from "./forms/item-dialog";
import { ItemExcelImportDialog } from "./forms/item-excel-import-dialog";
import { StructureTypeDialog, StructureVariantDialog } from "./forms/structure-dialog";
import { UomDialog } from "./forms/uom-dialog";
import { VendorDialog } from "./forms/vendor-dialog";
import { MasterItemTab } from "./master-item-tab";
import { MasterLocationTab } from "./master-location-tab";
import { FileSpreadsheet, FileUp, MapPin } from "lucide-react";

export interface ItemRow {
  id: string;
  itemCode: string;
  name: string;
  category: PackageCategory;
  uomId: string;
  uom?: { id: string; code: string; name: string };
  specification?: string | null;
  standardPrice: number | string;
  isActive: boolean;
}

export interface UomRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface VendorRow {
  id: string;
  name: string;
  category: PackageCategory;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
}

export interface CategoryRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
}

export interface StructureVariantRow {
  id: string;
  structureTypeId: string;
  code: string;
  name: string;
  description?: string | null;
  defaultBoqItems?: Array<{ itemCode: string; name: string; uom: string; qty: number }> | null;
  isActive: boolean;
}

export interface StructureTypeRow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  variants?: StructureVariantRow[];
}

export interface HolidayRow {
  id: string;
  holidayDate: string;
  name: string;
  year: number;
  description?: string | null;
}

interface MasterClientProps {
  userRole?: string;
}

export function MasterClient({ userRole }: MasterClientProps) {
  const queryClient = useQueryClient();
  const canModify = userRole === "SUPER_ADMIN" || userRole === "WM_HO_SPECIALIST";

  // URL state persistence via nuqs
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("item"));
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));

  // Debounced search for API query
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Dialog & Action States
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isAddVariantOpen, setIsAddVariantOpen] = React.useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = React.useState(false);
  const [isHolidayCsvOpen, setIsHolidayCsvOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ type: string; id: string; name: string } | null>(null);

  // TanStack Query Fetcher (for tabs other than location and item)
  const { data: responseData, isLoading } = useQuery<unknown[]>({
    queryKey: ["master", tab, debouncedSearch],
    enabled: tab !== "location" && tab !== "item",
    queryFn: async () => {
      const res = await fetch(`/api/master?type=${tab}&search=${encodeURIComponent(debouncedSearch)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat data");
      return json.data;
    },
  });

  // Supporting Query for UoM dropdown (needed when on Item tab)
  const { data: uomList = [] } = useQuery<Array<{ id: string; code: string; name: string }>>({
    queryKey: ["master", "uom", ""],
    queryFn: async () => {
      const res = await fetch("/api/master?type=uom");
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: tab === "item",
  });

  // Supporting Query for Structure Types (needed when on Structure tab)
  const { data: structureTypeList = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["master", "structure", ""],
    queryFn: async () => {
      const res = await fetch("/api/master?type=structure");
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: tab === "structure",
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/master?type=${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal membuat data");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master", tab] });
      queryClient.invalidateQueries({ queryKey: ["master", "variant"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/master?type=${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memperbarui data");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master", tab] });
      queryClient.invalidateQueries({ queryKey: ["master", "variant"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const res = await fetch(`/api/master?type=${type}&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus data");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master", tab] });
      queryClient.invalidateQueries({ queryKey: ["master", "variant"] });
      setDeleteTarget(null);
    },
  });

  const handleSave = async (data: Record<string, unknown>, customType?: string) => {
    const targetType = customType || tab;
    if (data.id) {
      await updateMutation.mutateAsync({ type: targetType, data });
    } else {
      await createMutation.mutateAsync({ type: targetType, data });
    }
  };

  // --- Column Definitions ---
  const uomColumns: ColumnDef<UomRow>[] = [
    {
      accessorKey: "code",
      header: "Kode Satuan",
      cell: ({ row }) => <span className="font-mono font-bold text-xs">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Nama Satuan",
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "description",
      header: "Deskripsi",
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.description || "-"}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"} className="text-[11px]">
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    ...(canModify
      ? [
          {
            id: "actions",
            header: "Aksi",
            cell: ({ row }: { row: { original: UomRow } }) => (
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ubah satuan ${row.original.name}`} onClick={() => { setEditItem(row.original as unknown as Record<string, unknown>); setIsAddOpen(true); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label={`Hapus satuan ${row.original.name}`} onClick={() => setDeleteTarget({ type: "uom", id: row.original.id, name: row.original.name })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const vendorColumns: ColumnDef<VendorRow>[] = [
    {
      accessorKey: "name",
      header: "Nama Rekanan",
      cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "category",
      header: "Kategori Pengadaan",
      cell: ({ row }) => <Badge variant="secondary" className="text-[11px] font-mono">{row.original.category}</Badge>,
    },
    {
      accessorKey: "contactPerson",
      header: "Kontak PIC",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.contactPerson || "-"}</span>,
    },
    {
      accessorKey: "phone",
      header: "No. Telepon",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.phone || "-"}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.email || "-"}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"} className="text-[11px]">
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    ...(canModify
      ? [
          {
            id: "actions",
            header: "Aksi",
            cell: ({ row }: { row: { original: VendorRow } }) => (
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ubah vendor ${row.original.name}`} onClick={() => { setEditItem(row.original as unknown as Record<string, unknown>); setIsAddOpen(true); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label={`Hapus vendor ${row.original.name}`} onClick={() => setDeleteTarget({ type: "vendor", id: row.original.id, name: row.original.name })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const categoryColumns: ColumnDef<CategoryRow>[] = [
    {
      accessorKey: "code",
      header: "Kode Kategori",
      cell: ({ row }) => <span className="font-mono font-bold text-xs text-primary">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Nama Kategori",
      cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "description",
      header: "Deskripsi",
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.description || "-"}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"} className="text-[11px]">
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    ...(canModify
      ? [
          {
            id: "actions",
            header: "Aksi",
            cell: ({ row }: { row: { original: CategoryRow } }) => (
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ubah kategori ${row.original.name}`} onClick={() => { setEditItem(row.original as unknown as Record<string, unknown>); setIsAddOpen(true); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label={`Hapus kategori ${row.original.name}`} onClick={() => setDeleteTarget({ type: "category", id: row.original.id, name: row.original.name })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const structureColumns: ColumnDef<StructureTypeRow>[] = [
    {
      accessorKey: "name",
      header: "Tipe Struktur",
      cell: ({ row }) => <span className="font-bold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "description",
      header: "Deskripsi",
      cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.description || "-"}</span>,
    },
    {
      accessorKey: "variants",
      header: "Daftar Varian & Template BOQ",
      cell: ({ row }) => {
        const variants = row.original.variants || [];
        return (
          <div className="space-y-1.5 py-1">
            {variants.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">Belum ada varian terdaftar</span>
            ) : (
              variants.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs bg-muted/50 px-2 py-1 rounded border border-border">
                  <div>
                    <span className="font-mono font-semibold text-primary">{v.code}</span>
                    <span className="mx-1.5 text-muted-foreground">•</span>
                    <span>{v.name}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">({(v.defaultBoqItems || []).length} item BOQ)</span>
                  </div>
                  {canModify && (
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Ubah varian ${v.name}`} onClick={() => { setEditItem(v as unknown as Record<string, unknown>); setIsAddVariantOpen(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" aria-label={`Hapus varian ${v.name}`} onClick={() => setDeleteTarget({ type: "variant", id: v.id, name: v.name })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      },
    },
    ...(canModify
      ? [
          {
            id: "actions",
            header: "Aksi Tipe",
            cell: ({ row }: { row: { original: StructureTypeRow } }) => (
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ubah struktur ${row.original.name}`} onClick={() => { setEditItem(row.original as unknown as Record<string, unknown>); setIsAddOpen(true); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label={`Hapus struktur ${row.original.name}`} onClick={() => setDeleteTarget({ type: "structure", id: row.original.id, name: row.original.name })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const holidayColumns: ColumnDef<HolidayRow>[] = [
    {
      accessorKey: "holidayDate",
      header: "Tanggal Libur",
      cell: ({ row }) => {
        const d = new Date(row.original.holidayDate);
        const formatted = d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
        return <span className="font-mono font-medium text-xs">{formatted}</span>;
      },
    },
    {
      accessorKey: "name",
      header: "Nama Hari Libur / Cuti Bersama",
      cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "year",
      header: "Tahun",
      cell: ({ row }) => <span className="font-mono tabular-nums text-xs font-bold">{row.original.year}</span>,
    },
    {
      accessorKey: "description",
      header: "Kategori",
      cell: ({ row }) => {
        const desc = row.original.description || "Libur Nasional";
        const isCuti = desc.toLowerCase().includes("cuti");
        return (
          <Badge variant={isCuti ? "secondary" : "default"} className="text-[11px]">
            {desc}
          </Badge>
        );
      },
    },
    ...(canModify
      ? [
          {
            id: "actions",
            header: "Aksi",
            cell: ({ row }: { row: { original: HolidayRow } }) => (
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ubah libur ${row.original.name}`} onClick={() => { setEditItem(row.original as unknown as Record<string, unknown>); setIsAddOpen(true); }}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label={`Hapus libur ${row.original.name}`} onClick={() => setDeleteTarget({ type: "holiday", id: row.original.id, name: row.original.name })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Master Data Sistem
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pengelolaan katalog material, hierarki lokasi kebun/PT, vendor, struktur BOQ, serta kalender hari libur nasional.
          </p>
        </div>
        {canModify && (
          <div className="flex items-center space-x-2">
            {tab === "item" && (
              <Button
                variant="outline"
                className="font-semibold shadow-xs"
                onClick={() => setIsExcelImportOpen(true)}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                Import Excel (.xlsx)
              </Button>
            )}

            {tab === "holiday" && (
              <Button
                variant="outline"
                className="font-semibold shadow-xs"
                onClick={() => setIsHolidayCsvOpen(true)}
              >
                <FileUp className="mr-2 h-4 w-4 text-primary" />
                Bulk CSV (tanggal;nama)
              </Button>
            )}

            {tab === "structure" && (
              <Button
                variant="outline"
                className="font-semibold shadow-xs"
                onClick={() => {
                  setEditItem(null);
                  setIsAddVariantOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Varian & BOQ
              </Button>
            )}

            {tab !== "location" && (
              <Button
                className="font-semibold shadow-xs"
                onClick={() => {
                  setEditItem(null);
                  setIsAddOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {tab === "item" && "Tambah Item Material"}
                {tab === "uom" && "Tambah Satuan (UoM)"}
                {tab === "vendor" && "Tambah Vendor"}
                {tab === "category" && "Tambah Kategori Proyek"}
                {tab === "structure" && "Tambah Tipe Struktur"}
                {tab === "holiday" && "Tambah Hari Libur"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(val) => {
          setTab(val);
          setSearch("");
        }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-2">
          <TabsList className="h-10 bg-muted/60 p-1 flex-wrap">
            <TabsTrigger value="item">Material & Item</TabsTrigger>
            <TabsTrigger value="location">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Lokasi (PT/Kebun/Blok)
            </TabsTrigger>
            <TabsTrigger value="uom">Satuan (UoM)</TabsTrigger>
            <TabsTrigger value="vendor">Vendor</TabsTrigger>
            <TabsTrigger value="category">Kategori Proyek</TabsTrigger>
            <TabsTrigger value="structure">Struktur & Varian</TabsTrigger>
            <TabsTrigger value="holiday">Hari Libur</TabsTrigger>
          </TabsList>

          {/* Search bar (sembunyikan di tab location dan item karena memiliki search terpadu) */}
          {tab !== "location" && tab !== "item" && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={`Cari di ${tab}...`}
                className="pl-8 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Tab 1: Item */}
        <TabsContent value="item" className="space-y-4 m-0">
          <MasterItemTab
            canModify={canModify}
            onEditItem={(item) => {
              setEditItem(item as unknown as Record<string, unknown>);
              setIsAddOpen(true);
            }}
            onDeleteItem={setDeleteTarget}
          />
        </TabsContent>

        {/* Tab 2: UoM */}
        <TabsContent value="uom" className="space-y-4 m-0">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Unit of Measurement (Satuan Ukuran)</CardTitle>
              <CardDescription className="text-xs">
                Satuan metrik baku untuk pengukuran volume, barang, dan progres pekerjaan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={uomColumns} data={(responseData as UomRow[]) || []} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Vendor */}
        <TabsContent value="vendor" className="space-y-4 m-0">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Daftar Vendor & Rekanan</CardTitle>
              <CardDescription className="text-xs">
                Mitra penyedia material, fabrikasi, alat berat, dan jasa konstruksi perkebunan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={vendorColumns} data={(responseData as VendorRow[]) || []} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Category */}
        <TabsContent value="category" className="space-y-4 m-0">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Kategori Proyek (Folder Category)</CardTitle>
              <CardDescription className="text-xs">
                Pengelompokan folder struktur air (Water Control Structure, dll).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={categoryColumns} data={(responseData as CategoryRow[]) || []} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Structure & Variant */}
        <TabsContent value="structure" className="space-y-4 m-0">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Tipe Bangunan, Varian & Template BOQ</CardTitle>
              <CardDescription className="text-xs">
                Struktur air standar dengan varian dimensi teknis dan daftar kebutuhan material (Bill of Quantities) bawaan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={structureColumns} data={(responseData as StructureTypeRow[]) || []} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Lokasi: Region / Company / Estate / Block */}
        <TabsContent value="location" className="space-y-4 m-0">
          <MasterLocationTab canModify={canModify} />
        </TabsContent>

        {/* Tab 6: Holiday */}
        <TabsContent value="holiday" className="space-y-4 m-0">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Kalender Hari Libur Nasional & Cuti Bersama</CardTitle>
              <CardDescription className="text-xs">
                Digunakan oleh lib/sla.ts untuk menghitung durasi hari kerja murni pada SLA dan Early Warning System (EWS).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={holidayColumns} data={(responseData as HolidayRow[]) || []} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Forms & Dialogs */}
      {tab === "item" && (
        <>
          <ItemDialog
            open={isAddOpen}
            onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditItem(null); }}
            onSubmit={(data) => handleSave(data, "item")}
            uomList={uomList}
            initialData={editItem as unknown as ItemRow}
          />
          <ItemExcelImportDialog
            open={isExcelImportOpen}
            onOpenChange={setIsExcelImportOpen}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["master", "item"] });
            }}
            uomList={uomList}
          />
        </>
      )}

      {tab === "uom" && (
        <UomDialog
          open={isAddOpen}
          onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditItem(null); }}
          onSubmit={(data) => handleSave(data, "uom")}
          initialData={editItem as unknown as UomRow}
        />
      )}

      {tab === "vendor" && (
        <VendorDialog
          open={isAddOpen}
          onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditItem(null); }}
          onSubmit={(data) => handleSave(data, "vendor")}
          initialData={editItem as unknown as VendorRow}
        />
      )}

      {tab === "category" && (
        <CategoryDialog
          open={isAddOpen}
          onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditItem(null); }}
          onSubmit={(data) => handleSave(data, "category")}
          initialData={editItem as unknown as CategoryRow}
        />
      )}

      {tab === "structure" && (
        <>
          <StructureTypeDialog
            open={isAddOpen}
            onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditItem(null); }}
            onSubmit={(data) => handleSave(data, "structure")}
            initialData={editItem as unknown as StructureTypeRow}
          />
          <StructureVariantDialog
            open={isAddVariantOpen}
            onOpenChange={(open) => { setIsAddVariantOpen(open); if (!open) setEditItem(null); }}
            onSubmit={(data) => handleSave(data, "variant")}
            structureTypes={structureTypeList}
            initialData={editItem as unknown as StructureVariantRow}
          />
        </>
      )}

      {tab === "holiday" && (
        <>
          <HolidayDialog
            open={isAddOpen}
            onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditItem(null); }}
            onSubmit={(data) => handleSave(data, "holiday")}
            initialData={editItem as unknown as HolidayRow}
          />
          <HolidayCsvDialog
            open={isHolidayCsvOpen}
            onOpenChange={setIsHolidayCsvOpen}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["master", "holiday"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            }}
          />
        </>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Master?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <span className="font-semibold text-foreground">&quot;{deleteTarget?.name}&quot;</span>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id });
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
