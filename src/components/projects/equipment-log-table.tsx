"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import { EquipmentOwnership, PackageCategory } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  Edit,
  Gauge,
  Layers,
  Lock,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import React, { useMemo, useState } from "react";

export interface EquipmentLogRow {
  id: string;
  projectId: string;
  workPackageId?: string | null;
  logDate: string;
  unitCode: string;
  equipmentType: string;
  ownership: EquipmentOwnership;
  hmStart: number;
  hmEnd: number;
  hmHours: number;
  fuelLiters?: number | null;
  workVolume?: number | null;
  volumeUnit?: string | null;
  workDescription?: string | null;
  workPackage?: { id: string; packageName: string } | null;
}

export interface WorkPackageOption {
  id: string;
  packageName: string;
  category?: PackageCategory;
  targetQuantity?: number | null;
  uom?: string | null;
  volumeAchieved?: number | null;
  totalPlannedQty?: number | null;
  items?: Array<{ item?: { uom?: { code?: string } } }>;
}

interface EquipmentLogTableProps {
  projectId: string;
  isCompleted: boolean;
  logs: EquipmentLogRow[];
  workPackages: WorkPackageOption[];
  isLoading?: boolean;
}

export function EquipmentLogTable({
  projectId,
  isCompleted,
  logs,
  workPackages,
  isLoading,
}: EquipmentLogTableProps) {
  const queryClient = useQueryClient();

  // Fetch Master Data UoM untuk dropdown satuan
  const { data: uomData } = useQuery({
    queryKey: ["master-uom-list"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=uom");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []) as Array<{ id: string; code: string; name: string; isActive: boolean }>;
    },
  });

  const uomList = useMemo(() => {
    if (!Array.isArray(uomData)) return [];
    return uomData.filter((u) => u.isActive);
  }, [uomData]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<EquipmentLogRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [unitCode, setUnitCode] = useState("");
  const [equipmentType, setEquipmentType] = useState("Excavator");
  const [ownership, setOwnership] = useState<EquipmentOwnership>(EquipmentOwnership.OWNED);
  const [selectedWpId, setSelectedWpId] = useState<string>("none");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [hmStart, setHmStart] = useState<string>("");
  const [hmEnd, setHmEnd] = useState<string>("");
  const [fuelLiters, setFuelLiters] = useState<string>("");
  const [workVolume, setWorkVolume] = useState<string>("");
  const [volumeUnit, setVolumeUnit] = useState<string>("m");
  const [workDescription, setWorkDescription] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Paket kerja yang sedang dipilih
  const selectedWp = useMemo(() => {
    if (!selectedWpId || selectedWpId === "none") return null;
    return workPackages.find((wp) => wp.id === selectedWpId) || null;
  }, [selectedWpId, workPackages]);

  // Handler memilih paket kerja: otomatis set satuan sesuai paket
  const handleSelectWp = (wpId: string) => {
    setSelectedWpId(wpId);
    if (wpId !== "none") {
      const wp = workPackages.find((w) => w.id === wpId);
      const wpUom = wp?.uom || wp?.items?.[0]?.item?.uom?.code;
      if (wpUom) {
        setVolumeUnit(wpUom);
      }
    }
  };

  // Seluruh log alat berat untuk paket terpilih
  const selectedWpEquipmentLogs = useMemo(() => {
    if (!selectedWpId || selectedWpId === "none") return [];
    return logs.filter((l) => l.workPackageId === selectedWpId);
  }, [selectedWpId, logs]);

  // Total volume kerja dari log alat berat yang sudah dicatat sebelumnya
  const totalRecordedEquipmentVolume = useMemo(() => {
    return selectedWpEquipmentLogs.reduce((sum, l) => {
      // Jika sedang edit, kurangi volume log yang sedang diedit agar tidak terhitung ganda
      if (editingLog && l.id === editingLog.id) return sum;
      return sum + (Number(l.workVolume) || 0);
    }, 0);
  }, [selectedWpEquipmentLogs, editingLog]);

  // Statistik Target Rencana vs Akumulasi Realisasi untuk paket terpilih
  const wpStats = useMemo(() => {
    if (!selectedWp) return null;
    const target =
      selectedWp.targetQuantity !== null && selectedWp.targetQuantity !== undefined
        ? Number(selectedWp.targetQuantity)
        : selectedWp.totalPlannedQty || 0;

    // Akumulasi realisasi dari log alat berat yang ada, sinkron dengan volumeAchieved
    const currentAchieved = Math.max(
      totalRecordedEquipmentVolume,
      selectedWp.volumeAchieved || 0
    );
    const remaining = target > 0 ? Math.max(0, Math.round((target - currentAchieved) * 100) / 100) : null;
    const inputVol = parseFloat(workVolume) || 0;
    const projectedAchieved = Math.round((currentAchieved + inputVol) * 100) / 100;
    const projectedRemaining = target > 0 ? Math.max(0, Math.round((target - projectedAchieved) * 100) / 100) : null;

    const uom =
      selectedWp.uom ||
      selectedWp.items?.[0]?.item?.uom?.code ||
      volumeUnit ||
      "unit";

    return {
      target,
      uom,
      currentAchieved,
      remaining,
      projectedAchieved,
      projectedRemaining,
      recordedLogCount: selectedWpEquipmentLogs.length,
    };
  }, [selectedWp, totalRecordedEquipmentVolume, selectedWpEquipmentLogs.length, workVolume, volumeUnit]);

  // Perhitungan preview jam kerja di client (HM bersifat opsional)
  const calculatedHours = useMemo(() => {
    if (hmStart.trim() === "" || hmEnd.trim() === "") return 0;
    const start = parseFloat(hmStart);
    const end = parseFloat(hmEnd);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return Math.round((end - start) * 100) / 100;
    }
    return 0;
  }, [hmStart, hmEnd]);

  const isHmInvalid = useMemo(() => {
    if (hmStart.trim() === "" || hmEnd.trim() === "") return false;
    const start = parseFloat(hmStart);
    const end = parseFloat(hmEnd);
    return !isNaN(start) && !isNaN(end) && end < start;
  }, [hmStart, hmEnd]);

  const openCreateDialog = () => {
    setEditingLog(null);
    setUnitCode("");
    setEquipmentType("Excavator");
    setOwnership(EquipmentOwnership.OWNED);
    setSelectedWpId("none");
    setLogDate(new Date().toISOString().split("T")[0]);
    setHmStart("");
    setHmEnd("");
    setFuelLiters("");
    setWorkVolume("");
    setVolumeUnit("m");
    setWorkDescription("");
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (log: EquipmentLogRow) => {
    setEditingLog(log);
    setUnitCode(log.unitCode);
    setEquipmentType(log.equipmentType);
    setOwnership(log.ownership);
    setSelectedWpId(log.workPackageId || "none");
    setLogDate(
      log.logDate
        ? new Date(log.logDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setHmStart(log.hmStart > 0 || log.hmHours > 0 ? String(log.hmStart) : "");
    setHmEnd(log.hmEnd > 0 || log.hmHours > 0 ? String(log.hmEnd) : "");
    setFuelLiters(log.fuelLiters ? String(log.fuelLiters) : "");
    setWorkVolume(log.workVolume ? String(log.workVolume) : "");
    setVolumeUnit(log.volumeUnit || "m");
    setWorkDescription(log.workDescription || "");
    setFormError(null);
    setDialogOpen(true);
  };

  // Mutation Create / Update
  const saveMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      if (isHmInvalid) {
        throw new Error("HM Akhir harus lebih besar atau sama dengan HM Awal");
      }
      if (!workVolume || parseFloat(workVolume) <= 0) {
        throw new Error("Volume kerja wajib diisi dan harus lebih dari 0");
      }
      if (!volumeUnit.trim()) {
        throw new Error("Satuan volume wajib dipilih");
      }

      const startNum = hmStart.trim() !== "" ? Number(hmStart) : null;
      const endNum = hmEnd.trim() !== "" ? Number(hmEnd) : null;

      const payload = {
        workPackageId: selectedWpId === "none" ? null : selectedWpId,
        logDate: new Date(logDate).toISOString(),
        unitCode: unitCode.trim(),
        equipmentType: equipmentType.trim(),
        ownership,
        hmStart: startNum,
        hmEnd: endNum,
        fuelLiters: fuelLiters ? Number(fuelLiters) : null,
        workVolume: Number(workVolume),
        volumeUnit: volumeUnit.trim(),
        workDescription: workDescription.trim() || null,
      };

      const url = editingLog
        ? `/api/projects/${projectId}/equipment/${editingLog.id}`
        : `/api/projects/${projectId}/equipment`;
      const method = editingLog ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan log alat berat");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-packages", projectId] });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Mutation Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${projectId}/equipment/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menghapus log alat berat");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment", projectId] });
      setDeletingId(null);
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  // Kolom TanStack Table
  const columns = useMemo<ColumnDef<EquipmentLogRow>[]>(
    () => [
      {
        accessorKey: "logDate",
        header: "Tanggal",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.logDate)}
          </span>
        ),
      },
      {
        accessorKey: "unitCode",
        header: "Kode Unit",
        cell: ({ row }) => (
          <span className="font-mono font-bold text-xs text-foreground">
            {row.original.unitCode}
          </span>
        ),
      },
      {
        accessorKey: "equipmentType",
        header: "Jenis Alat",
        cell: ({ row }) => (
          <span className="text-xs font-medium text-foreground">
            {row.original.equipmentType}
          </span>
        ),
      },
      {
        accessorKey: "ownership",
        header: "Kepemilikan",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.ownership === EquipmentOwnership.OWNED
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                : "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
            }
          >
            {row.original.ownership === EquipmentOwnership.OWNED ? "Milik Sendiri" : "Sewa / Rental"}
          </Badge>
        ),
      },
      {
        id: "volume",
        header: "Volume Kerja (Output)",
        cell: ({ row }) => (
          <span className="text-xs font-bold text-foreground">
            {row.original.workVolume !== null && row.original.workVolume !== undefined
              ? `${row.original.workVolume} ${row.original.volumeUnit || ""}`
              : "-"}
          </span>
        ),
      },
      {
        accessorKey: "hmHours",
        header: "Jam Kerja (HM)",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.hmHours > 0 ? (
              <span className="font-bold text-primary">{row.original.hmHours} Jam</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </span>
        ),
      },
      {
        id: "hmRange",
        header: "Rentang HM",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.hmStart > 0 || row.original.hmEnd > 0
              ? `${row.original.hmStart} – ${row.original.hmEnd}`
              : "-"}
          </span>
        ),
      },
      {
        accessorKey: "fuelLiters",
        header: "BBM (L)",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.fuelLiters !== null && row.original.fuelLiters !== undefined
              ? `${row.original.fuelLiters} L`
              : "-"}
          </span>
        ),
      },
      {
        id: "workPackage",
        header: "Paket Kerja",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[150px] inline-block">
            {row.original.workPackage?.packageName || "-"}
          </span>
        ),
      },
      {
        accessorKey: "workDescription",
        header: "Uraian Pekerjaan",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[180px] inline-block">
            {row.original.workDescription || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => {
          if (isCompleted) {
            return (
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Terkunci
                </span>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(row.original)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Edit Log Alat Berat"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingId(row.original.id)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                title="Hapus Log Alat Berat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [isCompleted]
  );

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      {/* Header & Tombol Tambah */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Log Operasional Alat Berat
          </h3>
          <p className="text-xs text-muted-foreground">
            Pencatatan jam kerja (Hour Meter), konsumsi BBM, dan volume pekerjaan alat berat di lapangan.
          </p>
        </div>

        {!isCompleted && (
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="h-8 text-xs shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Catat Log Alat Berat
          </Button>
        )}
      </div>

      {/* Tabel Data TanStack */}
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
      />

      {/* Dialog Form Tambah / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingLog ? "Edit Log Alat Berat" : "Catat Log Alat Berat Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pencatatan realisasi operasional unit alat berat berbasis output kerja harian.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-3.5 py-2 text-xs">
            {/* 1. Paket Kerja Terkait (Sebagai Acuan Output & Target) */}
            <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Paket Kerja Terkait (Referensi Rencana)
                </Label>
                {selectedWp && (
                  <Badge variant="outline" className="text-[10px] bg-background">
                    {selectedWp.category || "Paket"}
                  </Badge>
                )}
              </div>
              <Select value={selectedWpId} onValueChange={handleSelectWp}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Pilih Paket Kerja (Disarankan)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Tanpa Paket Spesifik (Umum) --</SelectItem>
                  {workPackages.map((wp) => {
                    const wpQty =
                      wp.targetQuantity !== null && wp.targetQuantity !== undefined
                        ? wp.targetQuantity
                        : wp.totalPlannedQty;
                    const wpUom =
                      wp.uom || wp.items?.[0]?.item?.uom?.code || "unit";
                    const wpRecordedVol = logs
                      .filter((l) => l.workPackageId === wp.id)
                      .reduce((sum, l) => sum + (Number(l.workVolume) || 0), 0);
                    const wpAchieved = Math.max(wpRecordedVol, wp.volumeAchieved || 0);
                    const wpRemaining = wpQty
                      ? Math.max(0, Math.round((wpQty - wpAchieved) * 100) / 100)
                      : null;
                    return (
                      <SelectItem key={wp.id} value={wp.id}>
                        {wp.packageName}{" "}
                        {wpQty
                          ? `(Realisasi: ${wpAchieved}/${wpQty} ${wpUom} · Sisa: ${wpRemaining} ${wpUom})`
                          : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Status Rencana vs Akumulasi Realisasi */}
              {wpStats && selectedWp && (
                <div className="rounded-md border border-primary/20 bg-background/90 p-2.5 space-y-2 mt-2">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-1.5 rounded bg-muted/40 border border-border/60">
                      <div className="text-[10px] text-muted-foreground font-medium">Rencana Target</div>
                      <div className="font-bold text-foreground">
                        {wpStats.target > 0 ? `${wpStats.target} ${wpStats.uom}` : "-"}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-muted/40 border border-border/60">
                      <div className="text-[10px] text-muted-foreground font-medium">Akumulasi Realisasi</div>
                      <div className="font-bold text-primary">
                        {wpStats.currentAchieved} {wpStats.uom}
                      </div>
                      {wpStats.recordedLogCount > 0 && (
                        <div className="text-[9px] text-muted-foreground font-normal">
                          ({wpStats.recordedLogCount} log alat)
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 rounded bg-muted/40 border border-border/60">
                      <div className="text-[10px] text-muted-foreground font-medium">Sisa Rencana</div>
                      <div className={cn("font-bold font-mono", wpStats.remaining !== null && wpStats.remaining <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {wpStats.remaining !== null ? (wpStats.remaining <= 0 ? "0 (Tuntas)" : `${wpStats.remaining} ${wpStats.uom}`) : "-"}
                      </div>
                    </div>
                  </div>

                  {parseFloat(workVolume) > 0 && wpStats.target > 0 && (
                    <div className="text-[11px] text-muted-foreground pt-1.5 flex items-center justify-between border-t border-border/60">
                      <span>Proyeksi setelah log ini:</span>
                      <span className="font-medium text-foreground">
                        Realisasi menjadi <strong>{wpStats.projectedAchieved} {wpStats.uom}</strong> (Sisa: <strong className="text-primary">{wpStats.projectedRemaining} {wpStats.uom}</strong>)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Informasi Unit & Jenis Alat */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kode Unit <span className="text-rose-500">*</span></Label>
                <Input
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  placeholder="Misal: EXC-01"
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Jenis Alat <span className="text-rose-500">*</span></Label>
                <Select value={equipmentType} onValueChange={setEquipmentType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih Jenis Alat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Excavator">Excavator</SelectItem>
                    <SelectItem value="Dump Truck">Dump Truck</SelectItem>
                    <SelectItem value="Bulldozer">Bulldozer</SelectItem>
                    <SelectItem value="Motor Grader">Motor Grader</SelectItem>
                    <SelectItem value="Vibro Roller">Vibro Roller</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 3. Kepemilikan & Tanggal Log */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kepemilikan</Label>
                <Select
                  value={ownership}
                  onValueChange={(v) => setOwnership(v as EquipmentOwnership)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EquipmentOwnership.OWNED}>Milik Sendiri (OWNED)</SelectItem>
                    <SelectItem value={EquipmentOwnership.RENTAL}>Sewa (RENTAL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tanggal Log <span className="text-rose-500">*</span></Label>
                <Input
                  type="date"
                  max={todayStr}
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* 4. Output Kerja (MANDATORY) & BBM */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">
                  Volume Kerja <span className="text-rose-500">*</span>
                </Label>
                <FormattedNumberInput
                  allowDecimals
                  maxDecimals={2}
                  value={workVolume}
                  onChange={(val) => setWorkVolume(val !== null ? String(val) : "")}
                  placeholder="Contoh: 50"
                  className="h-8 text-xs font-bold text-foreground bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-primary">
                  Satuan (Master) <span className="text-rose-500">*</span>
                </Label>
                <Select value={volumeUnit} onValueChange={setVolumeUnit}>
                  <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                    <SelectValue placeholder="Pilih Satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedWp?.uom && !uomList.some((u) => u.code.toLowerCase() === selectedWp.uom?.toLowerCase()) && (
                      <SelectItem value={selectedWp.uom}>
                        {selectedWp.uom} (Sesuai Paket)
                      </SelectItem>
                    )}
                    {uomList.map((u) => (
                      <SelectItem key={u.id} value={u.code}>
                        {u.code} ({u.name})
                      </SelectItem>
                    ))}
                    {uomList.length === 0 && (
                      <>
                        <SelectItem value="m">m (Meter)</SelectItem>
                        <SelectItem value="m3">m3 (Meter Kubik)</SelectItem>
                        <SelectItem value="ha">ha (Hektar)</SelectItem>
                        <SelectItem value="unit">unit</SelectItem>
                        <SelectItem value="jam">jam</SelectItem>
                        <SelectItem value="titik">titik</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">BBM Solar (Liter)</Label>
                <FormattedNumberInput
                  allowDecimals
                  maxDecimals={2}
                  value={fuelLiters}
                  onChange={(val) => setFuelLiters(val !== null ? String(val) : "")}
                  placeholder="Opsional"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* 5. Rentang HM (OPSIONAL) */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" />
                  Catatan Jam Kerja Alat (HM) — Opsional
                </span>
                {calculatedHours > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-background font-mono text-primary font-bold">
                    {calculatedHours} Jam
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">HM Awal</Label>
                  <FormattedNumberInput
                    allowDecimals
                    maxDecimals={2}
                    value={hmStart}
                    onChange={(val) => setHmStart(val !== null ? String(val) : "")}
                    placeholder="0.0"
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">HM Akhir</Label>
                  <FormattedNumberInput
                    allowDecimals
                    maxDecimals={2}
                    value={hmEnd}
                    onChange={(val) => setHmEnd(val !== null ? String(val) : "")}
                    placeholder="0.0"
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Total Jam</Label>
                  <div className="h-8 rounded-md bg-background border px-2.5 flex items-center font-mono font-bold text-xs text-primary">
                    {calculatedHours > 0 ? `${calculatedHours} Jam` : "-"}
                  </div>
                </div>
              </div>

              {isHmInvalid && (
                <p className="text-[11px] text-rose-500 font-medium pt-1">
                  HM Akhir harus lebih besar atau sama dengan HM Awal.
                </p>
              )}
            </div>

            {/* 6. Uraian Pekerjaan */}
            <div className="space-y-1">
              <Label className="text-xs">Keterangan / Lokasi Pekerjaan</Label>
              <Textarea
                rows={2}
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Misal: Peninggian tanggul saluran inlet blok A01..."
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                isHmInvalid ||
                !unitCode.trim() ||
                !workVolume ||
                parseFloat(workVolume) <= 0 ||
                !volumeUnit.trim()
              }
              className="h-8 text-xs font-medium"
            >
              {saveMutation.isPending ? "Menyimpan..." : "Simpan Log Alat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog Hapus */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-rose-600">
              Hapus Log Alat Berat?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Log alat berat ini akan dihapus dari sistem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingId(null)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              className="h-8 text-xs"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
