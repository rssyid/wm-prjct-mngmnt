"use client";

import { PackageDetailDialog } from "@/components/procurement/package-detail-dialog";
import { PackageFormDialog } from "@/components/procurement/package-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  PACKAGE_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
} from "@/lib/constants/status";
import { formatCurrency } from "@/lib/utils";
import { AfceStatus, PackageCategory, PackageStatus, PaymentStatus, ProjectStatus } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Edit,
  Eye,
  Lock,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useMemo, useState } from "react";

interface WorkPackageRow {
  id: string;
  projectId: string;
  packageName: string;
  category: PackageCategory;
  vendorId?: string | null;
  vendorName?: string | null;
  picName?: string | null;
  weightPct: number;
  status: PackageStatus;
  paymentStatus: PaymentStatus;
  noPrUspk?: string | null;
  prUspkDate?: string | null;
  noPoSpk?: string | null;
  poSpkDate?: string | null;
  contractOrPoAmount: number | string;
  estDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  planStartDate?: string | null;
  planEndDate?: string | null;
  deliveryDelayDays?: number;
  isDelayed?: boolean;
  totalPlannedQty?: number;
  totalReceivedQty?: number;
  vendor?: { id: string; name: string } | null;
  items?: { id: string }[];
}

interface ProcurementTabProps {
  projectId: string;
  projectStatus: ProjectStatus;
  afceStatus: AfceStatus | null;
}

export function ProcurementTab({
  projectId,
  projectStatus,
  afceStatus,
}: ProcurementTabProps) {
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<WorkPackageRow | null>(
    null
  );
  const [selectedDetailPackageId, setSelectedDetailPackageId] = useState<
    string | null
  >(null);

  // Gerbang B3: Dokumen AFCE wajib APPROVED untuk pengadaan
  const isB3Locked = afceStatus !== AfceStatus.APPROVED;
  const isCompleted = projectStatus === ProjectStatus.COMPLETED;

  // Fetch daftar paket pengadaan proyek
  const { data, isLoading } = useQuery<WorkPackageRow[]>({
    queryKey: ["project-packages", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengambil daftar paket kerja");
      }
      const json = await res.json();
      return (json.data || []) as WorkPackageRow[];
    },
  });

  const packages: WorkPackageRow[] = Array.isArray(data)
    ? data
    : Array.isArray((data as unknown as { data: WorkPackageRow[] })?.data)
    ? (data as unknown as { data: WorkPackageRow[] }).data
    : [];

  // Hitung ringkasan statistik
  const totalWeight = packages.reduce((sum, p) => sum + (p.weightPct || 0), 0);
  const totalAmount = packages.reduce(
    (sum, p) => sum + Number(p.contractOrPoAmount || 0),
    0
  );
  const deliveredCount = packages.filter(
    (p) => p.status === PackageStatus.DELIVERED
  ).length;

  // Mutasi hapus paket
  const deleteMutation = useMutation({
    mutationFn: async (packageId: string) => {
      if (!confirm("Apakah Anda yakin ingin menghapus paket pengadaan ini?")) {
        return;
      }
      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus paket kerja");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-packages", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-detail", projectId],
      });
    },
  });

  // Kolom TanStack Table
  const columns = useMemo<ColumnDef<WorkPackageRow>[]>(() => {
    return [
      {
        accessorKey: "packageName",
        header: "Nama Paket",
        cell: ({ row }) => {
          const pkg = row.original;
          return (
            <div className="space-y-0.5">
              <span className="font-semibold text-foreground">
                {pkg.packageName}
              </span>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  {pkg.category}
                </Badge>
                {pkg.vendor?.name || pkg.vendorName ? (
                  <span>· {pkg.vendor?.name || pkg.vendorName}</span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "weightPct",
        header: "Bobot",
        cell: ({ row }) => (
          <span className="font-semibold text-xs font-mono">
            {row.original.weightPct}%
          </span>
        ),
      },
      {
        id: "prPoPhase",
        header: "Tahap PR / PO",
        cell: ({ row }) => {
          const pkg = row.original;
          return (
            <div className="text-xs space-y-0.5 font-mono">
              <div className="text-muted-foreground">
                PR:{" "}
                <span className="text-foreground">
                  {pkg.noPrUspk || "-"}
                </span>
              </div>
              <div className="text-muted-foreground">
                PO:{" "}
                <span className="text-foreground">
                  {pkg.noPoSpk || "-"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "contractOrPoAmount",
        header: "Nilai Kontrak / PO",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {formatCurrency(row.original.contractOrPoAmount)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status Paket",
        cell: ({ row }) => {
          const cfg = PACKAGE_STATUS_CONFIG[row.original.status];
          return (
            <div className="space-y-1">
              <Badge
                variant="outline"
                className={`text-[11px] px-2 py-0.5 ${cfg?.badgeClass}`}
              >
                <span
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${cfg?.dotClass}`}
                />
                {cfg?.label || row.original.status}
              </Badge>
              {row.original.deliveryDelayDays &&
              row.original.deliveryDelayDays > 0 ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
                  <AlertTriangle className="h-3 w-3" />
                  Terlambat +{row.original.deliveryDelayDays} hari
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "paymentStatus",
        header: "Pembayaran",
        cell: ({ row }) => {
          const cfg = PAYMENT_STATUS_CONFIG[row.original.paymentStatus];
          return (
            <Badge
              variant="outline"
              className={`text-[11px] px-2 py-0.5 ${cfg?.badgeClass}`}
            >
              {cfg?.label || row.original.paymentStatus}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => {
          const pkg = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 gap-1"
                onClick={() => setSelectedDetailPackageId(pkg.id)}
              >
                <Eye className="h-3.5 w-3.5" />
                Detail
              </Button>
              {!isCompleted && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingPackage(pkg)}
                    title="Edit Paket"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(pkg.id)}
                    disabled={deleteMutation.isPending}
                    title="Hapus Paket"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ];
  }, [isCompleted, deleteMutation]);

  return (
    <div className="space-y-5">
      {/* Banner Gerbang B3 jika AFCE belum APPROVED */}
      {isB3Locked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <Lock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm">
              Gerbang Pengadaan Terkunci (Aturan B3)
            </h4>
            <p>
              WorkPackage hanya dapat dibuat setelah dokumen AFCE / AR
              berstatus{" "}
              <span className="font-bold uppercase tracking-wide">
                APPROVED
              </span>
              . Saat ini status AFCE adalah:{" "}
              <span className="font-semibold underline">
                {afceStatus || "BELUM DIAJUKAN"}
              </span>
              . Harap selesaikan proses persetujuan AR terlebih dahulu.
            </p>
          </div>
        </div>
      )}

      {/* Ringkasan KPI Paket Pengadaan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-3.5 space-y-1 border-border bg-card">
          <div className="text-muted-foreground text-xs flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Total Paket
          </div>
          <div className="text-xl font-bold text-foreground">
            {packages.length}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Material, Fabrikasi & Kontraktor
          </p>
        </Card>

        <Card className="p-3.5 space-y-1 border-border bg-card">
          <div className="text-muted-foreground text-xs flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Akumulasi Bobot
          </div>
          <div className="text-xl font-bold text-foreground font-mono">
            {totalWeight.toFixed(1)}%{" "}
            <span className="text-xs text-muted-foreground font-normal">
              / 100%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Sisa kuota bobot: {(100 - totalWeight).toFixed(1)}%
          </p>
        </Card>

        <Card className="p-3.5 space-y-1 border-border bg-card">
          <div className="text-muted-foreground text-xs flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5" /> Total Nilai Kontrak
          </div>
          <div className="text-xl font-bold text-foreground font-mono">
            {formatCurrency(totalAmount)}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Agregat seluruh paket pengadaan
          </p>
        </Card>

        <Card className="p-3.5 space-y-1 border-border bg-card">
          <div className="text-muted-foreground text-xs flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Tiba Lengkap
          </div>
          <div className="text-xl font-bold text-emerald-600 font-mono">
            {deliveredCount}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              / {packages.length} paket
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Status pengiriman DELIVERED
          </p>
        </Card>
      </div>

      {/* Header Tabel & Tombol Tambah */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Daftar Paket Pengadaan (WorkPackage)
          </h3>
          <p className="text-xs text-muted-foreground">
            Kelola line items, surat jalan, dan penerimaan fisik barang berulang.
          </p>
        </div>

        <Button
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => setCreateDialogOpen(true)}
          disabled={isB3Locked || isCompleted}
          title={
            isB3Locked
              ? "Dokumen AFCE harus berstatus APPROVED terlebih dahulu"
              : isCompleted
              ? "Proyek sudah selesai dan terkunci"
              : undefined
          }
        >
          <Plus className="h-4 w-4" />
          Tambah Paket Pengadaan
        </Button>
      </div>

      {/* Tabel Data Paket (TanStack Table) */}
      <DataTable
        columns={columns}
        data={packages}
        isLoading={isLoading}
      />

      {/* Dialog Pembuatan Paket Baru */}
      <PackageFormDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Dialog Edit Paket */}
      {editingPackage && (
        <PackageFormDialog
          projectId={projectId}
          packageId={editingPackage.id}
          initialData={editingPackage}
          open={Boolean(editingPackage)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingPackage(null);
          }}
        />
      )}

      {/* Dialog Detail Lengkap Paket (Items, Deliveries, Payment) */}
      <PackageDetailDialog
        projectId={projectId}
        packageId={selectedDetailPackageId}
        open={Boolean(selectedDetailPackageId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedDetailPackageId(null);
        }}
        onEditPackageClick={() => {
          const target = packages.find((p) => p.id === selectedDetailPackageId);
          if (target) {
            setSelectedDetailPackageId(null);
            setEditingPackage(target);
          }
        }}
      />
    </div>
  );
}
