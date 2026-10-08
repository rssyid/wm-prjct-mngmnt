"use client";

import { DeliveryFormDialog } from "@/components/procurement/delivery-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PACKAGE_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
} from "@/lib/constants/status";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PackageCategory, PackageDocType, PaymentStatus } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUploadButton } from "@/components/ui/file-upload-button";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Paperclip,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import React, { useState } from "react";

interface PackageDetailDialogProps {
  projectId: string;
  packageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditPackageClick?: () => void;
}

interface PackageItemData {
  id: string;
  itemId: string;
  qtyPlanned: number | string;
  qtyReceived: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
  item: {
    id: string;
    itemCode: string;
    name: string;
    specification?: string | null;
    standardPrice?: number | string;
    uom?: { code: string; name: string } | null;
  };
}

interface PackageDeliveryData {
  id: string;
  deliveryDate: string;
  deliveryOrderNo?: string | null;
  notes?: string | null;
  createdAt: string;
  items: {
    id: string;
    qtyReceived: number | string;
    packageItem?: {
      id: string;
      item: { name: string; itemCode: string };
    } | null;
  }[];
}

interface PackageDocumentData {
  id: string;
  workPackageId: string;
  docType: PackageDocType;
  docNumber?: string | null;
  docDate?: string | null;
  fileUrl: string;
  notes?: string | null;
  createdAt: string;
}

interface FullPackageDetail {
  id: string;
  projectId: string;
  packageName: string;
  category: PackageCategory;
  vendorId?: string | null;
  vendorName?: string | null;
  picName?: string | null;
  weightPct: number;
  status: keyof typeof PACKAGE_STATUS_CONFIG;
  paymentStatus: PaymentStatus;
  paidAmount?: number | string | null;
  paidDate?: string | null;
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
  remarks?: string | null;
  vendor?: { id: string; name: string } | null;
  items: PackageItemData[];
  deliveries: PackageDeliveryData[];
  documents?: PackageDocumentData[];
}

export function PackageDetailDialog({
  projectId,
  packageId,
  open,
  onOpenChange,
  onEditPackageClick,
}: PackageDetailDialogProps) {
  const queryClient = useQueryClient();
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);

  // State untuk form tambah line item
  const [selectedItemId, setSelectedItemId] = useState<string>("none");
  const [itemQtyPlanned, setItemQtyPlanned] = useState<string>("1");
  const [itemUnitPrice, setItemUnitPrice] = useState<string>("0");
  const [itemActionError, setItemActionError] = useState<string | null>(null);

  // State untuk form pembayaran
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    PaymentStatus.BELUM_LUNAS
  );
  const [paidAmount, setPaidAmount] = useState<string>("0");
  const [paidDate, setPaidDate] = useState<string>("");
  const [paymentMsg, setPaymentMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // State untuk form dokumen paket
  const [docType, setDocType] = useState<PackageDocType>(PackageDocType.PR);
  const [docNumber, setDocNumber] = useState<string>("");
  const [docDate, setDocDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [docFileUrl, setDocFileUrl] = useState<string | null>(null);
  const [docNotes, setDocNotes] = useState<string>("");
  const [docActionError, setDocActionError] = useState<string | null>(null);

  // Fetch detail lengkap paket
  const { data, isLoading } = useQuery<{
    success: boolean;
    data: FullPackageDetail;
  }>({
    queryKey: ["package-detail", packageId],
    queryFn: async () => {
      if (!packageId) throw new Error("ID paket tidak ada");
      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}`
      );
      if (!res.ok) throw new Error("Gagal mengambil data paket");
      return res.json();
    },
    enabled: Boolean(open && packageId),
  });

  // Fetch master material
  const { data: masterItemData } = useQuery<{
    success: boolean;
    data: {
      id: string;
      itemCode: string;
      name: string;
      standardPrice: number | string;
      uom: { code: string; name: string };
    }[];
  }>({
    queryKey: ["master-items-procurement"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=item");
      if (!res.ok) throw new Error("Gagal mengambil data master material");
      return res.json();
    },
    enabled: Boolean(open),
  });

  const pkg = data?.data;
  const masterItems = masterItemData?.data || [];

  // Sinkronisasi state form pembayaran saat data paket dimuat
  React.useEffect(() => {
    if (pkg) {
      setPaymentStatus(pkg.paymentStatus || PaymentStatus.BELUM_LUNAS);
      setPaidAmount(String(pkg.paidAmount ?? 0));
      setPaidDate(
        pkg.paidDate
          ? new Date(pkg.paidDate).toISOString().split("T")[0]
          : ""
      );
      setPaymentMsg(null);
    }
  }, [pkg]);

  // Handler saat master item dipilih: auto-populate standard price
  const handleSelectMasterItem = (itemId: string) => {
    setSelectedItemId(itemId);
    if (itemId !== "none") {
      const chosen = masterItems.find((m) => m.id === itemId);
      if (chosen) {
        setItemUnitPrice(String(chosen.standardPrice || 0));
      }
    }
  };

  // Mutasi tambah line item baru ke paket
  const addItemMutation = useMutation({
    mutationFn: async () => {
      setItemActionError(null);
      if (selectedItemId === "none" || !selectedItemId) {
        throw new Error("Pilih material dari daftar master item terlebih dahulu");
      }
      const qty = parseFloat(itemQtyPlanned);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Kuantitas rencana harus lebih besar dari 0");
      }
      const price = parseFloat(itemUnitPrice);
      if (isNaN(price) || price < 0) {
        throw new Error("Harga satuan tidak boleh negatif");
      }

      // Kumpulkan item lama + item baru
      const existingItems = (pkg?.items || []).map((it) => ({
        itemId: it.itemId,
        qtyPlanned: Number(it.qtyPlanned),
        unitPrice: Number(it.unitPrice),
      }));

      const newItems = [
        ...existingItems,
        {
          itemId: selectedItemId,
          qtyPlanned: qty,
          unitPrice: price,
        },
      ];

      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: newItems,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambahkan item");
      return json.data;
    },
    onSuccess: () => {
      setSelectedItemId("none");
      setItemQtyPlanned("1");
      setItemUnitPrice("0");
      queryClient.invalidateQueries({
        queryKey: ["package-detail", packageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-packages", projectId],
      });
    },
    onError: (err: Error) => {
      setItemActionError(err.message);
    },
  });

  // Mutasi hapus line item dari paket
  const removeItemMutation = useMutation({
    mutationFn: async (itemIdToRemove: string) => {
      const remainingItems = (pkg?.items || [])
        .filter((it) => it.id !== itemIdToRemove)
        .map((it) => ({
          itemId: it.itemId,
          qtyPlanned: Number(it.qtyPlanned),
          unitPrice: Number(it.unitPrice),
        }));

      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: remainingItems,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus item");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["package-detail", packageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-packages", projectId],
      });
    },
  });

  // Mutasi update status pembayaran
  const paymentMutation = useMutation({
    mutationFn: async () => {
      setPaymentMsg(null);
      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentStatus,
            paidAmount: parseFloat(paidAmount) || 0,
            paidDate: paidDate || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan pembayaran");
      return json.data;
    },
    onSuccess: () => {
      setPaymentMsg({
        text: "Status & data pembayaran berhasil disimpan",
        type: "success",
      });
      queryClient.invalidateQueries({
        queryKey: ["package-detail", packageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-packages", projectId],
      });
    },
    onError: (err: Error) => {
      setPaymentMsg({ text: err.message, type: "error" });
    },
  });

  // Mutasi tambah berkas dokumen paket
  const addDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!docFileUrl) {
        throw new Error("Berkas dokumen wajib diunggah terlebih dahulu");
      }
      setDocActionError(null);
      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType,
            docNumber: docNumber.trim() || undefined,
            docDate: docDate ? new Date(docDate).toISOString() : undefined,
            fileUrl: docFileUrl,
            notes: docNotes.trim() || undefined,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan dokumen paket");
      }
      return json.data;
    },
    onSuccess: () => {
      setDocNumber("");
      setDocFileUrl(null);
      setDocNotes("");
      queryClient.invalidateQueries({
        queryKey: ["package-detail", packageId],
      });
    },
    onError: (err: Error) => {
      setDocActionError(err.message);
    },
  });

  // Mutasi hapus berkas dokumen paket
  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      setDocActionError(null);
      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}/documents/${docId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menghapus dokumen paket");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["package-detail", packageId],
      });
    },
    onError: (err: Error) => {
      setDocActionError(err.message);
    },
  });

  if (!open) return null;

  const statusConfig = pkg ? PACKAGE_STATUS_CONFIG[pkg.status] : null;
  const paymentConfig = pkg ? PAYMENT_STATUS_CONFIG[pkg.paymentStatus] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          {isLoading || !pkg ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground">
                Memuat detail paket pengadaan...
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Paket */}
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <DialogTitle className="text-lg font-bold">
                        {pkg.packageName}
                      </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs">
                      Kategori:{" "}
                      <span className="font-semibold text-foreground">
                        {pkg.category}
                      </span>{" "}
                      · Bobot Proyek:{" "}
                      <span className="font-semibold text-foreground">
                        {pkg.weightPct}%
                      </span>{" "}
                      · Vendor:{" "}
                      <span className="font-semibold text-foreground">
                        {pkg.vendor?.name || pkg.vendorName || "Belum dipilih"}
                      </span>
                    </DialogDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {statusConfig && (
                      <Badge
                        variant="outline"
                        className={`text-xs px-2.5 py-1 ${statusConfig.badgeClass}`}
                      >
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`}
                        />
                        {statusConfig.label}
                      </Badge>
                    )}
                    {paymentConfig && (
                      <Badge
                        variant="outline"
                        className={`text-xs px-2.5 py-1 ${paymentConfig.badgeClass}`}
                      >
                        {paymentConfig.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Banner Peringatan Keterlambatan */}
              {pkg.deliveryDelayDays && pkg.deliveryDelayDays > 0 ? (
                <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Peringatan Keterlambatan: </span>
                    Pengiriman terlambat{" "}
                    <span className="font-bold underline">
                      {pkg.deliveryDelayDays} hari
                    </span>{" "}
                    dari estimasi kedatangan (
                    {formatDate(pkg.estDeliveryDate)}). Aktual tiba terakhir:{" "}
                    {formatDate(pkg.actualDeliveryDate)}.
                  </div>
                </div>
              ) : pkg.estDeliveryDate &&
                !pkg.actualDeliveryDate &&
                new Date() > new Date(pkg.estDeliveryDate) &&
                pkg.status !== "DELIVERED" ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Estimasi Tiba Terlewati: </span>
                    Estimasi kedatangan adalah {formatDate(pkg.estDeliveryDate)},
                    namun belum ada pengiriman fisik yang tercatat.
                  </div>
                </div>
              ) : null}

              {/* Tab Navigasi Internal Paket */}
              <Tabs defaultValue="items" className="space-y-4">
                <TabsList className="bg-muted/60 p-1">
                  <TabsTrigger value="items" className="text-xs">
                    <Package className="h-3.5 w-3.5 mr-1" />
                    Line Items ({pkg.items.length})
                  </TabsTrigger>
                  <TabsTrigger value="deliveries" className="text-xs">
                    <Truck className="h-3.5 w-3.5 mr-1" />
                    Timeline Kiriman ({pkg.deliveries.length})
                  </TabsTrigger>
                  <TabsTrigger value="payment" className="text-xs">
                    <CreditCard className="h-3.5 w-3.5 mr-1" />
                    Pembayaran
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Administrasi PR/PO
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">
                    <Paperclip className="h-3.5 w-3.5 mr-1" />
                    Dokumen ({pkg.documents?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: LINE ITEMS */}
                <TabsContent value="items" className="space-y-4">
                  {itemActionError && (
                    <div className="rounded-md bg-destructive/15 p-2.5 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>{itemActionError}</span>
                    </div>
                  )}

                  {/* Form Tambah Item dari Master */}
                  <div className="rounded-md border p-3 bg-muted/20 space-y-3">
                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Tambah Line Item dari
                      Master Material
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
                      <div className="md:col-span-5 space-y-1">
                        <Label className="text-[11px]">Pilih Master Material</Label>
                        <Select
                          value={selectedItemId}
                          onValueChange={handleSelectMasterItem}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih barang..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              -- Pilih Material --
                            </SelectItem>
                            {masterItems.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} ({m.itemCode}) — {m.uom?.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-[11px]">Kuantitas Rencana</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          className="h-8 text-xs"
                          value={itemQtyPlanned}
                          onChange={(e) => setItemQtyPlanned(e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-[11px]">Harga Satuan (Rp)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          className="h-8 text-xs"
                          value={itemUnitPrice}
                          onChange={(e) => setItemUnitPrice(e.target.value)}
                        />
                      </div>

                      <div className="md:col-span-1 flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 w-full"
                          onClick={() => addItemMutation.mutate()}
                          disabled={
                            addItemMutation.isPending ||
                            selectedItemId === "none"
                          }
                        >
                          {addItemMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Line Items */}
                  <div className="border rounded-md divide-y overflow-hidden text-xs">
                    <div className="grid grid-cols-12 bg-muted/60 p-2.5 font-semibold text-[11px] text-muted-foreground">
                      <div className="col-span-4">Material & Spesifikasi</div>
                      <div className="col-span-2 text-right">Qty Rencana</div>
                      <div className="col-span-2 text-right">Qty Diterima</div>
                      <div className="col-span-2 text-right">Harga Satuan</div>
                      <div className="col-span-2 text-right">Total Nilai</div>
                    </div>

                    {pkg.items.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-xs italic">
                        Belum ada line item material yang ditambahkan ke paket ini.
                      </div>
                    ) : (
                      pkg.items.map((it) => {
                        const planned = Number(it.qtyPlanned);
                        const received = Number(it.qtyReceived);
                        const pct =
                          planned > 0
                            ? Math.min(100, Math.round((received / planned) * 100))
                            : 0;

                        return (
                          <div
                            key={it.id}
                            className="grid grid-cols-12 items-center p-2.5 hover:bg-muted/20 transition-colors"
                          >
                            <div className="col-span-4 space-y-0.5">
                              <div className="font-semibold text-foreground">
                                {it.item.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {it.item.itemCode}{" "}
                                {it.item.specification
                                  ? `· ${it.item.specification}`
                                  : ""}
                              </div>
                            </div>

                            <div className="col-span-2 text-right font-medium">
                              {planned} {it.item.uom?.code || ""}
                            </div>

                            <div className="col-span-2 text-right">
                              <span
                                className={`font-semibold ${
                                  received >= planned
                                    ? "text-emerald-600"
                                    : received > 0
                                    ? "text-amber-600"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {received} {it.item.uom?.code || ""}
                              </span>
                              <div className="text-[10px] text-muted-foreground">
                                ({pct}% tiba)
                              </div>
                            </div>

                            <div className="col-span-2 text-right text-muted-foreground font-mono">
                              {formatCurrency(it.unitPrice)}
                            </div>

                            <div className="col-span-2 flex items-center justify-end gap-2">
                              <span className="font-semibold font-mono text-foreground">
                                {formatCurrency(it.totalPrice)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItemMutation.mutate(it.id)}
                                disabled={removeItemMutation.isPending}
                                title="Hapus item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Summary Footer Line Items */}
                  <div className="flex flex-wrap justify-between items-center rounded-md border p-3 bg-muted/30 text-xs">
                    <div className="text-muted-foreground">
                      Total Item:{" "}
                      <span className="font-semibold text-foreground">
                        {pkg.items.length} jenis
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        Total Terencana:{" "}
                        <span className="font-semibold text-foreground">
                          {pkg.items.reduce(
                            (acc, i) => acc + Number(i.qtyPlanned),
                            0
                          )}
                        </span>
                      </div>
                      <div>
                        Total Diterima:{" "}
                        <span className="font-semibold text-emerald-600">
                          {pkg.items.reduce(
                            (acc, i) => acc + Number(i.qtyReceived),
                            0
                          )}
                        </span>
                      </div>
                      <div className="font-semibold text-foreground">
                        Nilai PO: {formatCurrency(pkg.contractOrPoAmount)}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: TIMELINE PENGIRIMAN */}
                <TabsContent value="deliveries" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground text-xs">
                        Riwayat Kedatangan Barang (Deliveries)
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Mendukung pengiriman bertahap (kiriman ke-1, ke-2, ke-3,
                        dst).
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => setDeliveryDialogOpen(true)}
                      disabled={pkg.items.length === 0}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Catat Pengiriman Baru
                    </Button>
                  </div>

                  {pkg.items.length === 0 ? (
                    <div className="border border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
                      Tambahkan minimal 1 line item material sebelum dapat
                      mencatat pengiriman barang.
                    </div>
                  ) : pkg.deliveries.length === 0 ? (
                    <div className="border border-dashed rounded-md p-8 text-center space-y-2">
                      <Truck className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        Belum ada kedatangan barang yang dicatat untuk paket ini.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setDeliveryDialogOpen(true)}
                      >
                        Catat Kiriman Pertama
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pkg.deliveries.map((del, index) => {
                        const deliveryNumber = pkg.deliveries.length - index;
                        return (
                          <div
                            key={del.id}
                            className="border rounded-md p-3.5 bg-card hover:border-primary/40 transition-colors space-y-2.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className="text-[11px] font-semibold"
                                >
                                  Kiriman #{deliveryNumber}
                                </Badge>
                                <span className="font-semibold text-foreground flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatDate(del.deliveryDate)}
                                </span>
                                {del.deliveryOrderNo && (
                                  <span className="text-muted-foreground font-mono text-[11px]">
                                    (DO: {del.deliveryOrderNo})
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                Dicatat:{" "}
                                {new Date(del.createdAt).toLocaleTimeString(
                                  "id-ID",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                              </span>
                            </div>

                            {del.notes && (
                              <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded">
                                <span className="font-medium text-foreground">
                                  Catatan:{" "}
                                </span>
                                {del.notes}
                              </div>
                            )}

                            {/* Rincian item yang diterima dalam pengiriman ini */}
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-muted-foreground">
                                Kuantitas Diterima:
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {del.items.map((it) => (
                                  <div
                                    key={it.id}
                                    className="rounded border p-1.5 bg-muted/10 flex justify-between items-center text-[11px]"
                                  >
                                    <span className="truncate pr-2 font-medium">
                                      {it.packageItem?.item.name || "Item"}
                                    </span>
                                    <span className="font-bold text-emerald-600 shrink-0">
                                      +{Number(it.qtyReceived)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* TAB 3: PEMBAYARAN PAKET */}
                <TabsContent value="payment" className="space-y-4">
                  <div className="rounded-md border p-4 bg-muted/20 space-y-4 text-xs">
                    <div>
                      <h4 className="font-semibold text-foreground text-xs">
                        Pencatatan Pembayaran Paket
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Sesuai aturan B8, status pembayaran tidak menghambat
                        transisi proyek ke BAST.
                      </p>
                    </div>

                    {paymentMsg && (
                      <div
                        className={`rounded-md p-2.5 text-xs flex items-center gap-2 ${
                          paymentMsg.type === "success"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {paymentMsg.type === "success" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <span>{paymentMsg.text}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Status Pembayaran</Label>
                        <Select
                          value={paymentStatus}
                          onValueChange={(val) =>
                            setPaymentStatus(val as PaymentStatus)
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Pilih status bayar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PaymentStatus.BELUM_LUNAS}>
                              Belum Lunas
                            </SelectItem>
                            <SelectItem value={PaymentStatus.DALAM_PROSES}>
                              Dalam Proses
                            </SelectItem>
                            <SelectItem value={PaymentStatus.LUNAS}>
                              Lunas
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="paidAmount" className="text-xs">
                          Jumlah Dibayar (Rp)
                        </Label>
                        <Input
                          id="paidAmount"
                          type="number"
                          min="0"
                          step="any"
                          className="h-9 text-xs font-mono"
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="paidDate" className="text-xs">
                          Tanggal Pembayaran
                        </Label>
                        <Input
                          id="paidDate"
                          type="date"
                          className="h-9 text-xs"
                          value={paidDate}
                          onChange={(e) => setPaidDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => paymentMutation.mutate()}
                        disabled={paymentMutation.isPending}
                        className="text-xs"
                      >
                        {paymentMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            Simpan Pembayaran
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 4: ADMINISTRASI PR & PO */}
                <TabsContent value="admin" className="space-y-4">
                  <div className="rounded-md border p-4 bg-muted/20 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground text-xs">
                        Data Administrasi & Jadwal
                      </h4>
                      {onEditPackageClick && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={onEditPackageClick}
                        >
                          Ubah Data Paket
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Nomor PR / USPK:
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {pkg.noPrUspk || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Tanggal PR:
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(pkg.prUspkDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Nomor PO / SPK:
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {pkg.noPoSpk || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Tanggal PO:
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(pkg.poSpkDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Estimasi Tiba:
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(pkg.estDeliveryDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Aktual Tiba:
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(pkg.actualDeliveryDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Rencana Mulai (Gantt):
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(pkg.planStartDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Rencana Selesai (Gantt):
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(pkg.planEndDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          PIC Lapangan:
                        </span>
                        <span className="font-semibold text-foreground">
                          {pkg.picName || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Nilai Kontrak/PO:
                        </span>
                        <span className="font-semibold text-foreground font-mono">
                          {formatCurrency(pkg.contractOrPoAmount)}
                        </span>
                      </div>
                    </div>

                    {pkg.remarks && (
                      <div className="border-t pt-2 mt-2">
                        <span className="text-muted-foreground block text-[11px]">
                          Catatan / Remarks:
                        </span>
                        <p className="text-foreground text-xs mt-0.5">
                          {pkg.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* TAB 5: DOKUMEN PR / PO / DO / INVOICE */}
                <TabsContent value="documents" className="space-y-4">
                  {docActionError && (
                    <div className="rounded-md bg-destructive/15 p-2.5 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>{docActionError}</span>
                    </div>
                  )}

                  {/* Form Tambah Dokumen */}
                  <div className="rounded-md border p-3.5 bg-muted/20 space-y-3">
                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-primary" />
                      Unggah Dokumen Paket Pengadaan
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Tipe Dokumen</Label>
                        <Select
                          value={docType}
                          onValueChange={(val) => setDocType(val as PackageDocType)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih tipe" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PackageDocType.PR}>Purchase Requisition (PR)</SelectItem>
                            <SelectItem value={PackageDocType.PO}>Purchase Order (PO)</SelectItem>
                            <SelectItem value={PackageDocType.DO}>Delivery Order (DO)</SelectItem>
                            <SelectItem value={PackageDocType.INVOICE}>Invoice / Tagihan</SelectItem>
                            <SelectItem value={PackageDocType.OTHER}>Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="docNumber" className="text-[11px]">
                          Nomor Dokumen
                        </Label>
                        <Input
                          id="docNumber"
                          placeholder="Misal: PO/WM/2026/042"
                          className="h-8 text-xs font-mono"
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="docDate" className="text-[11px]">
                          Tanggal Dokumen
                        </Label>
                        <Input
                          id="docDate"
                          type="date"
                          className="h-8 text-xs"
                          value={docDate}
                          onChange={(e) => setDocDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="docNotes" className="text-[11px]">
                        Catatan Dokumen (Opsional)
                      </Label>
                      <Input
                        id="docNotes"
                        placeholder="Keterangan singkat berkas..."
                        className="h-8 text-xs"
                        value={docNotes}
                        onChange={(e) => setDocNotes(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Berkas Dokumen (PDF, XLSX, atau Foto)</Label>
                      <FileUploadButton
                        value={docFileUrl}
                        onChange={setDocFileUrl}
                        folder="packages"
                        accept="application/pdf,image/*,.xlsx,.xls"
                        label="Pilih & Unggah Dokumen"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => addDocumentMutation.mutate()}
                        disabled={addDocumentMutation.isPending || !docFileUrl}
                      >
                        {addDocumentMutation.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Simpan Dokumen
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Daftar Dokumen yang Tersimpan */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground text-xs">
                      Daftar Berkas Terlampir ({pkg.documents?.length || 0})
                    </h4>

                    {(!pkg.documents || pkg.documents.length === 0) ? (
                      <div className="border border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
                        Belum ada dokumen yang diunggah untuk paket kerja ini.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pkg.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between gap-3 rounded-md border p-3 bg-muted/10 text-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge variant="outline" className="text-[10px] shrink-0 font-semibold">
                                {doc.docType}
                              </Badge>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground font-mono truncate">
                                    {doc.docNumber || "Tanpa Nomor Dokumen"}
                                  </span>
                                  {doc.docDate && (
                                    <span className="text-[11px] text-muted-foreground">
                                      ({formatDate(doc.docDate)})
                                    </span>
                                  )}
                                </div>
                                {doc.notes && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {doc.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="h-7 px-2 text-xs gap-1"
                              >
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Buka Dokumen di Tab Baru"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Buka File
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteDocumentMutation.mutate(doc.id)}
                                disabled={deleteDocumentMutation.isPending}
                                title="Hapus dokumen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Kedatangan Barang */}
      {pkg && (
        <DeliveryFormDialog
          projectId={projectId}
          packageId={pkg.id}
          packageName={pkg.packageName}
          items={pkg.items}
          open={deliveryDialogOpen}
          onOpenChange={setDeliveryDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["package-detail", packageId],
            });
            queryClient.invalidateQueries({
              queryKey: ["project-packages", projectId],
            });
          }}
        />
      )}
    </>
  );
}
