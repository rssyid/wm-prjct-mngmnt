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
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Truck } from "lucide-react";
import React, { useEffect, useState } from "react";

interface DeliveryItemInfo {
  id: string;
  qtyPlanned: number | string;
  qtyReceived: number | string;
  item: {
    name: string;
    itemCode: string;
    uom?: { code: string; name: string } | null;
  };
}

interface DeliveryFormDialogProps {
  projectId: string;
  packageId: string;
  packageName: string;
  items: DeliveryItemInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeliveryFormDialog({
  projectId,
  packageId,
  packageName,
  items,
  open,
  onOpenChange,
  onSuccess,
}: DeliveryFormDialogProps) {
  const queryClient = useQueryClient();
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [deliveryOrderNo, setDeliveryOrderNo] = useState("");
  const [notes, setNotes] = useState("");
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {}
  );
  const [manualDeliveredOverride, setManualDeliveredOverride] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDeliveryDate(new Date().toISOString().split("T")[0]);
      setDeliveryOrderNo("");
      setNotes("");
      setManualDeliveredOverride(false);
      setRemarks("");
      setErrorMessage(null);

      // Inisialisasi kuantitas yang belum diterima sebagai default
      const initialQtys: Record<string, number> = {};
      items.forEach((it) => {
        const remaining = Math.max(
          0,
          Number(it.qtyPlanned) - Number(it.qtyReceived)
        );
        initialQtys[it.id] = remaining;
      });
      setItemQuantities(initialQtys);
    }
  }, [open, items]);

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);

      if (manualDeliveredOverride && (!remarks || !remarks.trim())) {
        throw new Error(
          "Alasan (remarks) wajib diisi saat melakukan override manual ke DELIVERED"
        );
      }

      const payloadItems = items.map((it) => ({
        packageItemId: it.id,
        qtyReceived: Number(itemQuantities[it.id]) || 0,
      }));

      const res = await fetch(
        `/api/projects/${projectId}/packages/${packageId}/deliveries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveryDate,
            deliveryOrderNo: deliveryOrderNo.trim() || null,
            notes: notes.trim() || null,
            items: payloadItems,
            manualDeliveredOverride,
            remarks: remarks.trim() || null,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mencatat pengiriman barang");
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
      queryClient.invalidateQueries({
        queryKey: ["package-detail", packageId],
      });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const handleQtyChange = (itemId: string, value: number | null) => {
    setItemQuantities((prev) => ({
      ...prev,
      [itemId]: value !== null && !isNaN(value) ? Math.max(0, value) : 0,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg">
              Catat Kedatangan Barang
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Paket: <span className="font-semibold">{packageName}</span> (Kedatangan
            Berulang / Multi-Delivery)
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
            <div className="space-y-1.5">
              <Label htmlFor="deliveryDate" className="text-xs">
                Tanggal Kedatangan / Tiba *
              </Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deliveryOrderNo" className="text-xs">
                Nomor Surat Jalan / DO
              </Label>
              <Input
                id="deliveryOrderNo"
                placeholder="misal: DO/VND/2026/042"
                value={deliveryOrderNo}
                onChange={(e) => setDeliveryOrderNo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deliveryNotes" className="text-xs">
              Catatan Pengiriman / Kondisi Fisik
            </Label>
            <Textarea
              id="deliveryNotes"
              placeholder="Catat jika ada barang rusak, cacat minor, atau informasi sopir/armada..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Tabel Input Item yang Diterima */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Rincian Kuantitas Fisik Diterima (Item Paket)
            </Label>
            {items.length === 0 ? (
              <p className="text-muted-foreground italic text-xs py-2">
                Paket ini belum memiliki line items material.
              </p>
            ) : (
              <div className="border rounded-md divide-y overflow-hidden">
                <div className="grid grid-cols-12 bg-muted/50 p-2.5 font-medium text-[11px] text-muted-foreground">
                  <div className="col-span-5">Nama Material</div>
                  <div className="col-span-2 text-right">Rencana</div>
                  <div className="col-span-2 text-right">Sudah Tiba</div>
                  <div className="col-span-3 text-right">Tiba Sekarang</div>
                </div>
                {items.map((it) => {
                  const planned = Number(it.qtyPlanned);
                  const received = Number(it.qtyReceived);
                  const remaining = Math.max(0, planned - received);

                  return (
                    <div
                      key={it.id}
                      className="grid grid-cols-12 items-center p-2.5 text-xs gap-2"
                    >
                      <div className="col-span-5">
                        <div className="font-semibold text-foreground">
                          {it.item.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {it.item.itemCode}
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-medium">
                        {planned} {it.item.uom?.code || ""}
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground">
                        {received}
                        <span className="block text-[10px] text-amber-600">
                          (sisa {remaining})
                        </span>
                      </div>
                      <div className="col-span-3 text-right">
                        <FormattedNumberInput
                          allowDecimals
                          className="h-8 text-right font-medium text-xs"
                          value={itemQuantities[it.id] ?? 0}
                          onChange={(val) => handleQtyChange(it.id, val)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Opsi Override Manual */}
          <div className="rounded-md border p-3 bg-muted/20 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="overrideDelivered"
                checked={manualDeliveredOverride}
                onChange={(e) => setManualDeliveredOverride(e.target.checked)}
                className="rounded border-gray-300 h-4 w-4 text-primary focus:ring-primary"
              />
              <Label
                htmlFor="overrideDelivered"
                className="text-xs cursor-pointer font-medium"
              >
                Override Manual: Set status paket langsung ke{" "}
                <span className="font-semibold text-emerald-600">DELIVERED</span>{" "}
                (Tiba Lengkap)
              </Label>
            </div>
            {manualDeliveredOverride && (
              <div className="pl-6 space-y-1.5 pt-1">
                <Label htmlFor="remarks" className="text-[11px] text-amber-700">
                  Alasan Override Manual (Wajib sesuai aturan B7) *
                </Label>
                <Input
                  id="remarks"
                  placeholder="Contoh: Toleransi selisih 2% disetujui, PO ditutup selesai"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>
            )}
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
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Simpan Kedatangan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
