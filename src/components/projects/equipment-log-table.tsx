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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { EquipmentOwnership } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  Edit,
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

interface EquipmentLogTableProps {
  projectId: string;
  isCompleted: boolean;
  logs: EquipmentLogRow[];
  workPackages: Array<{ id: string; packageName: string }>;
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
  const [volumeUnit, setVolumeUnit] = useState<string>("m3");
  const [workDescription, setWorkDescription] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Perhitungan preview jam kerja di client
  const calculatedHours = useMemo(() => {
    const start = parseFloat(hmStart);
    const end = parseFloat(hmEnd);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return Math.round((end - start) * 100) / 100;
    }
    return 0;
  }, [hmStart, hmEnd]);

  const isHmInvalid = useMemo(() => {
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
    setVolumeUnit("m3");
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
    setHmStart(String(log.hmStart));
    setHmEnd(String(log.hmEnd));
    setFuelLiters(log.fuelLiters ? String(log.fuelLiters) : "");
    setWorkVolume(log.workVolume ? String(log.workVolume) : "");
    setVolumeUnit(log.volumeUnit || "m3");
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

      const payload = {
        workPackageId: selectedWpId === "none" ? null : selectedWpId,
        logDate: new Date(logDate).toISOString(),
        unitCode: unitCode.trim(),
        equipmentType: equipmentType.trim(),
        ownership,
        hmStart: Number(hmStart),
        hmEnd: Number(hmEnd),
        fuelLiters: fuelLiters ? Number(fuelLiters) : null,
        workVolume: workVolume ? Number(workVolume) : null,
        volumeUnit: volumeUnit.trim() || null,
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
        id: "hmRange",
        header: "Rentang HM",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.hmStart} – {row.original.hmEnd}
          </span>
        ),
      },
      {
        accessorKey: "hmHours",
        header: "Jam Kerja (HM)",
        cell: ({ row }) => (
          <span className="font-mono font-bold text-xs text-primary">
            {row.original.hmHours} Jam
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
        id: "volume",
        header: "Volume Kerja",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.workVolume !== null && row.original.workVolume !== undefined
              ? `${row.original.workVolume} ${row.original.volumeUnit || ""}`
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
              HM Hours dihitung otomatis oleh server berdasarkan HM Awal dan HM Akhir.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kode Unit <span className="text-rose-500">*</span></Label>
                <Input
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  placeholder="Misal: EXC-01"
                  className="h-8 text-xs font-mono"
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

            {/* Rentang HM */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs">HM Awal <span className="text-rose-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={hmStart}
                  onChange={(e) => setHmStart(e.target.value)}
                  placeholder="0.0"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">HM Akhir <span className="text-rose-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={hmEnd}
                  onChange={(e) => setHmEnd(e.target.value)}
                  placeholder="0.0"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Kalkulasi Jam</Label>
                <div className="h-8 rounded-md bg-card border px-2.5 flex items-center font-mono font-bold text-xs text-primary">
                  {calculatedHours} Jam
                </div>
              </div>
            </div>

            {isHmInvalid && (
              <p className="text-[11px] text-rose-500 font-medium">
                HM Akhir harus lebih besar atau sama dengan HM Awal.
              </p>
            )}

            {/* BBM & Volume */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Konsumsi BBM (Liter)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={fuelLiters}
                  onChange={(e) => setFuelLiters(e.target.value)}
                  placeholder="Liter"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Volume Kerja</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={workVolume}
                  onChange={(e) => setWorkVolume(e.target.value)}
                  placeholder="Volume"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Satuan Volume</Label>
                <Input
                  value={volumeUnit}
                  onChange={(e) => setVolumeUnit(e.target.value)}
                  placeholder="m3"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Paket Kerja Terkait */}
            <div className="space-y-1">
              <Label className="text-xs">Paket Kerja Terkait (Opsional)</Label>
              <Select value={selectedWpId} onValueChange={setSelectedWpId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Pilih Paket Kerja (Opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Tanpa Paket Spesifik --</SelectItem>
                  {workPackages.map((wp) => (
                    <SelectItem key={wp.id} value={wp.id}>
                      {wp.packageName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Keterangan / Lokasi Pekerjaan</Label>
              <Textarea
                rows={2}
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Misal: Galian saluran inlet blok A01..."
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
              disabled={saveMutation.isPending || isHmInvalid || !unitCode.trim()}
              className="h-8 text-xs"
            >
              {saveMutation.isPending ? "Menyimpan..." : "Simpan Log"}
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
