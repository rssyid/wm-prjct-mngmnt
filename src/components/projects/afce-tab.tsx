"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AFCE_STATUS_CONFIG,
  APPROVAL_STATUS_CONFIG,
} from "@/lib/constants/status";
import { cn } from "@/lib/utils";
import {
  AfceStatus,
  ApprovalStatus,
  ProjectStatus,
} from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUploadButton } from "@/components/ui/file-upload-button";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  History,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface ApprovalItemState {
  id?: string;
  approvalLevel: number;
  role: string;
  personName: string;
  status: ApprovalStatus;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  notes?: string | null;
  evidenceDocUrl?: string | null;
}

interface ApprovalSnapshotResponse {
  id: string;
  afceDocumentId: string;
  attemptNo: number;
  approvalLevel: number;
  role: string;
  personName: string | null;
  status: ApprovalStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
  evidenceDocUrl?: string | null;
  createdAt: string;
}

interface AfceDocumentResponse {
  id: string;
  projectId: string;
  noAr: string | null;
  arType: string | null;
  budgetType: string | null;
  approvedAmount: string | number;
  drawingReady: boolean;
  rabReady: boolean;
  mapReady: boolean;
  emailSubmitted: boolean;
  emailSubmittedDate: string | null;
  mcaApprovalDate: string | null;
  currentAttempt: number;
  status: AfceStatus;
  approvals: ApprovalSnapshotResponse[];
}

interface SupplementaryArResponse {
  id: string;
  projectId: string;
  noAr: string;
  amount: string | number;
  notes: string | null;
  status: AfceStatus;
  createdAt: string;
}

interface AfceTabProps {
  projectId: string;
  projectStatus: ProjectStatus;
  onProjectUpdated?: () => void;
}

const DEFAULT_APPROVER_ROLES = [
  "Estate Manager",
  "Head of Water Management",
  "Regional Controller",
];

export function AfceTab({ projectId, projectStatus, onProjectUpdated }: AfceTabProps) {
  const queryClient = useQueryClient();

  // 1. Fetch Dokumen AFCE
  const {
    data: afceData,
    isLoading: isAfceLoading,
    error: afceError,
  } = useQuery<{ success: boolean; data: AfceDocumentResponse | null }>({
    queryKey: ["project-afce", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/afce`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengambil data AFCE");
      }
      return res.json();
    },
  });

  // 2. Fetch Supplementary AR
  const { data: suppData, isLoading: isSuppLoading } = useQuery<{
    success: boolean;
    data: SupplementaryArResponse[];
  }>({
    queryKey: ["project-supplementary", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/supplementary`);
      if (!res.ok) return { success: true, data: [] };
      return res.json();
    },
  });

  const afce = afceData?.data;
  const isCompletedOrCancelled =
    projectStatus === ProjectStatus.COMPLETED ||
    projectStatus === ProjectStatus.CANCELLED;

  // Form State
  const [noAr, setNoAr] = useState("");
  const [arType, setArType] = useState("REGULAR");
  const [budgetType, setBudgetType] = useState("CAPEX_BUDGETED");
  const [approvedAmount, setApprovedAmount] = useState<number | string>(0);
  const [drawingReady, setDrawingReady] = useState(false);
  const [rabReady, setRabReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSubmittedDate, setEmailSubmittedDate] = useState("");
  const [mcaApprovalDate, setMcaApprovalDate] = useState("");

  // Approvals State (Attempt Aktif)
  const [activeApprovals, setActiveApprovals] = useState<ApprovalItemState[]>([]);

  // UI Toggle State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Dialog State
  const [isResubmitDialogOpen, setIsResubmitDialogOpen] = useState(false);
  const [isSuppDialogOpen, setIsSuppDialogOpen] = useState(false);
  const [suppNoAr, setSuppNoAr] = useState("");
  const [suppAmount, setSuppAmount] = useState<number | string>("");
  const [suppNotes, setSuppNotes] = useState("");
  const [suppError, setSuppError] = useState<string | null>(null);

  // Sinkronisasi data dari API ke form state
  useEffect(() => {
    if (afce) {
      setNoAr(afce.noAr || "");
      setArType(afce.arType || "REGULAR");
      setBudgetType(afce.budgetType || "CAPEX_BUDGETED");
      setApprovedAmount(afce.approvedAmount ? Number(afce.approvedAmount) : 0);
      setDrawingReady(afce.drawingReady || false);
      setRabReady(afce.rabReady || false);
      setMapReady(afce.mapReady || false);
      setEmailSubmitted(afce.emailSubmitted || false);
      setEmailSubmittedDate(
        afce.emailSubmittedDate
          ? new Date(afce.emailSubmittedDate).toISOString().split("T")[0]
          : ""
      );
      setMcaApprovalDate(
        afce.mcaApprovalDate
          ? new Date(afce.mcaApprovalDate).toISOString().split("T")[0]
          : ""
      );

      // Filter approvals untuk currentAttempt
      const currentAttemptSnapshots = (afce.approvals || []).filter(
        (a) => a.attemptNo === afce.currentAttempt
      );

      if (currentAttemptSnapshots.length > 0) {
        setActiveApprovals(
          currentAttemptSnapshots.map((a) => ({
            id: a.id,
            approvalLevel: a.approvalLevel,
            role: a.role,
            personName: a.personName || "",
            status: a.status,
            submittedAt: a.submittedAt,
            approvedAt: a.approvedAt,
            rejectedAt: a.rejectedAt,
            notes: a.notes || "",
            evidenceDocUrl: a.evidenceDocUrl || null,
          }))
        );
      } else {
        // Inisialisasi default approvals bila kosong
        setActiveApprovals(
          DEFAULT_APPROVER_ROLES.map((role, idx) => ({
            approvalLevel: idx + 1,
            role,
            personName: "",
            status: ApprovalStatus.WAITING,
            notes: "",
          }))
        );
      }
    } else {
      // Default initial untuk dokumen baru
      setActiveApprovals(
        DEFAULT_APPROVER_ROLES.map((role, idx) => ({
          approvalLevel: idx + 1,
          role,
          personName: "",
          status: ApprovalStatus.WAITING,
          notes: "",
        }))
      );
    }
  }, [afce]);

  // Handler tambah baris approver
  const handleAddApprover = () => {
    const nextLevel = activeApprovals.length + 1;
    setActiveApprovals([
      ...activeApprovals,
      {
        approvalLevel: nextLevel,
        role: `Approver Level ${nextLevel}`,
        personName: "",
        status: ApprovalStatus.WAITING,
        notes: "",
      },
    ]);
  };

  // Handler hapus baris approver
  const handleRemoveApprover = (index: number) => {
    const updated = activeApprovals
      .filter((_, i) => i !== index)
      .map((item, idx) => ({
        ...item,
        approvalLevel: idx + 1,
      }));
    setActiveApprovals(updated);
  };

  // Handler update baris approver
  const handleUpdateApprover = (
    index: number,
    field: keyof ApprovalItemState,
    value: unknown
  ) => {
    const updated = [...activeApprovals];
    updated[index] = { ...updated[index], [field]: value };
    setActiveApprovals(updated);
  };

  // 3. Mutation: Save AFCE & Approvals
  const saveAfceMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);

      // Validasi lokal sebelum kirim
      if (emailSubmitted && (!noAr || !noAr.trim())) {
        throw new Error("Nomor AR wajib diisi saat email pengajuan telah dikirim.");
      }
      if (emailSubmitted && !emailSubmittedDate) {
        throw new Error(
          "Tanggal pengajuan email wajib diisi saat email pengajuan telah dikirim."
        );
      }

      // Validasi urutan paraf (B2)
      for (let i = 0; i < activeApprovals.length; i++) {
        if (activeApprovals[i].status === ApprovalStatus.APPROVED) {
          for (let j = 0; j < i; j++) {
            if (activeApprovals[j].status !== ApprovalStatus.APPROVED) {
              throw new Error(
                `Approval harus berurutan: Level ${activeApprovals[i].approvalLevel} tidak dapat diset Approved sebelum Level ${activeApprovals[j].approvalLevel} Approved.`
              );
            }
          }
        }
      }

      const payload = {
        noAr: noAr.trim() || null,
        arType: arType || null,
        budgetType: budgetType || null,
        approvedAmount: Number(approvedAmount) || 0,
        drawingReady,
        rabReady,
        mapReady,
        emailSubmitted,
        emailSubmittedDate: emailSubmittedDate
          ? new Date(emailSubmittedDate).toISOString()
          : null,
        mcaApprovalDate: mcaApprovalDate
          ? new Date(mcaApprovalDate).toISOString()
          : null,
        approvals: activeApprovals.map((a) => ({
          approvalLevel: a.approvalLevel,
          role: a.role.trim(),
          personName: a.personName.trim() || null,
          status: a.status,
          notes: a.notes ? a.notes.trim() : null,
          evidenceDocUrl: a.evidenceDocUrl || null,
        })),
      };

      const res = await fetch(`/api/projects/${projectId}/afce`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan dokumen AFCE");
      }

      return res.json();
    },
    onSuccess: () => {
      setFormSuccess("Dokumen AFCE & jenjang persetujuan berhasil diperbarui!");
      queryClient.invalidateQueries({ queryKey: ["project-afce", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onProjectUpdated?.();
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // 4. Mutation: Resubmit AFCE (B4)
  const resubmitMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);

      const res = await fetch(`/api/projects/${projectId}/afce/resubmit`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengajukan ulang AFCE");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setIsResubmitDialogOpen(false);
      setFormSuccess(
        `Pengajuan ulang berhasil! Membuka Attempt #${data?.data?.currentAttempt} (history attempt lama tersimpan permanen).`
      );
      queryClient.invalidateQueries({ queryKey: ["project-afce", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onProjectUpdated?.();
    },
    onError: (err: Error) => {
      setIsResubmitDialogOpen(false);
      setFormError(err.message);
    },
  });

  // 5. Mutation: Tambah Supplementary AR (B5)
  const addSuppMutation = useMutation({
    mutationFn: async () => {
      setSuppError(null);
      if (!suppNoAr.trim()) {
        throw new Error("Nomor AR Tambahan wajib diisi.");
      }
      if (!suppAmount || Number(suppAmount) <= 0) {
        throw new Error("Nominal AR Tambahan harus lebih besar dari 0.");
      }

      const res = await fetch(`/api/projects/${projectId}/supplementary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noAr: suppNoAr.trim(),
          amount: Number(suppAmount),
          notes: suppNotes.trim() || null,
          status: "PENDING",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mencatat AR Tambahan");
      }

      return res.json();
    },
    onSuccess: () => {
      setIsSuppDialogOpen(false);
      setSuppNoAr("");
      setSuppAmount("");
      setSuppNotes("");
      queryClient.invalidateQueries({
        queryKey: ["project-supplementary", projectId],
      });
    },
    onError: (err: Error) => {
      setSuppError(err.message);
    },
  });

  if (isAfceLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (afceError) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
        <CardContent className="py-8 text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-400">
            Gagal Memuat Dokumen AFCE
          </h4>
          <p className="text-xs text-muted-foreground">
            {afceError instanceof Error ? afceError.message : "Terjadi kesalahan."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Riwayat attempt sebelumnya (attemptNo < currentAttempt)
  const currentAttemptNo = afce?.currentAttempt || 1;
  const previousAttempts = (afce?.approvals || []).filter(
    (a) => a.attemptNo < currentAttemptNo
  );
  // Group previous attempts by attemptNo
  const previousAttemptsGrouped = previousAttempts.reduce<
    Record<number, ApprovalSnapshotResponse[]>
  >((acc, curr) => {
    if (!acc[curr.attemptNo]) acc[curr.attemptNo] = [];
    acc[curr.attemptNo].push(curr);
    return acc;
  }, {});

  const afceStatusCfg = afce
    ? AFCE_STATUS_CONFIG[afce.status]
    : AFCE_STATUS_CONFIG.PENDING;

  return (
    <div className="space-y-6">
      {/* Top Banner Status & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-muted-foreground">
            Status Dokumen AFCE:
          </span>
          <Badge
            variant="outline"
            className={cn("text-xs px-2.5 py-0.5 font-medium border", afceStatusCfg.badgeClass)}
          >
            {afceStatusCfg.label}
          </Badge>
          <Badge variant="outline" className="text-xs bg-muted text-foreground">
            Attempt #{currentAttemptNo}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Ajukan Ulang - HANYA muncul saat status REJECTED */}
          {afce?.status === AfceStatus.REJECTED && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsResubmitDialogOpen(true)}
              disabled={isCompletedOrCancelled || resubmitMutation.isPending}
              className="text-xs shadow-xs"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", resubmitMutation.isPending && "animate-spin")} />
              Ajukan Ulang (Attempt Baru)
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => saveAfceMutation.mutate()}
            disabled={isCompletedOrCancelled || saveAfceMutation.isPending}
            className="text-xs shadow-xs"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveAfceMutation.isPending ? "Menyimpan..." : "Simpan Perubahan AFCE"}
          </Button>
        </div>
      </div>

      {/* Alert Error / Success */}
      {formError && (
        <div className="p-3.5 rounded-md border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{formError}</div>
        </div>
      )}
      {formSuccess && (
        <div className="p-3.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1 font-medium">{formSuccess}</div>
        </div>
      )}

      {/* Card 1: Checklist & Form Data AFCE */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Checklist & Parameter Anggaran AFCE
          </CardTitle>
          <CardDescription className="text-xs">
            Kelengkapan gambar teknis, kesiapan RAB, dan informasi pengajuan approval email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {/* Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="noAr" className="text-xs font-medium">
                Nomor AR {emailSubmitted && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="noAr"
                placeholder="Contoh: AR/WM/2026/001"
                value={noAr}
                onChange={(e) => setNoAr(e.target.value)}
                disabled={isCompletedOrCancelled}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="arType" className="text-xs font-medium">
                Tipe AR
              </Label>
              <Select
                value={arType}
                onValueChange={setArType}
                disabled={isCompletedOrCancelled}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGULAR">REGULAR</SelectItem>
                  <SelectItem value="SUPPLEMENTARY">SUPPLEMENTARY</SelectItem>
                  <SelectItem value="REVISED">REVISED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budgetType" className="text-xs font-medium">
                Tipe Anggaran
              </Label>
              <Select
                value={budgetType}
                onValueChange={setBudgetType}
                disabled={isCompletedOrCancelled}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih Budget" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAPEX_BUDGETED">CAPEX BUDGETED</SelectItem>
                  <SelectItem value="CAPEX_UNBUDGETED">CAPEX UNBUDGETED</SelectItem>
                  <SelectItem value="OPEX">OPEX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approvedAmount" className="text-xs font-medium">
                Nominal Disetujui (Rp)
              </Label>
              <Input
                id="approvedAmount"
                type="number"
                min="0"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                disabled={isCompletedOrCancelled}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Checklist Boxes */}
          <div className="pt-2">
            <Label className="text-xs font-semibold text-foreground block mb-2">
              Checklist Kesiapan Dokumen & Pemicu Status Otomatis
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Gambar Siap */}
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  drawingReady
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={drawingReady}
                  onChange={(e) => setDrawingReady(e.target.checked)}
                  disabled={isCompletedOrCancelled}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground">Gambar Siap</span>
                  <p className="text-[11px] text-muted-foreground">
                    Dokumen DED & gambar kerja
                  </p>
                </div>
              </label>

              {/* Peta GIS Siap */}
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  mapReady
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={mapReady}
                  onChange={(e) => setMapReady(e.target.checked)}
                  disabled={isCompletedOrCancelled}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground">Peta GIS Siap</span>
                  <p className="text-[11px] text-muted-foreground">
                    Layout poligon/jalur struktur
                  </p>
                </div>
              </label>

              {/* RAB Siap -> Memicu T2 */}
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors relative",
                  rabReady
                    ? "border-amber-400 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={rabReady}
                  onChange={(e) => setRabReady(e.target.checked)}
                  disabled={isCompletedOrCancelled}
                  className="mt-0.5 rounded border-border text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">RAB Siap</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                      T2 Pemicu
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Memicu transisi status ke <span className="font-medium text-foreground">RAB_READY</span>
                  </p>
                </div>
              </label>

              {/* Email Dikirim -> Memicu T3 */}
              <label
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors relative",
                  emailSubmitted
                    ? "border-amber-400 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <input
                  type="checkbox"
                  checked={emailSubmitted}
                  onChange={(e) => setEmailSubmitted(e.target.checked)}
                  disabled={isCompletedOrCancelled}
                  className="mt-0.5 rounded border-border text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Email Dikirim</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                      T3 Pemicu
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Memicu transisi ke <span className="font-medium text-foreground">WAITING_AFCE_AR</span>
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Tanggal Terkait */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="emailSubmittedDate" className="text-xs font-medium">
                Tanggal Pengajuan Email {emailSubmitted && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="emailSubmittedDate"
                type="date"
                value={emailSubmittedDate}
                onChange={(e) => setEmailSubmittedDate(e.target.value)}
                disabled={isCompletedOrCancelled}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mcaApprovalDate" className="text-xs font-medium">
                Tanggal Persetujuan MCA (Bila Ada)
              </Label>
              <Input
                id="mcaApprovalDate"
                type="date"
                value={mcaApprovalDate}
                onChange={(e) => setMcaApprovalDate(e.target.value)}
                disabled={isCompletedOrCancelled}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Jenjang Persetujuan Bertingkat (Active Attempt) */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Jenjang Persetujuan (Attempt #{currentAttemptNo})
            </CardTitle>
            <CardDescription className="text-xs">
              Aturan B2: Persetujuan harus berurutan. Level N hanya dapat diset Approved jika level sebelumnya telah Approved.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddApprover}
            disabled={isCompletedOrCancelled}
            className="text-xs h-8"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah Approver
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeApprovals.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
              Belum ada approver terdaftar. Klik tombol Tambah Approver di atas.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeApprovals.map((item, index) => {
                const statusCfg = APPROVAL_STATUS_CONFIG[item.status];
                return (
                  <div
                    key={index}
                    className="p-3.5 rounded-lg border border-border bg-card/60 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          Level {item.approvalLevel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-[11px] px-2 py-0 border", statusCfg.badgeClass)}
                        >
                          {statusCfg.label}
                        </Badge>
                      </div>

                      {activeApprovals.length > 1 && !isCompletedOrCancelled && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveApprover(index)}
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                          title="Hapus baris approver"
                          aria-label="Hapus baris approver"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Jabatan / Role Approver
                        </Label>
                        <Input
                          value={item.role}
                          onChange={(e) =>
                            handleUpdateApprover(index, "role", e.target.value)
                          }
                          disabled={isCompletedOrCancelled}
                          placeholder="Contoh: Estate Manager"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Nama Petugas Paraf (Aturan B1)
                        </Label>
                        <Input
                          value={item.personName}
                          onChange={(e) =>
                            handleUpdateApprover(index, "personName", e.target.value)
                          }
                          disabled={isCompletedOrCancelled}
                          placeholder="Nama approver (paraf manual)"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Status Persetujuan
                        </Label>
                        <Select
                          value={item.status}
                          onValueChange={(val) =>
                            handleUpdateApprover(index, "status", val as ApprovalStatus)
                          }
                          disabled={isCompletedOrCancelled}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WAITING">Menunggu Paraf (WAITING)</SelectItem>
                            <SelectItem value="APPROVED">Diparaf (APPROVED)</SelectItem>
                            <SelectItem value="REJECTED">Ditolak (REJECTED)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Catatan / Alasan Penolakan
                      </Label>
                      <Input
                        value={item.notes || ""}
                        onChange={(e) =>
                          handleUpdateApprover(index, "notes", e.target.value)
                        }
                        disabled={isCompletedOrCancelled}
                        placeholder="Tambahkan catatan approval atau evaluasi koreksi bila ditolak"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="text-xs space-y-1 pt-1 border-t border-border/50">
                      <Label className="text-[11px] text-muted-foreground">
                        Berkas Bukti Paraf / Scan Dokumen (Opsional)
                      </Label>
                      <FileUploadButton
                        value={item.evidenceDocUrl}
                        onChange={(url) =>
                          handleUpdateApprover(index, "evidenceDocUrl", url)
                        }
                        folder="afce"
                        accept="application/pdf,image/*"
                        disabled={isCompletedOrCancelled}
                        label="Unggah Bukti Paraf"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3: Riwayat Attempt Sebelumnya (Collapsed Accordion) */}
      {Object.keys(previousAttemptsGrouped).length > 0 && (
        <Card className="border-border shadow-xs">
          <CardHeader
            className="py-3 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">
                  Riwayat Pengajuan Sebelumnya (Attempt History)
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-muted">
                  {Object.keys(previousAttemptsGrouped).length} Attempt Tersimpan
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                {isHistoryOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>

          {isHistoryOpen && (
            <CardContent className="pt-2 pb-4 space-y-4 text-xs border-t border-border">
              {Object.entries(previousAttemptsGrouped)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([attemptNum, snapshots]) => (
                  <div
                    key={attemptNum}
                    className="rounded-lg border border-border p-3.5 space-y-3 bg-muted/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground font-mono">
                          Attempt #{attemptNum}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                        >
                          Ditolak (Arsip)
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {snapshots.map((snap) => {
                        const statusCfg = APPROVAL_STATUS_CONFIG[snap.status];
                        return (
                          <div
                            key={snap.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded bg-background border border-border/70 text-xs gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-muted-foreground">
                                L{snap.approvalLevel}:
                              </span>
                              <span className="font-medium text-foreground">
                                {snap.role}
                              </span>
                              {snap.personName && (
                                <span className="text-muted-foreground">
                                  ({snap.personName})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {snap.notes && (
                                <span className="text-[11px] text-rose-600 dark:text-rose-400 italic max-w-xs truncate">
                                  &ldquo;{snap.notes}&rdquo;
                                </span>
                              )}
                              {snap.evidenceDocUrl && (
                                <a
                                  href={snap.evidenceDocUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                                  title="Buka lampiran bukti paraf"
                                >
                                  <ExternalLink className="h-3 w-3" /> Berkas
                                </a>
                              )}
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-2 py-0 border", statusCfg.badgeClass)}
                              >
                                {statusCfg.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Card 4: Supplementary AR (AR Tambahan Paralel B5) */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-primary" />
              AR Tambahan (Supplementary AR)
            </CardTitle>
            <CardDescription className="text-xs">
              Aturan B5: Berjalan paralel, tidak dibatasi jumlahnya, dan tidak memengaruhi status proyek utama.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSuppDialogOpen(true)}
            disabled={isCompletedOrCancelled}
            className="text-xs h-8"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah AR Tambahan
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSuppLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !suppData?.data || suppData.data.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
              Belum ada AR tambahan untuk proyek ini.
            </div>
          ) : (
            <div className="space-y-2">
              {suppData.data.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">
                        {item.noAr}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {item.status}
                      </Badge>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-muted-foreground">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right font-mono font-semibold text-foreground">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    }).format(Number(item.amount) || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Konfirmasi Resubmit AFCE */}
      <Dialog open={isResubmitDialogOpen} onOpenChange={setIsResubmitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <RefreshCw className="h-5 w-5" />
              Ajukan Ulang Dokumen AFCE?
            </DialogTitle>
            <DialogDescription className="text-xs space-y-2 pt-2">
              <p>
                Dokumen AFCE sebelumnya ditolak pada Attempt #{currentAttemptNo}.
              </p>
              <p>
                Sistem akan membuat <strong>Attempt #{currentAttemptNo + 1}</strong> dengan status approver direset ke <strong>WAITING</strong>.
              </p>
              <p className="text-muted-foreground">
                Sesuai Aturan Bisnis B4, seluruh riwayat penolakan attempt terdahulu akan tersimpan permanen dan status proyek akan kembali ke <strong>WAITING_AFCE_AR</strong>.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResubmitDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => resubmitMutation.mutate()}
              disabled={resubmitMutation.isPending}
            >
              {resubmitMutation.isPending ? "Memproses..." : "Ya, Ajukan Ulang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Supplementary AR */}
      <Dialog open={isSuppDialogOpen} onOpenChange={setIsSuppDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Tambah AR Tambahan (Supplementary)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pendaftaran anggaran tambahan yang berjalan paralel tanpa mengubah status siklus proyek.
            </DialogDescription>
          </DialogHeader>

          {suppError && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {suppError}
            </div>
          )}

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="suppNoAr">Nomor AR Tambahan *</Label>
              <Input
                id="suppNoAr"
                placeholder="Contoh: SUP/WM/2026/001"
                value={suppNoAr}
                onChange={(e) => setSuppNoAr(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="suppAmount">Nominal Tambahan (Rp) *</Label>
              <Input
                id="suppAmount"
                type="number"
                min="1"
                placeholder="0"
                value={suppAmount}
                onChange={(e) => setSuppAmount(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="suppNotes">Catatan / Alasan Tambahan</Label>
              <Textarea
                id="suppNotes"
                placeholder="Alasan pengajuan AR tambahan..."
                value={suppNotes}
                onChange={(e) => setSuppNotes(e.target.value)}
                className="text-xs"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSuppDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => addSuppMutation.mutate()}
              disabled={addSuppMutation.isPending}
            >
              {addSuppMutation.isPending ? "Menyimpan..." : "Simpan AR Tambahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
