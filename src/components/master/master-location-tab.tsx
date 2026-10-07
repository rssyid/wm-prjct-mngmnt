"use client";

import {
  AlertDialog,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  Edit,
  Grid,
  MapPin,
  Plus,
  Search,
  Trash2,
  Trees,
} from "lucide-react";
import * as React from "react";
import {
  BlockDialog,
  CompanyDialog,
  EstateDialog,
  RegionDialog,
} from "./forms/location-dialogs";

export interface RegionRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count?: { companies: number };
}

export interface CompanyRow {
  id: string;
  code: string;
  name: string;
  regionId?: string | null;
  region?: { id: string; code: string; name: string } | null;
  isActive: boolean;
  _count?: { estates: number; projects: number };
}

export interface EstateRow {
  id: string;
  companyId: string;
  code: string;
  name: string;
  region?: string | null;
  company?: { id: string; code: string; name: string };
  isActive: boolean;
  _count?: { blocks: number; projects: number };
}

export interface BlockRow {
  id: string;
  estateId: string;
  blockCode: string;
  name: string;
  plantingYear?: number | null;
  areaHectares?: number | null;
  isActive: boolean;
  estate?: {
    id: string;
    code: string;
    name: string;
    company?: { id: string; code: string; name: string };
  };
  _count?: { projects: number };
}

interface MasterLocationTabProps {
  canModify: boolean;
}

export function MasterLocationTab({ canModify }: MasterLocationTabProps) {
  const queryClient = useQueryClient();

  // Sub-level tab: region | company | estate | block
  const [level, setLevel] = React.useState<"region" | "company" | "estate" | "block">("company");
  const [search, setSearch] = React.useState("");

  // Cascading Filter States
  const [selectedRegionId, setSelectedRegionId] = React.useState<string>("all");
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("all");
  const [selectedEstateId, setSelectedEstateId] = React.useState<string>("all");

  // Dialog State
  const [dialogState, setDialogState] = React.useState<{
    type: "region" | "company" | "estate" | "block";
    open: boolean;
    initialData: RegionRow | CompanyRow | EstateRow | BlockRow | null;
  }>({
    type: "company",
    open: false,
    initialData: null,
  });

  // Delete Alert State
  const [deleteTarget, setDeleteTarget] = React.useState<{
    type: "region" | "company" | "estate" | "block";
    id: string;
    name: string;
    code: string;
    cascadeWarning?: string;
  } | null>(null);

  const [deleteErrorMsg, setDeleteErrorMsg] = React.useState<string | null>(null);

  // Queries for Dropdowns (Independent & Fast)
  const { data: regionList = [] } = useQuery<RegionRow[]>({
    queryKey: ["master", "region", "all"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=region");
      const json = await res.json();
      return json.success ? json.data : [];
    },
  });

  const { data: companyList = [] } = useQuery<CompanyRow[]>({
    queryKey: ["master", "company", "all", selectedRegionId],
    queryFn: async () => {
      const url = selectedRegionId !== "all"
        ? `/api/master?type=company&regionId=${selectedRegionId}`
        : "/api/master?type=company";
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    },
  });

  const { data: estateList = [] } = useQuery<EstateRow[]>({
    queryKey: ["master", "estate", "all", selectedCompanyId],
    queryFn: async () => {
      const url = selectedCompanyId !== "all"
        ? `/api/master?type=estate&companyId=${selectedCompanyId}`
        : "/api/master?type=estate";
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    },
  });

  // Query Data for Current Level
  const { data: tableData = [], isLoading } = useQuery<unknown[]>({
    queryKey: [
      "master",
      level,
      search,
      selectedRegionId,
      selectedCompanyId,
      selectedEstateId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ type: level });
      if (search) params.append("search", search);
      if (level === "company" && selectedRegionId !== "all") params.append("regionId", selectedRegionId);
      if (level === "estate" && selectedCompanyId !== "all") params.append("companyId", selectedCompanyId);
      if (level === "block" && selectedEstateId !== "all") params.append("estateId", selectedEstateId);

      const res = await fetch(`/api/master?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat data lokasi");
      return json.data;
    },
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string; data: Record<string, unknown> }) => {
      const isEdit = Boolean(data.id);
      const res = await fetch(`/api/master?type=${type}`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menyimpan data");
      return json.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["master", variables.type] });
      queryClient.invalidateQueries({ queryKey: ["master", "region"] });
      queryClient.invalidateQueries({ queryKey: ["master", "company"] });
      queryClient.invalidateQueries({ queryKey: ["master", "estate"] });
      queryClient.invalidateQueries({ queryKey: ["master", "block"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      setDeleteErrorMsg(null);
      const res = await fetch(`/api/master?type=${type}&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Gagal menghapus data");
      }
      return json.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["master", variables.type] });
      queryClient.invalidateQueries({ queryKey: ["master", "region"] });
      queryClient.invalidateQueries({ queryKey: ["master", "company"] });
      queryClient.invalidateQueries({ queryKey: ["master", "estate"] });
      queryClient.invalidateQueries({ queryKey: ["master", "block"] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Gagal menghapus data";
      setDeleteErrorMsg(msg);
    },
  });

  // Handle Save
  const handleSave = async (data: Record<string, unknown>) => {
    await saveMutation.mutateAsync({ type: dialogState.type, data });
  };

  // --- Column Definitions ---
  const regionColumns: ColumnDef<RegionRow>[] = [
    {
      accessorKey: "code",
      header: "Kode Region",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-xs text-primary">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nama Wilayah / Region",
      cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "_count.companies",
      header: "Jumlah PT",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original._count?.companies || 0} Perusahaan</span>
      ),
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
            cell: ({ row }: { row: { original: RegionRow } }) => (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Ubah region ${row.original.name}`}
                  onClick={() =>
                    setDialogState({
                      type: "region",
                      open: true,
                      initialData: row.original,
                    })
                  }
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  aria-label={`Hapus region ${row.original.name}`}
                  onClick={() => {
                    setDeleteErrorMsg(null);
                    setDeleteTarget({
                      type: "region",
                      id: row.original.id,
                      name: row.original.name,
                      code: row.original.code,
                      cascadeWarning: "Menghapus Region ini akan memutus relasi pada perusahaan-perusahaan terkait.",
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const companyColumns: ColumnDef<CompanyRow>[] = [
    {
      accessorKey: "code",
      header: "Kode PT",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-xs text-primary">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nama Perusahaan (PT)",
      cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "region",
      header: "Region",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.region ? `${row.original.region.name} (${row.original.region.code})` : "-"}
        </span>
      ),
    },
    {
      accessorKey: "_count.estates",
      header: "Jumlah Kebun",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original._count?.estates || 0} Estate</span>
      ),
    },
    {
      accessorKey: "_count.projects",
      header: "Proyek Terdaftar",
      cell: ({ row }) => (
        <Badge variant={row.original._count?.projects ? "outline" : "secondary"} className="text-[11px] font-mono">
          {row.original._count?.projects || 0} Proyek
        </Badge>
      ),
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
            cell: ({ row }: { row: { original: CompanyRow } }) => (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Ubah company ${row.original.name}`}
                  onClick={() =>
                    setDialogState({
                      type: "company",
                      open: true,
                      initialData: row.original,
                    })
                  }
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  aria-label={`Hapus company ${row.original.name}`}
                  onClick={() => {
                    setDeleteErrorMsg(null);
                    setDeleteTarget({
                      type: "company",
                      id: row.original.id,
                      name: row.original.name,
                      code: row.original.code,
                      cascadeWarning: "PERINGATAN CASCADE: Menghapus Perusahaan ini akan otomatis menghapus seluruh Estate dan Blok di bawahnya! Operasi akan ditolak jika ada proyek yang menggunakan lokasi ini.",
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const estateColumns: ColumnDef<EstateRow>[] = [
    {
      accessorKey: "code",
      header: "Kode Kebun",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-xs text-primary">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nama Estate",
      cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "company",
      header: "Perusahaan (PT)",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.company?.name || "-"} ({row.original.company?.code})
        </span>
      ),
    },
    {
      accessorKey: "_count.blocks",
      header: "Jumlah Blok",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original._count?.blocks || 0} Blok</span>
      ),
    },
    {
      accessorKey: "_count.projects",
      header: "Proyek Terdaftar",
      cell: ({ row }) => (
        <Badge variant={row.original._count?.projects ? "outline" : "secondary"} className="text-[11px] font-mono">
          {row.original._count?.projects || 0} Proyek
        </Badge>
      ),
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
            cell: ({ row }: { row: { original: EstateRow } }) => (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Ubah estate ${row.original.name}`}
                  onClick={() =>
                    setDialogState({
                      type: "estate",
                      open: true,
                      initialData: row.original,
                    })
                  }
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  aria-label={`Hapus estate ${row.original.name}`}
                  onClick={() => {
                    setDeleteErrorMsg(null);
                    setDeleteTarget({
                      type: "estate",
                      id: row.original.id,
                      name: row.original.name,
                      code: row.original.code,
                      cascadeWarning: "PERINGATAN CASCADE: Menghapus Estate ini akan otomatis menghapus seluruh Blok di bawahnya! Operasi akan ditolak jika masih digunakan proyek.",
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const blockColumns: ColumnDef<BlockRow>[] = [
    {
      accessorKey: "blockCode",
      header: "Kode Blok",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-xs text-primary">{row.original.blockCode}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nama Blok",
      cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "estate",
      header: "Estate & PT",
      cell: ({ row }) => (
        <div className="text-xs">
          <span className="font-medium">{row.original.estate?.name}</span>
          <span className="text-muted-foreground ml-1">
            ({row.original.estate?.company?.code})
          </span>
        </div>
      ),
    },
    {
      accessorKey: "plantingYear",
      header: "Tahun Tanam",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.plantingYear || "-"}</span>
      ),
    },
    {
      accessorKey: "areaHectares",
      header: "Luas (Ha)",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.areaHectares ? `${row.original.areaHectares} Ha` : "-"}
        </span>
      ),
    },
    {
      accessorKey: "_count.projects",
      header: "Proyek Terdaftar",
      cell: ({ row }) => (
        <Badge variant={row.original._count?.projects ? "outline" : "secondary"} className="text-[11px] font-mono">
          {row.original._count?.projects || 0} Proyek
        </Badge>
      ),
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
            cell: ({ row }: { row: { original: BlockRow } }) => (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Ubah blok ${row.original.name}`}
                  onClick={() =>
                    setDialogState({
                      type: "block",
                      open: true,
                      initialData: row.original,
                    })
                  }
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  aria-label={`Hapus blok ${row.original.name}`}
                  onClick={() => {
                    setDeleteErrorMsg(null);
                    setDeleteTarget({
                      type: "block",
                      id: row.original.id,
                      name: row.original.name,
                      code: row.original.blockCode,
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Hierarki Lokasi Kebun & Perusahaan</span>
            </CardTitle>
            <CardDescription>
              Kelola struktur berjenjang dari Region &rarr; PT (Company) &rarr; Kebun (Estate) &rarr; Blok kebun.
            </CardDescription>
          </div>

          {canModify && (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                className="font-semibold shadow-xs"
                onClick={() =>
                  setDialogState({
                    type: level,
                    open: true,
                    initialData: null,
                  })
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Tambah {level === "region" ? "Region" : level === "company" ? "Perusahaan (PT)" : level === "estate" ? "Estate" : "Blok"}
              </Button>
            </div>
          )}
        </div>

        {/* Level Selector Tabs */}
        <div className="flex items-center space-x-2 pt-3 border-b border-border pb-3">
          <Button
            variant={level === "region" ? "default" : "outline"}
            size="sm"
            onClick={() => setLevel("region")}
            className="h-8 text-xs font-medium"
          >
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            Region ({regionList.length})
          </Button>
          <Button
            variant={level === "company" ? "default" : "outline"}
            size="sm"
            onClick={() => setLevel("company")}
            className="h-8 text-xs font-medium"
          >
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Perusahaan (PT) ({companyList.length})
          </Button>
          <Button
            variant={level === "estate" ? "default" : "outline"}
            size="sm"
            onClick={() => setLevel("estate")}
            className="h-8 text-xs font-medium"
          >
            <Trees className="mr-1.5 h-3.5 w-3.5" />
            Estate / Kebun ({estateList.length})
          </Button>
          <Button
            variant={level === "block" ? "default" : "outline"}
            size="sm"
            onClick={() => setLevel("block")}
            className="h-8 text-xs font-medium"
          >
            <Grid className="mr-1.5 h-3.5 w-3.5" />
            Blok Kebun
          </Button>
        </div>

        {/* Cascading Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          {/* Filter Region */}
          {(level === "company" || level === "estate" || level === "block") && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Filter Region:
              </label>
              <Select
                value={selectedRegionId}
                onValueChange={(val) => {
                  setSelectedRegionId(val);
                  setSelectedCompanyId("all");
                  setSelectedEstateId("all");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">-- Semua Region --</SelectItem>
                  {regionList.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">
                      {r.name} ({r.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filter Company */}
          {(level === "estate" || level === "block") && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Filter Perusahaan (PT):
              </label>
              <Select
                value={selectedCompanyId}
                onValueChange={(val) => {
                  setSelectedCompanyId(val);
                  setSelectedEstateId("all");
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">-- Semua Perusahaan --</SelectItem>
                  {companyList.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filter Estate */}
          {level === "block" && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Filter Estate / Kebun:
              </label>
              <Select
                value={selectedEstateId}
                onValueChange={(val) => setSelectedEstateId(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Semua Estate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">-- Semua Estate --</SelectItem>
                  {estateList.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.name} ({e.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search box */}
          <div className="relative flex items-end">
            <div className="w-full">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Cari Data:
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Cari kode / nama ${level}...`}
                  className="pl-8 h-8 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
            Memuat hierarki lokasi perkebunan...
          </div>
        ) : (
          <div>
            {level === "region" && (
              <DataTable columns={regionColumns} data={(tableData as RegionRow[]) || []} />
            )}
            {level === "company" && (
              <DataTable columns={companyColumns} data={(tableData as CompanyRow[]) || []} />
            )}
            {level === "estate" && (
              <DataTable columns={estateColumns} data={(tableData as EstateRow[]) || []} />
            )}
            {level === "block" && (
              <DataTable columns={blockColumns} data={(tableData as BlockRow[]) || []} />
            )}
          </div>
        )}
      </CardContent>

      {/* Dialog Forms */}
      <RegionDialog
        open={dialogState.open && dialogState.type === "region"}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        onSubmit={handleSave}
        initialData={
          dialogState.initialData as {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
          } | null
        }
      />

      <CompanyDialog
        open={dialogState.open && dialogState.type === "company"}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        onSubmit={handleSave}
        initialData={
          dialogState.initialData as {
            id: string;
            code: string;
            name: string;
            regionId?: string | null;
            isActive: boolean;
          } | null
        }
        regionList={regionList}
      />

      <EstateDialog
        open={dialogState.open && dialogState.type === "estate"}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        onSubmit={handleSave}
        initialData={
          dialogState.initialData as {
            id: string;
            companyId: string;
            code: string;
            name: string;
            region?: string | null;
            isActive: boolean;
          } | null
        }
        companyList={companyList}
        defaultCompanyId={selectedCompanyId !== "all" ? selectedCompanyId : undefined}
      />

      <BlockDialog
        open={dialogState.open && dialogState.type === "block"}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
        onSubmit={handleSave}
        initialData={
          dialogState.initialData as {
            id: string;
            estateId: string;
            blockCode: string;
            name: string;
            plantingYear?: number | null;
            areaHectares?: number | null;
            isActive: boolean;
          } | null
        }
        estateList={estateList}
        defaultEstateId={selectedEstateId !== "all" ? selectedEstateId : undefined}
      />

      {/* Alert Dialog Delete dengan Peringatan Cascade & Error Handler 409 */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteErrorMsg(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Konfirmasi Hapus {deleteTarget?.type.toUpperCase()}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <div>
                Apakah Anda yakin ingin menghapus data{" "}
                <span className="font-semibold text-foreground">
                  {deleteTarget?.name} ({deleteTarget?.code})
                </span>
                ?
              </div>

              {deleteTarget?.cascadeWarning && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md text-amber-900 dark:text-amber-200 text-xs">
                  {deleteTarget.cascadeWarning}
                </div>
              )}

              {deleteErrorMsg && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md font-medium">
                  {deleteErrorMsg}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({
                    type: deleteTarget.type,
                    id: deleteTarget.id,
                  });
                }
              }}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Data"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
