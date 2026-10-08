"use client";

import { Button } from "@/components/ui/button";
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
import { PackageCategory } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, PackagePlus } from "lucide-react";
import React, { useEffect, useState } from "react";

interface PackageFormDialogProps {
  projectId: string;
  packageId?: string; // Jika terisi = mode Edit
  initialData?: {
    packageName?: string;
    category?: PackageCategory;
    vendorId?: string | null;
    vendorName?: string | null;
    picName?: string | null;
    weightPct?: number;
    noPrUspk?: string | null;
    prUspkDate?: string | null;
    noPoSpk?: string | null;
    poSpkDate?: string | null;
    estDeliveryDate?: string | null;
    planStartDate?: string | null;
    planEndDate?: string | null;
    contractOrPoAmount?: number | string;
    remarks?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CATEGORY_OPTIONS: { label: string; value: PackageCategory }[] = [
  { label: "Material", value: PackageCategory.MATERIAL },
  { label: "Fabrikasi", value: PackageCategory.FABRICATION },
  { label: "Kontraktor", value: PackageCategory.CONTRACTOR },
  { label: "Alat Berat", value: PackageCategory.HEAVY_EQUIPMENT },
  { label: "Swakelola", value: PackageCategory.SWAKELOLA },
];

export function PackageFormDialog({
  projectId,
  packageId,
  initialData,
  open,
  onOpenChange,
  onSuccess,
}: PackageFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(packageId);

  const [packageName, setPackageName] = useState("");
  const [category, setCategory] = useState<PackageCategory>(
    PackageCategory.MATERIAL
  );
  const [vendorId, setVendorId] = useState<string>("none");
  const [picName, setPicName] = useState("");
  const [weightPct, setWeightPct] = useState<string>("0");
  const [noPrUspk, setNoPrUspk] = useState("");
  const [prUspkDate, setPrUspkDate] = useState("");
  const [noPoSpk, setNoPoSpk] = useState("");
  const [poSpkDate, setPoSpkDate] = useState("");
  const [estDeliveryDate, setEstDeliveryDate] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planEndDate, setPlanEndDate] = useState("");
  const [contractOrPoAmount, setContractOrPoAmount] = useState<string>("0");
  const [remarks, setRemarks] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambil daftar vendor dari master
  const { data: vendorData } = useQuery<{
    success: boolean;
    data: { id: string; name: string }[];
  }>({
    queryKey: ["master-vendors"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=vendor");
      if (!res.ok) throw new Error("Gagal mengambil daftar vendor");
      return res.json();
    },
    enabled: open,
  });

  const vendors = vendorData?.data || [];

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      if (initialData) {
        setPackageName(initialData.packageName || "");
        setCategory(initialData.category || PackageCategory.MATERIAL);
        setVendorId(initialData.vendorId || "none");
        setPicName(initialData.picName || "");
        setWeightPct(String(initialData.weightPct ?? 0));
        setNoPrUspk(initialData.noPrUspk || "");
        setPrUspkDate(
          initialData.prUspkDate
            ? new Date(initialData.prUspkDate).toISOString().split("T")[0]
            : ""
        );
        setNoPoSpk(initialData.noPoSpk || "");
        setPoSpkDate(
          initialData.poSpkDate
            ? new Date(initialData.poSpkDate).toISOString().split("T")[0]
            : ""
        );
        setEstDeliveryDate(
          initialData.estDeliveryDate
            ? new Date(initialData.estDeliveryDate).toISOString().split("T")[0]
            : ""
        );
        setPlanStartDate(
          initialData.planStartDate
            ? new Date(initialData.planStartDate).toISOString().split("T")[0]
            : ""
        );
        setPlanEndDate(
          initialData.planEndDate
            ? new Date(initialData.planEndDate).toISOString().split("T")[0]
            : ""
        );
        setContractOrPoAmount(String(initialData.contractOrPoAmount ?? 0));
        setRemarks(initialData.remarks || "");
      } else {
        setPackageName("");
        setCategory(PackageCategory.MATERIAL);
        setVendorId("none");
        setPicName("");
        setWeightPct("0");
        setNoPrUspk("");
        setPrUspkDate("");
        setNoPoSpk("");
        setPoSpkDate("");
        setEstDeliveryDate("");
        setPlanStartDate("");
        setPlanEndDate("");
        setContractOrPoAmount("0");
        setRemarks("");
      }
    }
  }, [open, initialData]);

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);

      // Validasi tanggal di client
      if (prUspkDate && poSpkDate) {
        const dPr = new Date(prUspkDate);
        const dPo = new Date(poSpkDate);
        if (dPr > dPo) {
          throw new Error(
            "Tanggal PR/USPK harus lebih awal atau sama dengan tanggal PO/SPK"
          );
        }
      }

      if (planStartDate && planEndDate) {
        const dStart = new Date(planStartDate);
        const dEnd = new Date(planEndDate);
        if (dStart > dEnd) {
          throw new Error(
            "Estimasi tanggal mulai harus lebih awal atau sama dengan estimasi tanggal selesai"
          );
        }
      }

      const selectedVendor = vendors.find((v) => v.id === vendorId);
      const payload = {
        packageName: packageName.trim(),
        category,
        vendorId: vendorId === "none" ? null : vendorId,
        vendorName: selectedVendor ? selectedVendor.name : null,
        picName: picName.trim() || null,
        weightPct: parseFloat(weightPct) || 0,
        noPrUspk: noPrUspk.trim() || null,
        prUspkDate: prUspkDate || null,
        noPoSpk: noPoSpk.trim() || null,
        poSpkDate: poSpkDate || null,
        estDeliveryDate: estDeliveryDate || null,
        planStartDate: planStartDate || null,
        planEndDate: planEndDate || null,
        contractOrPoAmount: parseFloat(contractOrPoAmount) || 0,
        remarks: remarks.trim() || null,
      };

      const url = isEdit
        ? `/api/projects/${projectId}/packages/${packageId}`
        : `/api/projects/${projectId}/packages`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan paket pengadaan");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-packages", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-detail", projectId],
      });
      if (packageId) {
        queryClient.invalidateQueries({
          queryKey: ["package-detail", packageId],
        });
      }
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg">
              {isEdit ? "Edit Informasi Paket Pengadaan" : "Tambah Paket Pengadaan"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Perbarui nomor PR/PO, jadwal kedatangan, atau bobot paket."
              : "Buat paket material, fabrikasi, kontraktor, atau alat berat baru."}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="packageName" className="text-xs">
                Nama Paket Pengadaan *
              </Label>
              <Input
                id="packageName"
                placeholder="misal: Pengadaan Semen & Material Cor Box Culvert"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Kategori Paket *</Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as PackageCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="weightPct" className="text-xs">
                Bobot Proyek (% dari Total 100) *
              </Label>
              <Input
                id="weightPct"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={weightPct}
                onChange={(e) => setWeightPct(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mitra / Vendor</Label>
              <Select value={vendorId} onValueChange={(val) => setVendorId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Tanpa Vendor Terdaftar --</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="picName" className="text-xs">
                Nama PIC Lapangan / Pengawas
              </Label>
              <Input
                id="picName"
                placeholder="misal: Budi Santoso"
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
              />
            </div>
          </div>

          {/* Bagian Tahap PR & PO */}
          <div className="rounded-md border p-3 bg-muted/20 space-y-3">
            <h4 className="font-semibold text-foreground text-xs">
              Tahap Administrasi (PR & PO)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="noPrUspk" className="text-xs">
                  Nomor PR / USPK
                </Label>
                <Input
                  id="noPrUspk"
                  placeholder="PR/WM/2026/0129"
                  value={noPrUspk}
                  onChange={(e) => setNoPrUspk(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prUspkDate" className="text-xs">
                  Tanggal PR / USPK
                </Label>
                <Input
                  id="prUspkDate"
                  type="date"
                  value={prUspkDate}
                  onChange={(e) => setPrUspkDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="noPoSpk" className="text-xs">
                  Nomor PO / SPK
                </Label>
                <Input
                  id="noPoSpk"
                  placeholder="PO/WM/2026/0088"
                  value={noPoSpk}
                  onChange={(e) => setNoPoSpk(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="poSpkDate" className="text-xs">
                  Tanggal PO / SPK
                </Label>
                <Input
                  id="poSpkDate"
                  type="date"
                  value={poSpkDate}
                  onChange={(e) => setPoSpkDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contractOrPoAmount" className="text-xs">
                  Nilai Kontrak / PO (Rp)
                </Label>
                <Input
                  id="contractOrPoAmount"
                  type="number"
                  min="0"
                  step="any"
                  value={contractOrPoAmount}
                  onChange={(e) => setContractOrPoAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="estDeliveryDate" className="text-xs">
                  Estimasi Tanggal Tiba (Est. Delivery)
                </Label>
                <Input
                  id="estDeliveryDate"
                  type="date"
                  value={estDeliveryDate}
                  onChange={(e) => setEstDeliveryDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Bagian Jadwal Pelaksanaan (Gantt Chart) */}
          <div className="rounded-md border p-3 bg-muted/20 space-y-3">
            <div>
              <h4 className="font-semibold text-foreground text-xs">
                Jadwal Pelaksanaan (Gantt Chart)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Estimasi periode mulai dan selesai pengerjaan paket untuk timeline Gantt.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="planStartDate" className="text-xs">
                  Estimasi Tanggal Mulai (Plan Start)
                </Label>
                <Input
                  id="planStartDate"
                  type="date"
                  value={planStartDate}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="planEndDate" className="text-xs">
                  Estimasi Tanggal Selesai (Plan End)
                </Label>
                <Input
                  id="planEndDate"
                  type="date"
                  value={planEndDate}
                  onChange={(e) => setPlanEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="packageRemarks" className="text-xs">
              Catatan / Remarks
            </Label>
            <Textarea
              id="packageRemarks"
              placeholder="Catatan spesifik pengadaan..."
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !packageName.trim()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                {isEdit ? "Simpan Perubahan" : "Buat Paket"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
