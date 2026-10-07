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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ProjectStatus, Role } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Lock,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface BastResponse {
  id: string;
  projectId: string;
  bastNumber: string;
  bastDate: string;
  hoInspectorName: string | null;
  contractorRepName: string | null;
  notes: string | null;
  bastFileUrl: string;
  verifiedById: string | null;
  verifiedAt: string | null;
  verifiedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface BastTabProps {
  projectId: string;
  projectStatus: ProjectStatus;
  userRole?: string;
  onProjectUpdated?: () => void;
}

export function BastTab({
  projectId,
  projectStatus,
  userRole,
  onProjectUpdated,
}: BastTabProps) {
  const queryClient = useQueryClient();

  // Local form state
  const [bastNumber, setBastNumber] = useState("");
  const [bastDate, setBastDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [hoInspectorName, setHoInspectorName] = useState("");
  const [contractorRepName, setContractorRepName] = useState("");
  const [bastFileUrl, setBastFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Dialog & feedback state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isVerifyConfirmOpen, setIsVerifyConfirmOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");

  // Fetch BAST Data
  const { data, isLoading } = useQuery<{
    success: boolean;
    data: BastResponse | null;
  }>({
    queryKey: ["bast-detail", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/bast`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memuat dokumen BAST");
      }
      return res.json();
    },
  });

  const bastData = data?.data;

  // Sinkronisasi data dari server ke form state
  useEffect(() => {
    if (bastData) {
      setBastNumber(bastData.bastNumber || "");
      if (bastData.bastDate) {
        setBastDate(new Date(bastData.bastDate).toISOString().split("T")[0]);
      }
      setHoInspectorName(bastData.hoInspectorName || "");
      setContractorRepName(bastData.contractorRepName || "");
      setBastFileUrl(bastData.bastFileUrl || "");
      setNotes(bastData.notes || "");
    }
  }, [bastData]);

  const isCompleted = projectStatus === ProjectStatus.COMPLETED;
  const isCancelled = projectStatus === ProjectStatus.CANCELLED;
  const isWaitingBast = projectStatus === ProjectStatus.WAITING_BAST;
  const isExecution = projectStatus === ProjectStatus.EXECUTION;
  const isSuperAdmin = userRole === Role.SUPER_ADMIN;
  const canEdit =
    (userRole === Role.SUPER_ADMIN || userRole === Role.WM_HO_SPECIALIST) &&
    !isCompleted &&
    !isCancelled;

  // Mutation: Simpan Draf BAST
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      if (!bastNumber.trim()) {
        throw new Error("Nomor BAST wajib diisi");
      }
      if (!bastDate) {
        throw new Error("Tanggal BAST wajib diisi");
      }

      const res = await fetch(`/api/projects/${projectId}/bast`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bastNumber: bastNumber.trim(),
          bastDate,
          hoInspectorName: hoInspectorName.trim() || null,
          contractorRepName: contractorRepName.trim() || null,
          bastFileUrl: bastFileUrl.trim() || "",
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan draf BAST");
      }
      return json.data;
    },
    onSuccess: () => {
      setSuccessMessage("Draf BAST berhasil disimpan.");
      queryClient.invalidateQueries({ queryKey: ["bast-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      if (onProjectUpdated) onProjectUpdated();
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  // Mutation: Ajukan BAST (Transisi T7: EXECUTION -> WAITING_BAST)
  const submitBastMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      // Pastikan draf tersimpan terlebih dahulu jika ada perubahan
      if (!bastFileUrl.trim()) {
        throw new Error(
          "Berkas lampiran BAST (bastFileUrl) wajib diisi sebelum mengajukan BAST"
        );
      }

      // Simpan draf terlebih dahulu untuk menjamin konsistensi di DB
      const saveRes = await fetch(`/api/projects/${projectId}/bast`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bastNumber: bastNumber.trim(),
          bastDate,
          hoInspectorName: hoInspectorName.trim() || null,
          contractorRepName: contractorRepName.trim() || null,
          bastFileUrl: bastFileUrl.trim(),
          notes: notes.trim() || null,
        }),
      });

      if (!saveRes.ok) {
        const errJson = await saveRes.json();
        throw new Error(errJson.error || "Gagal menyimpan dokumen BAST sebelum pengajuan");
      }

      // Lakukan transisi status
      const res = await fetch(`/api/projects/${projectId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_BAST",
          remarks: `Diajukan dengan dokumen BAST: ${bastNumber.trim()}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengajukan BAST");
      }
      return json.data;
    },
    onSuccess: () => {
      setIsSubmitConfirmOpen(false);
      setSuccessMessage(
        "BAST berhasil diajukan! Status proyek berpindah ke WAITING_BAST."
      );
      queryClient.invalidateQueries({ queryKey: ["bast-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (onProjectUpdated) onProjectUpdated();
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
      setIsSubmitConfirmOpen(false);
    },
  });

  // Mutation: Verifikasi BAST oleh SUPER_ADMIN (Transisi T8: WAITING_BAST -> COMPLETED)
  const verifyBastMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/projects/${projectId}/bast/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: verifyNotes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memverifikasi BAST");
      }
      return json.data;
    },
    onSuccess: () => {
      setIsVerifyConfirmOpen(false);
      setSuccessMessage(
        "BAST berhasil diverifikasi oleh SUPER_ADMIN! Proyek resmi ditutup (COMPLETED) dan seluruh workspace terkunci."
      );
      queryClient.invalidateQueries({ queryKey: ["bast-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (onProjectUpdated) onProjectUpdated();
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
      setIsVerifyConfirmOpen(false);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Error / Success */}
      {errorMessage && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="space-y-1">
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <div className="space-y-1">
            <p className="font-semibold">Berhasil</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {/* Banner Status BAST */}
      {isCompleted ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30 space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>BAST Telah Diverifikasi & Proyek Resmi Ditutup (COMPLETED)</span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Diverifikasi oleh{" "}
            <span className="font-semibold">
              {bastData?.verifiedBy?.name || "SUPER_ADMIN"}
            </span>{" "}
            pada{" "}
            <span className="font-semibold">
              {bastData?.verifiedAt
                ? new Date(bastData.verifiedAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "-"}
            </span>
            . Sesuai aturan B9, seluruh dokumen dan data proyek telah terkunci
            secara permanen.
          </p>
        </div>
      ) : isWaitingBast ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-5 dark:border-amber-900/60 dark:bg-amber-950/30 space-y-2">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-300 font-semibold text-sm">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span>Menunggu Verifikasi Akhir oleh SUPER_ADMIN</span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-400">
            Dokumen BAST telah diajukan. Proyek saat ini berada dalam status{" "}
            <span className="font-semibold font-mono">WAITING_BAST</span>. Verifikasi
            hanya dapat dilakukan oleh SUPER_ADMIN untuk menyelesaikan proyek.
          </p>
        </div>
      ) : isExecution ? (
        <div className="rounded-lg border border-sky-300 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/30 space-y-1.5">
          <div className="flex items-center gap-2 text-sky-900 dark:text-sky-300 font-semibold text-xs">
            <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Tahap Pelaksanaan Fisik (EXECUTION)</span>
          </div>
          <p className="text-xs text-sky-800 dark:text-sky-400">
            Pastikan seluruh draf data BAST dan tautan lampiran telah dilengkapi.
            Klik tombol &quot;Ajukan BAST&quot; untuk mengajukan serah terima ke SUPER_ADMIN.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-xs">
            <Lock className="h-4 w-4" />
            <span>Pengajuan BAST Terkunci</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Sesuai aturan alur kerja (T7), BAST hanya dapat diajukan setelah proyek
            mencapai tahap pelaksanaan fisik (<span className="font-semibold font-mono">EXECUTION</span>).
            Status proyek saat ini: <span className="font-semibold font-mono">{projectStatus}</span>.
          </p>
        </div>
      )}

      {/* Form Draf Dokumen BAST */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Draf Berita Acara Serah Terima (BAST)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Pencatatan nomor dokumen serah terima pekerjaan fisik, inspektur, dan berkas lampiran.
              </CardDescription>
            </div>
            {bastData?.verifiedAt && (
              <Badge
                variant="outline"
                className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 self-start sm:self-auto text-xs py-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Terverifikasi
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nomor BAST */}
            <div className="space-y-1.5">
              <Label htmlFor="bastNumber" className="text-xs font-semibold">
                Nomor BAST <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="bastNumber"
                placeholder="Contoh: BAST/WM/2026/001"
                value={bastNumber}
                onChange={(e) => setBastNumber(e.target.value)}
                disabled={!canEdit}
                className="text-xs h-9 font-mono"
              />
            </div>

            {/* Tanggal BAST */}
            <div className="space-y-1.5">
              <Label htmlFor="bastDate" className="text-xs font-semibold">
                Tanggal BAST <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="bastDate"
                type="date"
                value={bastDate}
                onChange={(e) => setBastDate(e.target.value)}
                disabled={!canEdit}
                className="text-xs h-9"
              />
            </div>

            {/* Nama Inspektur HO */}
            <div className="space-y-1.5">
              <Label htmlFor="hoInspector" className="text-xs font-semibold">
                Nama Inspektur HO / Specialist
              </Label>
              <Input
                id="hoInspector"
                placeholder="Nama inspektur verifikasi lapangan"
                value={hoInspectorName}
                onChange={(e) => setHoInspectorName(e.target.value)}
                disabled={!canEdit}
                className="text-xs h-9"
              />
            </div>

            {/* Nama Perwakilan Kontraktor */}
            <div className="space-y-1.5">
              <Label htmlFor="contractorRep" className="text-xs font-semibold">
                Nama Perwakilan Kontraktor / Vendor
              </Label>
              <Input
                id="contractorRep"
                placeholder="Nama penanggung jawab kontraktor"
                value={contractorRepName}
                onChange={(e) => setContractorRepName(e.target.value)}
                disabled={!canEdit}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Berkas Lampiran BAST */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bastFileUrl" className="text-xs font-semibold">
                Tautan Berkas Lampiran BAST <span className="text-rose-500">*</span>
              </Label>
              {bastFileUrl && (
                <a
                  href={bastFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="h-3 w-3" /> Buka Tautan Berkas
                </a>
              )}
            </div>
            <Input
              id="bastFileUrl"
              placeholder="Contoh: https://r2.storage.wm/bast/dokumen-serah-terima-2026.pdf"
              value={bastFileUrl}
              onChange={(e) => setBastFileUrl(e.target.value)}
              disabled={!canEdit}
              className="text-xs h-9 font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Wajib terisi sebelum pengajuan BAST (T7). Unggah berkas asli langsung via presigned URL R2 dijadwalkan pada Phase C (P9).
            </p>
          </div>

          {/* Catatan BAST */}
          <div className="space-y-1.5">
            <Label htmlFor="bastNotes" className="text-xs font-semibold">
              Catatan Serah Terima / Hasil Inspeksi
            </Label>
            <Textarea
              id="bastNotes"
              rows={3}
              placeholder="Tuliskan catatan kondisi pekerjaan fisik, rekomendasi masa pemeliharaan, atau catatan pengecualian bila ada..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
              className="text-xs resize-none"
            />
          </div>

          {/* Action Button Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              {/* Tombol Simpan Draf */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveDraftMutation.mutate()}
                disabled={!canEdit || saveDraftMutation.isPending}
                className="h-8 text-xs"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saveDraftMutation.isPending ? "Menyimpan..." : "Simpan Draf BAST"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Ajukan BAST (Transisi ke WAITING_BAST) */}
              {isExecution && (
                <Button
                  size="sm"
                  onClick={() => setIsSubmitConfirmOpen(true)}
                  disabled={
                    !canEdit ||
                    submitBastMutation.isPending ||
                    !bastFileUrl.trim() ||
                    !bastNumber.trim()
                  }
                  className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {submitBastMutation.isPending ? "Mengajukan..." : "Ajukan BAST"}
                </Button>
              )}

              {/* Tombol Verifikasi BAST (Khusus SUPER_ADMIN di status WAITING_BAST) */}
              {isSuperAdmin && isWaitingBast && (
                <Button
                  size="sm"
                  onClick={() => setIsVerifyConfirmOpen(true)}
                  disabled={verifyBastMutation.isPending}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  {verifyBastMutation.isPending ? "Memverifikasi..." : "Verifikasi BAST (Selesaikan Proyek)"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog: Ajukan BAST */}
      <AlertDialog
        open={isSubmitConfirmOpen}
        onOpenChange={setIsSubmitConfirmOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Konfirmasi Pengajuan BAST
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2 text-muted-foreground">
              <span>
                Apakah Anda yakin ingin mengajukan Berita Acara Serah Terima untuk proyek ini?
              </span>
              <span className="block mt-1 font-medium text-foreground">
                Status proyek akan beralih ke <span className="font-mono text-primary">WAITING_BAST</span> dan menunggu verifikasi akhir dari SUPER_ADMIN.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={submitBastMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                submitBastMutation.mutate();
              }}
              disabled={submitBastMutation.isPending}
              className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white"
            >
              {submitBastMutation.isPending ? "Memproses..." : "Ya, Ajukan BAST"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Verifikasi BAST (SUPER_ADMIN) */}
      <AlertDialog
        open={isVerifyConfirmOpen}
        onOpenChange={setIsVerifyConfirmOpen}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              Verifikasi BAST & Penutupan Proyek
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2 text-muted-foreground">
              <span>
                PERHATIAN: Verifikasi ini akan mentransisikan status proyek secara resmi menjadi{" "}
                <span className="font-semibold text-foreground">COMPLETED</span>.
              </span>
              <span className="block p-2 rounded bg-muted/60 border border-border text-foreground font-medium">
                Sesuai aturan bisnis B9, seluruh mutasi data di proyek ini akan terkunci secara permanen (read-only).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="verifyNotes" className="text-xs font-semibold">
              Catatan Verifikasi Tambahan (opsional)
            </Label>
            <Textarea
              id="verifyNotes"
              rows={2}
              placeholder="Catatan persetujuan akhir atau referensi audit..."
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={verifyBastMutation.isPending}
              className="h-8 text-xs"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                verifyBastMutation.mutate();
              }}
              disabled={verifyBastMutation.isPending}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {verifyBastMutation.isPending ? "Memproses..." : "Verifikasi & Selesaikan Proyek"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
