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
  ChevronDown,
  ChevronRight,
  Edit,
  Globe,
  Grid,
  ListTree,
  MapPin,
  Plus,
  Search,
  Table as TableIcon,
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
  ops?: string | null;
  order?: number;
  isActive: boolean;
  _count?: { companies: number };
}

export interface CompanyRow {
  id: string;
  code: string;
  name: string;
  alias?: string | null;
  ops?: string | null;
  order?: number;
  regionId?: string | null;
  region?: { id: string; code: string; name: string; ops?: string | null } | null;
  isActive: boolean;
  _count?: { estates: number; projects: number };
  estates?: Array<{
    id: string;
    code: string;
    name: string;
    ops?: string | null;
    region?: string | null;
    group?: string | null;
    estateNew?: string | null;
    legacyCode?: string | null;
    order?: number;
    blocks?: Array<{
      id: string;
      blockCode: string;
      name: string;
    }>;
  }>;
}

export interface EstateRow {
  id: string;
  companyId: string;
  code: string;
  name: string;
  ops?: string | null;
  region?: string | null;
  group?: string | null;
  estateNew?: string | null;
  legacyCode?: string | null;
  order?: number;
  company?: { id: string; code: string; name: string; alias?: string | null; ops?: string | null };
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

  // Mode Tampilan: Tree View (default) vs Table View
  const [viewMode, setViewMode] = React.useState<"tree" | "table">("tree");

  // Sub-level tab untuk Table View: region | company | estate | block
  const [level, setLevel] = React.useState<"region" | "company" | "estate" | "block">("company");
  const [search, setSearch] = React.useState("");

  // Tree View State
  const [treeSearch, setTreeSearch] = React.useState("");
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
    () => new Set(["ops:SUMATERA", "ops:KALBAR", "ops:WILTIM"])
  );

  // Cascading Filter States untuk Table View
  const [selectedRegionId, setSelectedRegionId] = React.useState<string>("all");
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("all");
  const [selectedEstateId, setSelectedEstateId] = React.useState<string>("all");

  // Dialog State
  const [dialogState, setDialogState] = React.useState<{
    type: "region" | "company" | "estate" | "block";
    open: boolean;
    initialData: RegionRow | CompanyRow | EstateRow | BlockRow | null;
    defaultCompanyId?: string;
    defaultEstateId?: string;
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

  // Queries for Dropdowns & Tree View
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
      const url =
        selectedRegionId !== "all"
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
      const url =
        selectedCompanyId !== "all"
          ? `/api/master?type=estate&companyId=${selectedCompanyId}`
          : "/api/master?type=estate";
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    },
  });

  // Query Hierarchy untuk Tree View
  const { data: hierarchyCompanies = [], isLoading: isHierarchyLoading } = useQuery<CompanyRow[]>({
    queryKey: ["master", "hierarchy"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=company&include=hierarchy");
      const json = await res.json();
      return json.success ? json.data : [];
    },
  });

  // Query Data untuk Table View
  const { data: tableData = [], isLoading: isTableLoading } = useQuery<unknown[]>({
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
    enabled: viewMode === "table",
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
      queryClient.invalidateQueries({ queryKey: ["master", "hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["master-companies-hierarchy"] });
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
      queryClient.invalidateQueries({ queryKey: ["master", "hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["master-companies-hierarchy"] });
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

  // Node Toggle Helper
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Expand / Collapse All
  const handleExpandAll = () => {
    const allIds = new Set<string>();
    allIds.add("ops:SUMATERA");
    allIds.add("ops:KALBAR");
    allIds.add("ops:WILTIM");
    allIds.add("ops:LAINNYA");
    hierarchyCompanies.forEach((c) => {
      allIds.add(`comp:${c.id}`);
      c.estates?.forEach((e) => {
        allIds.add(`est:${e.id}`);
      });
    });
    setExpandedNodes(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Group Hierarchy by Ops
  const opsGroups = React.useMemo(() => {
    const groups: Record<
      string,
      {
        ops: string;
        companies: CompanyRow[];
        totalEstates: number;
        totalBlocks: number;
      }
    > = {
      SUMATERA: { ops: "SUMATERA", companies: [], totalEstates: 0, totalBlocks: 0 },
      KALBAR: { ops: "KALBAR", companies: [], totalEstates: 0, totalBlocks: 0 },
      WILTIM: { ops: "WILTIM", companies: [], totalEstates: 0, totalBlocks: 0 },
    };

    const q = treeSearch.trim().toLowerCase();

    hierarchyCompanies.forEach((comp) => {
      const compOps = comp.ops || comp.region?.ops || "SUMATERA";
      if (!groups[compOps]) {
        groups[compOps] = { ops: compOps, companies: [], totalEstates: 0, totalBlocks: 0 };
      }

      // Filter Estates jika ada search
      const matchingEstates = (comp.estates || []).filter((est) => {
        if (!q) return true;
        const inEstate =
          est.name.toLowerCase().includes(q) ||
          est.code.toLowerCase().includes(q) ||
          (est.estateNew && est.estateNew.toLowerCase().includes(q)) ||
          (est.legacyCode && est.legacyCode.toLowerCase().includes(q)) ||
          (est.group && est.group.toLowerCase().includes(q)) ||
          (est.region && est.region.toLowerCase().includes(q));
        const inComp =
          comp.name.toLowerCase().includes(q) ||
          comp.code.toLowerCase().includes(q) ||
          (comp.alias && comp.alias.toLowerCase().includes(q));
        return inEstate || inComp;
      });

      const compMatches =
        !q ||
        comp.name.toLowerCase().includes(q) ||
        comp.code.toLowerCase().includes(q) ||
        (comp.alias && comp.alias.toLowerCase().includes(q)) ||
        matchingEstates.length > 0;

      if (compMatches) {
        const estList = q ? matchingEstates : comp.estates || [];
        const blocksCount = estList.reduce((acc, e) => acc + (e.blocks?.length || 0), 0);

        groups[compOps].companies.push({
          ...comp,
          estates: estList,
        });
        groups[compOps].totalEstates += estList.length;
        groups[compOps].totalBlocks += blocksCount;
      }
    });

    return Object.values(groups).filter((g) => g.companies.length > 0);
  }, [hierarchyCompanies, treeSearch]);

  // Total Summary Stats
  const totalStats = React.useMemo(() => {
    const totalEst = hierarchyCompanies.reduce((acc, c) => acc + (c.estates?.length || 0), 0);
    return {
      opsCount: 3,
      companyCount: hierarchyCompanies.length,
      estateCount: totalEst,
    };
  }, [hierarchyCompanies]);

  // Auto-expand nodes when searching
  React.useEffect(() => {
    if (treeSearch.trim()) {
      const autoExpanded = new Set<string>();
      opsGroups.forEach((g) => {
        autoExpanded.add(`ops:${g.ops}`);
        g.companies.forEach((c) => {
          autoExpanded.add(`comp:${c.id}`);
          c.estates?.forEach((e) => {
            autoExpanded.add(`est:${e.id}`);
          });
        });
      });
      setExpandedNodes(autoExpanded);
    }
  }, [treeSearch, opsGroups]);

  // --- Table Column Definitions ---
  const regionColumns: ColumnDef<RegionRow>[] = [
    {
      accessorKey: "order",
      header: "#",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.order || "-"}</span>
      ),
    },
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
      accessorKey: "ops",
      header: "Wilayah (Ops)",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[11px] font-medium">
          {row.original.ops || "-"}
        </Badge>
      ),
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
                      cascadeWarning:
                        "Menghapus Region ini akan memutus relasi pada perusahaan-perusahaan terkait.",
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
      accessorKey: "order",
      header: "#",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-muted-foreground">
          {row.original.order || "-"}
        </span>
      ),
    },
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
      accessorKey: "ops",
      header: "Wilayah (Ops)",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[11px] font-medium">
          {row.original.ops || "-"}
        </Badge>
      ),
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
        <Badge
          variant={row.original._count?.projects ? "outline" : "secondary"}
          className="text-[11px] font-mono"
        >
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
                  className="h-8 w-8 text-primary"
                  title="Tambah Estate di PT ini"
                  onClick={() =>
                    setDialogState({
                      type: "estate",
                      open: true,
                      initialData: null,
                      defaultCompanyId: row.original.id,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
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
                      cascadeWarning:
                        "PERINGATAN CASCADE: Menghapus Perusahaan ini akan otomatis menghapus seluruh Estate dan Blok di bawahnya! Operasi akan ditolak jika ada proyek yang menggunakan lokasi ini.",
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
      accessorKey: "order",
      header: "#",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-muted-foreground">
          {row.original.order || "-"}
        </span>
      ),
    },
    {
      accessorKey: "ops",
      header: "Wilayah",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[11px]">
          {row.original.ops || "-"}
        </Badge>
      ),
    },
    {
      accessorKey: "group",
      header: "Group",
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.group || "-"}</span>,
    },
    {
      accessorKey: "code",
      header: "Kode Estate",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-xs text-primary">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "estateNew",
      header: "Kode Baru",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.estateNew || "-"}
        </span>
      ),
    },
    {
      accessorKey: "legacyCode",
      header: "Kode Lama",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.legacyCode || "-"}
        </span>
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
      header: "Proyek",
      cell: ({ row }) => (
        <Badge
          variant={row.original._count?.projects ? "outline" : "secondary"}
          className="text-[11px] font-mono"
        >
          {row.original._count?.projects || 0}
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
                  className="h-8 w-8 text-primary"
                  title="Tambah Blok di Estate ini"
                  onClick={() =>
                    setDialogState({
                      type: "block",
                      open: true,
                      initialData: null,
                      defaultEstateId: row.original.id,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
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
                      cascadeWarning:
                        "PERINGATAN CASCADE: Menghapus Estate ini akan otomatis menghapus seluruh Blok di bawahnya! Operasi akan ditolak jika masih digunakan proyek.",
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
      header: "Estate Induk",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.estate?.name || "-"} ({row.original.estate?.code})
        </span>
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
          {row.original.areaHectares ? `${row.original.areaHectares} ha` : "-"}
        </span>
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
                      cascadeWarning: "Operasi akan ditolak bila blok masih digunakan dalam proyek aktif.",
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
    <Card className="border shadow-xs">
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Hierarki Wilayah & Lokasi Operasional
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {totalStats.opsCount} Wilayah Operasional (Ops) · {totalStats.companyCount} Perusahaan (PT) · {totalStats.estateCount} Estate Terdaftar
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center border rounded-md p-0.5 bg-muted/40">
              <Button
                variant={viewMode === "tree" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs font-medium gap-1.5"
                onClick={() => setViewMode("tree")}
              >
                <ListTree className="h-3.5 w-3.5" />
                Pohon Hierarki (Tree)
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs font-medium gap-1.5"
                onClick={() => setViewMode("table")}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Tabel Data
              </Button>
            </div>

            {canModify && (
              <Button
                size="sm"
                className="h-8 text-xs font-medium gap-1.5"
                onClick={() => {
                  setDialogState({
                    type: viewMode === "tree" ? "company" : level,
                    open: true,
                    initialData: null,
                  });
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah {viewMode === "tree" ? "Perusahaan" : level.toUpperCase()}
              </Button>
            )}
          </div>
        </div>

        {/* --- TREE VIEW TOOLBAR --- */}
        {viewMode === "tree" ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari PT, Estate, Kode (cth: Meranti, THIP, JJP1, Kalbar)..."
                className="pl-8 h-8 text-xs"
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleExpandAll}
              >
                Buka Semua
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleCollapseAll}
              >
                Tutup Semua
              </Button>
            </div>
          </div>
        ) : (
          /* --- TABLE VIEW TOOLBAR & FILTERS --- */
          <div className="space-y-3 pt-2 border-t">
            <div className="flex flex-wrap gap-2">
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

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* --- TAMPILAN POHON (TREE VIEW) --- */}
        {viewMode === "tree" ? (
          isHierarchyLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground animate-pulse">
              Memuat struktur hierarki lokasi perkebunan...
            </div>
          ) : opsGroups.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Tidak ada lokasi yang cocok dengan kata kunci &quot;{treeSearch}&quot;.
            </div>
          ) : (
            <div className="space-y-4">
              {opsGroups.map((group) => {
                const isOpsExpanded = expandedNodes.has(`ops:${group.ops}`);
                return (
                  <div
                    key={group.ops}
                    className="border rounded-lg bg-card/60 overflow-hidden shadow-2xs"
                  >
                    {/* Level 1: Ops Bar */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleNode(`ops:${group.ops}`)}
                    >
                      <div className="flex items-center gap-2">
                        {isOpsExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm text-foreground tracking-wide">
                          {group.ops}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {group.companies.length} Perusahaan · {group.totalEstates} Kebun
                        </Badge>
                      </div>
                    </div>

                    {/* Level 2: Companies */}
                    {isOpsExpanded && (
                      <div className="p-2 space-y-2">
                        {group.companies.map((comp) => {
                          const isCompExpanded = expandedNodes.has(`comp:${comp.id}`);
                          const estateCount = comp.estates?.length || 0;

                          return (
                            <div
                              key={comp.id}
                              className="border rounded-md bg-background/90 overflow-hidden ml-3 sm:ml-5"
                            >
                              {/* Company Header */}
                              <div className="flex items-center justify-between px-3 py-2 bg-muted/15 hover:bg-muted/25 transition-colors">
                                <div
                                  className="flex items-center gap-2 flex-1 cursor-pointer"
                                  onClick={() => toggleNode(`comp:${comp.id}`)}
                                >
                                  {estateCount > 0 ? (
                                    isCompExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )
                                  ) : (
                                    <span className="w-3.5" />
                                  )}
                                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  <span className="font-mono font-bold text-xs text-primary">
                                    [{comp.code}]
                                  </span>
                                  <span className="text-xs font-semibold text-foreground">
                                    {comp.name}
                                  </span>
                                  {comp.region && (
                                    <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
                                      {comp.region.name}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-[10px] ml-1">
                                    {estateCount} Kebun
                                  </Badge>
                                </div>

                                {canModify && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-[11px] px-2 text-primary gap-1"
                                      onClick={() =>
                                        setDialogState({
                                          type: "estate",
                                          open: true,
                                          initialData: null,
                                          defaultCompanyId: comp.id,
                                        })
                                      }
                                    >
                                      <Plus className="h-3 w-3" />
                                      Kebun
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        setDialogState({
                                          type: "company",
                                          open: true,
                                          initialData: comp,
                                        })
                                      }
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        setDeleteErrorMsg(null);
                                        setDeleteTarget({
                                          type: "company",
                                          id: comp.id,
                                          name: comp.name,
                                          code: comp.code,
                                          cascadeWarning:
                                            "Menghapus Perusahaan akan otomatis menghapus semua Estate dan Blok di bawahnya.",
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Level 3: Estates */}
                              {isCompExpanded && (
                                <div className="p-2 space-y-1.5 bg-muted/5 border-t">
                                  {estateCount === 0 ? (
                                    <div className="text-[11px] text-muted-foreground py-2 text-center">
                                      Belum ada estate di bawah perusahaan ini.
                                    </div>
                                  ) : (
                                    comp.estates?.map((est) => {
                                      const isEstExpanded = expandedNodes.has(`est:${est.id}`);
                                      const blockCount = est.blocks?.length || 0;

                                      return (
                                        <div
                                          key={est.id}
                                          className="border rounded bg-card/90 ml-3 sm:ml-5 overflow-hidden text-xs"
                                        >
                                          {/* Estate Row */}
                                          <div className="flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/30 transition-colors">
                                            <div
                                              className="flex items-center gap-2 flex-1 cursor-pointer flex-wrap"
                                              onClick={() => toggleNode(`est:${est.id}`)}
                                            >
                                              {blockCount > 0 ? (
                                                isEstExpanded ? (
                                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                ) : (
                                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                )
                                              ) : (
                                                <span className="w-3" />
                                              )}
                                              <Trees className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                              <span className="font-mono text-[11px] font-bold text-muted-foreground">
                                                #{est.order}
                                              </span>
                                              <span className="font-mono font-bold text-primary">
                                                [{est.code}]
                                              </span>
                                              <span className="font-semibold text-foreground">
                                                {est.name}
                                              </span>

                                              {est.group && (
                                                <Badge
                                                  variant="secondary"
                                                  className="text-[10px] px-1 py-0"
                                                >
                                                  {est.group}
                                                </Badge>
                                              )}

                                              {est.estateNew && est.estateNew !== est.code && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[10px] px-1 py-0 font-mono text-muted-foreground"
                                                >
                                                  Alt: {est.estateNew}
                                                </Badge>
                                              )}

                                              {est.legacyCode && est.legacyCode !== est.code && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[10px] px-1 py-0 font-mono text-muted-foreground"
                                                >
                                                  Lama: {est.legacyCode}
                                                </Badge>
                                              )}

                                              {blockCount > 0 && (
                                                <span className="text-[10px] text-muted-foreground ml-auto pr-2">
                                                  {blockCount} Blok
                                                </span>
                                              )}
                                            </div>

                                            {canModify && (
                                              <div className="flex items-center gap-0.5">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 text-[10px] px-1.5 text-primary gap-0.5"
                                                  onClick={() =>
                                                    setDialogState({
                                                      type: "block",
                                                      open: true,
                                                      initialData: null,
                                                      defaultEstateId: est.id,
                                                    })
                                                  }
                                                >
                                                  <Plus className="h-2.5 w-2.5" />
                                                  Blok
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6"
                                                  onClick={() =>
                                                    setDialogState({
                                                      type: "estate",
                                                      open: true,
                                                      initialData: {
                                                        ...est,
                                                        companyId: comp.id,
                                                        isActive: true,
                                                      },
                                                    })
                                                  }
                                                >
                                                  <Edit className="h-2.5 w-2.5" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                                  onClick={() => {
                                                    setDeleteErrorMsg(null);
                                                    setDeleteTarget({
                                                      type: "estate",
                                                      id: est.id,
                                                      name: est.name,
                                                      code: est.code,
                                                      cascadeWarning:
                                                        "Menghapus Estate akan otomatis menghapus seluruh Blok di dalamnya.",
                                                    });
                                                  }}
                                                >
                                                  <Trash2 className="h-2.5 w-2.5" />
                                                </Button>
                                              </div>
                                            )}
                                          </div>

                                          {/* Level 4: Blocks */}
                                          {isEstExpanded && blockCount > 0 && (
                                            <div className="pl-6 pr-2 py-1.5 bg-muted/10 border-t space-y-1">
                                              {est.blocks?.map((block) => (
                                                <div
                                                  key={block.id}
                                                  className="flex items-center justify-between py-0.5 text-[11px]"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Grid className="h-3 w-3 text-muted-foreground" />
                                                    <span className="font-mono font-semibold">
                                                      {block.blockCode}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                      {block.name}
                                                    </span>
                                                  </div>

                                                  {canModify && (
                                                    <div className="flex items-center gap-0.5">
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 text-destructive hover:bg-destructive/10"
                                                        onClick={() => {
                                                          setDeleteErrorMsg(null);
                                                          setDeleteTarget({
                                                            type: "block",
                                                            id: block.id,
                                                            name: block.name,
                                                            code: block.blockCode,
                                                          });
                                                        }}
                                                      >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* --- TAMPILAN TABEL KLASIK (TABLE VIEW) --- */
          isTableLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
              Memuat data tabel lokasi perkebunan...
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
          )
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
            ops?: string | null;
            order?: number;
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
            alias?: string | null;
            ops?: string | null;
            order?: number;
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
            ops?: string | null;
            region?: string | null;
            group?: string | null;
            estateNew?: string | null;
            legacyCode?: string | null;
            order?: number;
            isActive: boolean;
          } | null
        }
        companyList={companyList}
        defaultCompanyId={
          dialogState.defaultCompanyId ||
          (selectedCompanyId !== "all" ? selectedCompanyId : undefined)
        }
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
        defaultEstateId={
          dialogState.defaultEstateId ||
          (selectedEstateId !== "all" ? selectedEstateId : undefined)
        }
      />

      {/* Alert Dialog Delete dengan Peringatan Cascade */}
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
