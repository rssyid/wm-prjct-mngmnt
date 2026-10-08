"use client";
/* eslint-disable @next/next/no-img-element */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiImageUpload } from "@/components/ui/multi-image-upload";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import { toProxyUrl } from "@/lib/r2-url";
import { PackageCategory } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  CloudRain,
  Edit,
  History,
  Lock,
  Sparkles,
  Trash2,
  Truck,
  Waves,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { EquipmentLogRow } from "@/components/projects/equipment-log-table";

export interface ProgressLogRow {
  id: string;
  projectId: string;
  workPackageId: string;
  logDate: string;
  weekNo: number;
  progressPct: number;
  volumeAchieved?: number | null;
  volumeUnit?: string | null;
  workDescription?: string | null;
  weatherCondition?: string | null;
  waterLevelCm?: number | null;
  photos?: string[] | null;
  createdBy?: { id: string; name: string; email: string } | null;
}

export interface WorkPackageData {
  id: string;
  packageName: string;
  category: PackageCategory;
  weightPct: number;
  progressPct: number;
  targetQuantity?: number | null;
  uom?: string | null;
  volumeAchieved?: number | null;
}

export interface WorkPackageProgressCardProps {
  workPackage: WorkPackageData;
  projectId: string;
  currentWeek: number;
  isCompleted: boolean;
  logs: ProgressLogRow[];
  projectDates?: {
    constructionPlanStartDate?: string | Date | null;
    targetStartDate?: string | Date | null;
    createdAt?: string | Date;
  };
  equipmentLogs?: EquipmentLogRow[];
  onMutated?: () => void;
}

export function WorkPackageProgressCard({
  workPackage,
  projectId,
  currentWeek,
  isCompleted,
  logs,
  projectDates,
  equipmentLogs,
  onMutated,
}: WorkPackageProgressCardProps) {
  const queryClient = useQueryClient();

  // Filter logs khusus untuk paket kerja ini
  const packageLogs = useMemo(() => {
    return logs
      .filter((l) => l.workPackageId === workPackage.id)
      .sort((a, b) => b.weekNo - a.weekNo);
  }, [logs, workPackage.id]);

  // Form state tanggal log (input utama pengguna)
  const [logDate, setLogDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Hitung nomor minggu secara dinamis dari logDate yang dipilih
  const computedWeekNo = useMemo(() => {
    if (!logDate) return currentWeek;
    const startDateRaw =
      projectDates?.constructionPlanStartDate ??
      projectDates?.targetStartDate ??
      projectDates?.createdAt;

    if (!startDateRaw) return currentWeek;

    const startDate = new Date(startDateRaw);
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const chosen = new Date(logDate);
    const ref = new Date(chosen.getFullYear(), chosen.getMonth(), chosen.getDate());

    const diffMs = ref.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 1;
    return Math.floor(diffDays / 7) + 1;
  }, [logDate, projectDates, currentWeek]);

  // Cek apakah log untuk minggu hasil kalkulasi tanggal tersebut sudah ada
  const existingLogForComputedWeek = useMemo(() => {
    return packageLogs.find((l) => l.weekNo === computedWeekNo);
  }, [packageLogs, computedWeekNo]);

  // Form state input progres
  const [progressPct, setProgressPct] = useState<string>(
    String(workPackage.progressPct || 0)
  );
  const [volumeAchieved, setVolumeAchieved] = useState<string>(
    workPackage.volumeAchieved ? String(workPackage.volumeAchieved) : ""
  );
  const [weatherCondition, setWeatherCondition] = useState<string>("Cerah");
  const [waterLevelCm, setWaterLevelCm] = useState<string>("");
  const [workDescription, setWorkDescription] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Target volume & Burn-down stats (misal target 500m)
  const targetQty = workPackage.targetQuantity;
  const uomLabel = workPackage.uom || "unit";
  const numVol = parseFloat(volumeAchieved) || 0;
  const remainingVol = targetQty ? Math.max(0, Math.round((targetQty - numVol) * 100) / 100) : null;
  const isTargetFinished = targetQty ? numVol >= targetQty : false;

  // Auto-hitung persentase progres saat volume berubah jika targetQuantity tersedia
  const handleVolumeChange = (val: string) => {
    setVolumeAchieved(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && targetQty && targetQty > 0) {
      const calc = Math.min(100, Math.max(0, Math.round((parsed / targetQty) * 1000) / 10));
      setProgressPct(String(calc));
    }
  };

  // Ringkasan Penggunaan Alat Berat untuk Paket Kerja ini
  const packageEquipment = useMemo(() => {
    if (!equipmentLogs || equipmentLogs.length === 0) return [];
    return equipmentLogs.filter((el) => el.workPackageId === workPackage.id);
  }, [equipmentLogs, workPackage.id]);

  const equipmentStats = useMemo(() => {
    if (!packageEquipment.length) return null;
    const totalHmHours = packageEquipment.reduce((acc, el) => acc + (el.hmHours || 0), 0);
    const totalFuel = packageEquipment.reduce((acc, el) => acc + (el.fuelLiters || 0), 0);
    const totalWorkVolume = packageEquipment.reduce((acc, el) => acc + (el.workVolume || 0), 0);
    const uniqueUnits = Array.from(new Set(packageEquipment.map((el) => el.unitCode)));
    const productivity = totalHmHours > 0
      ? Math.round(((workPackage.volumeAchieved || totalWorkVolume) / totalHmHours) * 10) / 10
      : null;

    return {
      totalHmHours: Math.round(totalHmHours * 10) / 10,
      totalFuel: Math.round(totalFuel * 10) / 10,
      totalWorkVolume: Math.round(totalWorkVolume * 10) / 10,
      uniqueUnits,
      count: packageEquipment.length,
      productivity,
    };
  }, [packageEquipment, workPackage.volumeAchieved]);

  // Edit dialog state
  const [editingLog, setEditingLog] = useState<ProgressLogRow | null>(null);
  const [editProgressPct, setEditProgressPct] = useState<string>("");
  const [editVolumeAchieved, setEditVolumeAchieved] = useState<string>("");
  const [editLogDate, setEditLogDate] = useState<string>("");
  const [editWeather, setEditWeather] = useState<string>("Cerah");
  const [editWaterLevel, setEditWaterLevel] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog state
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  // Mutation: Simpan Log Baru
  const createMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const res = await fetch(`/api/projects/${projectId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workPackageId: workPackage.id,
          weekNo: computedWeekNo,
          logDate: new Date(logDate).toISOString(),
          progressPct: Number(progressPct),
          volumeAchieved: volumeAchieved ? Number(volumeAchieved) : null,
          volumeUnit: workPackage.uom || null,
          workDescription: workDescription || null,
          weatherCondition: weatherCondition || null,
          waterLevelCm: waterLevelCm ? Number(waterLevelCm) : null,
          photos: photos.length > 0 ? photos : [],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan log progres");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-progress", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-packages", projectId] });
      setWorkDescription("");
      setPhotos([]);
      setFormError(null);
      onMutated?.();
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Mutation: Update Log (hanya minggu berjalan)
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingLog) return;
      setEditError(null);
      const res = await fetch(
        `/api/projects/${projectId}/progress/${editingLog.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logDate: editLogDate ? new Date(editLogDate).toISOString() : undefined,
            progressPct: Number(editProgressPct),
            volumeAchieved: editVolumeAchieved ? Number(editVolumeAchieved) : null,
            volumeUnit: workPackage.uom || null,
            workDescription: editDescription || null,
            weatherCondition: editWeather || null,
            waterLevelCm: editWaterLevel ? Number(editWaterLevel) : null,
            photos: editPhotos,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memperbarui log progres");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-progress", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-packages", projectId] });
      setEditingLog(null);
      setEditError(null);
      onMutated?.();
    },
    onError: (err: Error) => {
      setEditError(err.message);
    },
  });

  // Mutation: Hapus Log (hanya minggu berjalan)
  const deleteMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/progress/${logId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menghapus log progres");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-progress", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-packages", projectId] });
      setDeletingLogId(null);
      onMutated?.();
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  const openEditModal = (log: ProgressLogRow) => {
    setEditingLog(log);
    setEditProgressPct(String(log.progressPct));
    setEditVolumeAchieved(log.volumeAchieved ? String(log.volumeAchieved) : "");
    setEditLogDate(
      log.logDate
        ? new Date(log.logDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setEditWeather(log.weatherCondition || "Cerah");
    setEditWaterLevel(log.waterLevelCm ? String(log.waterLevelCm) : "");
    setEditDescription(log.workDescription || "");
    setEditPhotos(Array.isArray(log.photos) ? log.photos : []);
    setEditError(null);
  };

  const handleEditVolumeChange = (val: string) => {
    setEditVolumeAchieved(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && targetQty && targetQty > 0) {
      const calc = Math.min(100, Math.max(0, Math.round((parsed / targetQty) * 1000) / 10));
      setEditProgressPct(String(calc));
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <Card className="border-border shadow-xs overflow-hidden">
      {/* Header Kartu Paket */}
      <CardHeader className="bg-muted/30 pb-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-foreground">
                {workPackage.packageName}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {workPackage.category}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Bobot Paket:{" "}
              <span className="font-semibold text-foreground">
                {workPackage.weightPct}%
              </span>
              {workPackage.targetQuantity && (
                <>
                  {" "}
                  • Target Volume:{" "}
                  <span className="font-semibold text-foreground">
                    {workPackage.targetQuantity} {workPackage.uom || "unit"}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-card px-3 py-2 rounded-lg border border-border">
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                Progres Paket
              </div>
              <div className="text-lg font-bold font-mono text-primary">
                {workPackage.progressPct}%
              </div>
            </div>
            <div className="w-24 bg-muted h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, workPackage.progressPct))}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* Ringkasan Kontrol Alat Berat & Produktivitas (Khusus paket HEAVY_EQUIPMENT atau jika ada log alat terkait) */}
        {(workPackage.category === PackageCategory.HEAVY_EQUIPMENT || packageEquipment.length > 0) && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-primary">
              <div className="flex items-center gap-1.5">
                <Truck className="h-4 w-4" />
                <span>Kontrol Alat Berat & Produktivitas Paket</span>
              </div>
              {equipmentStats ? (
                <Badge variant="outline" className="text-[10px] bg-background">
                  {equipmentStats.count} Catatan Harian
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground">
                  Belum Ada Log Alat
                </Badge>
              )}
            </div>

            {equipmentStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="bg-background/90 p-2.5 rounded-md border border-border/70">
                  <div className="text-[10px] text-muted-foreground font-medium">Unit Alat</div>
                  <div className="font-semibold text-foreground truncate" title={equipmentStats.uniqueUnits.join(", ")}>
                    {equipmentStats.uniqueUnits.join(", ") || "-"}
                  </div>
                </div>
                <div className="bg-background/90 p-2.5 rounded-md border border-border/70">
                  <div className="text-[10px] text-muted-foreground font-medium">Total Jam Kerja (HM)</div>
                  <div className="font-mono font-bold text-foreground">
                    {equipmentStats.totalHmHours} jam
                  </div>
                </div>
                <div className="bg-background/90 p-2.5 rounded-md border border-border/70">
                  <div className="text-[10px] text-muted-foreground font-medium">Konsumsi Solar</div>
                  <div className="font-mono font-bold text-foreground">
                    {equipmentStats.totalFuel} Liter
                  </div>
                </div>
                <div className="bg-background/90 p-2.5 rounded-md border border-border/70">
                  <div className="text-[10px] text-muted-foreground font-medium">Produktivitas Alat</div>
                  <div className="font-mono font-bold text-primary">
                    {equipmentStats.productivity !== null ? `${equipmentStats.productivity} ${uomLabel}/jam` : "-"}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Pekerjaan ini dialokasikan untuk alat berat. Mandor/operator dapat mencatat jam operasional (HM) dan solar di sub-tab <strong>Log Alat Berat</strong> dengan menautkan ke paket ini.
              </p>
            )}
          </div>
        )}

        {/* Form Input Progres Mingguan */}
        {!isCompleted ? (
          <div className="rounded-lg border border-border p-4 bg-muted/10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-semibold text-foreground">
                  Input Log Progres Mingguan
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Minggu Target:</span>
                <Badge className={cn("text-[11px] font-medium", computedWeekNo === currentWeek ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground")}>
                  Minggu ke-{computedWeekNo} {computedWeekNo === currentWeek ? "(Berjalan)" : "(Dinamis)"}
                </Badge>
              </div>
            </div>

            {formError && (
              <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {existingLogForComputedWeek && (
              <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-amber-200 dark:border-amber-900">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Log progres untuk <strong>Minggu ke-{computedWeekNo}</strong> sudah pernah dicatat ({existingLogForComputedWeek.progressPct}% pada {formatDate(existingLogForComputedWeek.logDate)}).
                  </span>
                </div>
                {computedWeekNo === currentWeek && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(existingLogForComputedWeek)}
                    className="h-7 text-xs bg-card hover:bg-muted shrink-0 self-end sm:self-auto"
                  >
                    <Edit className="h-3 w-3 mr-1" /> Koreksi Log
                  </Button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* 1. Tanggal Log (Input Pemicu Utama) */}
              <div className="space-y-1">
                <Label htmlFor={`date-${workPackage.id}`} className="text-xs">
                  Tanggal Log <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id={`date-${workPackage.id}`}
                  type="date"
                  max={todayStr}
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="h-8 text-xs font-medium"
                />
              </div>

              {/* 2. Nomor Minggu (Otomatis Dihitung dari Tanggal) */}
              <div className="space-y-1">
                <Label className="text-xs">Nomor Minggu (Dinamis)</Label>
                <div className="h-8 px-2.5 bg-muted/60 border border-border rounded-md flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-foreground">
                    Minggu ke-{computedWeekNo}
                  </span>
                  {computedWeekNo === currentWeek ? (
                    <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20 shrink-0">
                      Aktif
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Otomatis
                    </span>
                  )}
                </div>
              </div>

              {/* 3. Volume Tercapai (Dengan Satuan Terkunci Mengikuti Master / Paket) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`vol-${workPackage.id}`} className="text-xs">
                    Volume Tercapai
                  </Label>
                  {targetQty && targetQty > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Target: {targetQty} {uomLabel}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Input
                    id={`vol-${workPackage.id}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={volumeAchieved}
                    onChange={(e) => handleVolumeChange(e.target.value)}
                    placeholder="Contoh: 250"
                    className="h-8 text-xs font-semibold"
                  />
                  <div
                    title="Satuan mengikuti master paket kerja"
                    className="h-8 px-2.5 bg-muted border border-border rounded-md flex items-center justify-center text-xs font-semibold text-foreground shrink-0 min-w-14"
                  >
                    {uomLabel}
                  </div>
                </div>

                {equipmentStats && equipmentStats.totalWorkVolume > 0 && (
                  <div className="flex items-center justify-between p-1.5 rounded bg-primary/5 border border-primary/20 text-xs mt-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Alat Berat: <strong className="text-foreground">{equipmentStats.totalWorkVolume} {uomLabel}</strong></span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVolumeChange(String(equipmentStats.totalWorkVolume))}
                      className="h-6 text-[10px] px-2 font-medium text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      Gunakan Realisasi Alat
                    </Button>
                  </div>
                )}
              </div>

              {/* 4. Progres Kumulatif (%) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`pct-${workPackage.id}`} className="text-xs">
                    Progres Kumulatif (%) <span className="text-rose-500">*</span>
                  </Label>
                  {targetQty && targetQty > 0 && (
                    <span className="text-[10px] text-primary flex items-center gap-0.5">
                      <Sparkles className="h-3 w-3" /> Auto
                    </span>
                  )}
                </div>
                <Input
                  id={`pct-${workPackage.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progressPct}
                  onChange={(e) => setProgressPct(e.target.value)}
                  placeholder="0 - 100"
                  className="h-8 text-xs font-mono font-bold text-primary"
                />
              </div>
            </div>

            {/* Target Burn-Down Indicator (Misal kasus Tanggul 500m) */}
            {targetQty && targetQty > 0 && (
              <div className="rounded-md bg-muted/40 p-2.5 border border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Realisasi Target:</span>
                  <strong className="text-foreground">{numVol}</strong> / <strong>{targetQty} {uomLabel}</strong>
                  <span className="text-[11px] font-mono text-primary">({Number(progressPct || 0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  {isTargetFinished ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Target Terpenuhi / Habis (100%)
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">
                      Sisa target: <strong className="text-foreground font-mono">{remainingVol} {uomLabel}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Cuaca & Muka Air */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Kondisi Cuaca</Label>
                <Select value={weatherCondition} onValueChange={setWeatherCondition}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Pilih Cuaca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cerah">Cerah</SelectItem>
                    <SelectItem value="Berawan">Berawan</SelectItem>
                    <SelectItem value="Hujan Ringan">Hujan Ringan</SelectItem>
                    <SelectItem value="Hujan Lebat">Hujan Lebat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`water-${workPackage.id}`} className="text-xs">
                  Tinggi Muka Air (cm)
                </Label>
                <Input
                  id={`water-${workPackage.id}`}
                  type="number"
                  step={1}
                  value={waterLevelCm}
                  onChange={(e) => setWaterLevelCm(e.target.value)}
                  placeholder="Contoh: 45"
                  className="h-8 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor={`desc-${workPackage.id}`} className="text-xs">
                  Uraian Pekerjaan Mingguan
                </Label>
                <Input
                  id={`desc-${workPackage.id}`}
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="Catatan kemajuan pekerjaan di lapangan..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Foto Upload R2 */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <Label className="text-xs flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                Foto Dokumentasi Lapangan (Upload R2)
              </Label>
              <MultiImageUpload
                values={photos}
                onChange={setPhotos}
                folder="progress"
                disabled={createMutation.isPending || !!existingLogForComputedWeek}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !!existingLogForComputedWeek}
                className="h-8 text-xs font-medium"
              >
                {createMutation.isPending ? "Menyimpan..." : `Simpan Progres Minggu ke-${computedWeekNo}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2 border">
            <Lock className="h-4 w-4" />
            <span>Proyek telah COMPLETED. Pencatatan log progres terkunci (read-only).</span>
          </div>
        )}

        {/* Tabel Riwayat Log Mingguan */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-foreground">
              Riwayat Log Progres Mingguan
            </h4>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-24 text-xs font-semibold py-2">Minggu</TableHead>
                  <TableHead className="text-xs font-semibold py-2">Tanggal</TableHead>
                  <TableHead className="text-xs font-semibold py-2">Progres</TableHead>
                  <TableHead className="text-xs font-semibold py-2">Volume</TableHead>
                  <TableHead className="text-xs font-semibold py-2">Cuaca & Air</TableHead>
                  <TableHead className="text-xs font-semibold py-2">Foto</TableHead>
                  <TableHead className="text-xs font-semibold py-2">Oleh</TableHead>
                  <TableHead className="text-xs font-semibold text-right py-2">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packageLogs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-6 text-xs text-muted-foreground"
                    >
                      Belum ada log progres mingguan untuk paket kerja ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  packageLogs.map((log) => {
                    const isCurrentWeek = log.weekNo === currentWeek;
                    const canEdit = isCurrentWeek && !isCompleted;

                    return (
                      <TableRow
                        key={log.id}
                        className={
                          isCurrentWeek
                            ? "bg-primary/5 hover:bg-primary/10 transition-colors font-medium"
                            : "hover:bg-muted/30 transition-colors"
                        }
                      >
                        <TableCell className="py-2.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold">Ke-{log.weekNo}</span>
                            {isCurrentWeek && (
                              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0 h-4">
                                Berjalan
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          {formatDate(log.logDate)}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs">
                          <span className="font-mono font-bold text-foreground">
                            {log.progressPct}%
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs">
                          {log.volumeAchieved !== null && log.volumeAchieved !== undefined
                            ? `${log.volumeAchieved} ${log.volumeUnit || ""}`
                            : "-"}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          <div className="flex flex-col gap-0.5">
                            {log.weatherCondition && (
                              <span className="flex items-center gap-1">
                                <CloudRain className="h-3 w-3" />
                                {log.weatherCondition}
                              </span>
                            )}
                            {log.waterLevelCm !== null && log.waterLevelCm !== undefined && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <Waves className="h-3 w-3" />
                                {log.waterLevelCm} cm
                              </span>
                            )}
                            {!log.weatherCondition && log.waterLevelCm === null && "-"}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs">
                          {Array.isArray(log.photos) && log.photos.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {log.photos.slice(0, 3).map((photoUrl, pIdx) => (
                                <a
                                  key={pIdx}
                                  href={toProxyUrl(photoUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Buka foto dokumentasi"
                                  className="block h-7 w-7 rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary/50 transition-all shrink-0 bg-muted/30"
                                >
                                  {/* Native img tag - TANPA next/image optimizer sesuai aturan STACK.md §4 */}
                                  <img
                                    src={toProxyUrl(photoUrl)}
                                    alt={`Foto ${pIdx + 1}`}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                              {log.photos.length > 3 && (
                                <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded border">
                                  +{log.photos.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          {log.createdBy?.name || "-"}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-right">
                          {canEdit ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(log)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="Edit log minggu berjalan"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingLogId(log.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                                title="Hapus log minggu berjalan"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="text-[11px] text-muted-foreground inline-flex items-center gap-1"
                              title="Log minggu lampau tidak dapat diubah (Aturan B6)"
                            >
                              <Lock className="h-3 w-3" />
                              Terkunci
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>

      {/* Dialog Edit Log Minggu Berjalan */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Koreksi Log Progres Minggu ke-{editingLog?.weekNo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Hanya log pada minggu berjalan yang dapat diperbarui sesuai aturan B6.
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Progres Kumulatif (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={editProgressPct}
                  onChange={(e) => setEditProgressPct(e.target.value)}
                  className="h-8 text-xs font-mono font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tanggal Log</Label>
                <Input
                  type="date"
                  max={todayStr}
                  value={editLogDate}
                  onChange={(e) => setEditLogDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Volume Tercapai</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editVolumeAchieved}
                  onChange={(e) => handleEditVolumeChange(e.target.value)}
                  className="h-8 text-xs font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Satuan (Master)</Label>
                <div className="h-8 px-2.5 bg-muted border border-border rounded-md flex items-center justify-center text-xs font-semibold text-foreground">
                  {uomLabel}
                </div>
              </div>
            </div>

            {equipmentStats && equipmentStats.totalWorkVolume > 0 && (
              <div className="flex items-center justify-between p-1.5 rounded bg-primary/5 border border-primary/20 text-xs">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Alat Berat: <strong className="text-foreground">{equipmentStats.totalWorkVolume} {uomLabel}</strong></span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditVolumeChange(String(equipmentStats.totalWorkVolume))}
                  className="h-6 text-[10px] px-2 font-medium text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Gunakan Realisasi Alat
                </Button>
              </div>
            )}

            {targetQty && targetQty > 0 && (
              <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground flex items-center justify-between border border-border/60">
                <span>
                  Target: <strong>{targetQty} {uomLabel}</strong> • Tercapai: <strong>{editVolumeAchieved || 0}</strong>
                </span>
                <span className="text-primary font-mono font-bold">
                  {editProgressPct || 0}%
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kondisi Cuaca</Label>
                <Select value={editWeather} onValueChange={setEditWeather}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cerah">Cerah</SelectItem>
                    <SelectItem value="Berawan">Berawan</SelectItem>
                    <SelectItem value="Hujan Ringan">Hujan Ringan</SelectItem>
                    <SelectItem value="Hujan Lebat">Hujan Lebat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tinggi Air (cm)</Label>
                <Input
                  type="number"
                  value={editWaterLevel}
                  onChange={(e) => setEditWaterLevel(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Catatan Pekerjaan</Label>
              <Textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5 pt-1 border-t">
              <Label className="text-xs">Foto Dokumentasi Lapangan (Upload R2)</Label>
              <MultiImageUpload
                values={editPhotos}
                onChange={setEditPhotos}
                folder="progress"
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingLog(null)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="h-8 text-xs"
            >
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog Hapus Log */}
      <Dialog open={!!deletingLogId} onOpenChange={(open) => !open && setDeletingLogId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-rose-600">
              Hapus Log Progres Mingguan?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Log minggu berjalan ini akan dihapus permanen. Progres paket kerja dan progres total proyek akan otomatis dihitung ulang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingLogId(null)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingLogId && deleteMutation.mutate(deletingLogId)}
              disabled={deleteMutation.isPending}
              className="h-8 text-xs"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
