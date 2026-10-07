"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate } from "@/lib/utils";
import { PackageCategory } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Camera,
  CloudRain,
  Edit,
  History,
  Lock,
  Plus,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";

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

interface WorkPackageProgressCardProps {
  workPackage: WorkPackageData;
  projectId: string;
  currentWeek: number;
  isCompleted: boolean;
  logs: ProgressLogRow[];
  onMutated?: () => void;
}

export function WorkPackageProgressCard({
  workPackage,
  projectId,
  currentWeek,
  isCompleted,
  logs,
  onMutated,
}: WorkPackageProgressCardProps) {
  const queryClient = useQueryClient();

  // Filter logs khusus untuk paket kerja ini
  const packageLogs = useMemo(() => {
    return logs
      .filter((l) => l.workPackageId === workPackage.id)
      .sort((a, b) => b.weekNo - a.weekNo);
  }, [logs, workPackage.id]);

  // Cari apakah log untuk minggu berjalan sudah ada
  const currentWeekLog = useMemo(() => {
    return packageLogs.find((l) => l.weekNo === currentWeek);
  }, [packageLogs, currentWeek]);

  // Form state input baru
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [progressPct, setProgressPct] = useState<string>(
    currentWeekLog ? String(currentWeekLog.progressPct) : String(workPackage.progressPct || 0)
  );
  const [volumeAchieved, setVolumeAchieved] = useState<string>(
    workPackage.volumeAchieved ? String(workPackage.volumeAchieved) : ""
  );
  const [volumeUnit, setVolumeUnit] = useState<string>(workPackage.uom || "");
  const [logDate, setLogDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [weatherCondition, setWeatherCondition] = useState<string>("Cerah");
  const [waterLevelCm, setWaterLevelCm] = useState<string>("");
  const [workDescription, setWorkDescription] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Edit dialog state
  const [editingLog, setEditingLog] = useState<ProgressLogRow | null>(null);
  const [editProgressPct, setEditProgressPct] = useState<string>("");
  const [editVolumeAchieved, setEditVolumeAchieved] = useState<string>("");
  const [editVolumeUnit, setEditVolumeUnit] = useState<string>("");
  const [editLogDate, setEditLogDate] = useState<string>("");
  const [editWeather, setEditWeather] = useState<string>("Cerah");
  const [editWaterLevel, setEditWaterLevel] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editNewPhotoUrl, setEditNewPhotoUrl] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog state
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  // Cek apakah minggu yang dipilih di form sudah ada log-nya
  const isSelectedWeekExisting = useMemo(() => {
    return packageLogs.some((l) => l.weekNo === selectedWeek);
  }, [packageLogs, selectedWeek]);

  // Tambah link foto
  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    setPhotos([...photos, newPhotoUrl.trim()]);
    setNewPhotoUrl("");
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  // Tambah link foto pada dialog edit
  const handleAddEditPhoto = () => {
    if (!editNewPhotoUrl.trim()) return;
    setEditPhotos([...editPhotos, editNewPhotoUrl.trim()]);
    setEditNewPhotoUrl("");
  };

  const handleRemoveEditPhoto = (index: number) => {
    setEditPhotos(editPhotos.filter((_, i) => i !== index));
  };

  // Mutation: Simpan Log Baru
  const createMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      const res = await fetch(`/api/projects/${projectId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workPackageId: workPackage.id,
          weekNo: Number(selectedWeek),
          logDate: new Date(logDate).toISOString(),
          progressPct: Number(progressPct),
          volumeAchieved: volumeAchieved ? Number(volumeAchieved) : null,
          volumeUnit: volumeUnit || null,
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
            volumeUnit: editVolumeUnit || null,
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
    setEditVolumeUnit(log.volumeUnit || workPackage.uom || "");
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
              {selectedWeek === currentWeek && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] font-medium">
                  Minggu Berjalan (Ke-{currentWeek})
                </Badge>
              )}
            </div>

            {formError && (
              <div className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {isSelectedWeekExisting && (
              <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-2 border border-amber-200 dark:border-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Log minggu ke-{selectedWeek} sudah pernah dicatat. Gunakan tombol{" "}
                  <strong>Edit</strong> pada riwayat di bawah jika ingin mengoreksi.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <Label htmlFor={`week-${workPackage.id}`} className="text-xs">
                  Nomor Minggu
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`week-${workPackage.id}`}
                    type="number"
                    min={1}
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                  {selectedWeek === currentWeek && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Aktif
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`pct-${workPackage.id}`} className="text-xs">
                  Progres (%) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id={`pct-${workPackage.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progressPct}
                  onChange={(e) => setProgressPct(e.target.value)}
                  placeholder="0 - 100"
                  className="h-8 text-xs font-mono font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor={`vol-${workPackage.id}`} className="text-xs">
                  Volume Tercapai
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id={`vol-${workPackage.id}`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={volumeAchieved}
                    onChange={(e) => setVolumeAchieved(e.target.value)}
                    placeholder="Volume"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={volumeUnit}
                    onChange={(e) => setVolumeUnit(e.target.value)}
                    placeholder="Satuan"
                    className="h-8 w-20 text-xs shrink-0"
                  />
                </div>
              </div>

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
                  className="h-8 text-xs"
                />
              </div>
            </div>

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

            {/* Foto URL Input */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <Label className="text-xs flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                Foto Dokumentasi Lapangan (URL)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="https://... (URL foto dokumentasi)"
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPhoto}
                  className="h-8 text-xs shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Tambah URL
                </Button>
              </div>

              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-md border text-foreground"
                    >
                      <span className="truncate max-w-[200px]">{url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="text-muted-foreground hover:text-rose-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || isSelectedWeekExisting}
                className="h-8 text-xs"
              >
                {createMutation.isPending ? "Menyimpan..." : `Simpan Progres Minggu ke-${selectedWeek}`}
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
                            <span className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded border">
                              {log.photos.length} Foto
                            </span>
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
                  onChange={(e) => setEditVolumeAchieved(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Satuan</Label>
                <Input
                  value={editVolumeUnit}
                  onChange={(e) => setEditVolumeUnit(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

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
              <Label className="text-xs">URL Foto Dokumentasi</Label>
              <div className="flex gap-2">
                <Input
                  value={editNewPhotoUrl}
                  onChange={(e) => setEditNewPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddEditPhoto}
                  className="h-8 text-xs"
                >
                  Tambah
                </Button>
              </div>
              {editPhotos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {editPhotos.map((url, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 text-[10px] bg-muted px-2 py-0.5 rounded border"
                    >
                      <span className="truncate max-w-[180px]">{url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditPhoto(idx)}
                        className="text-muted-foreground hover:text-rose-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
