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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ItemInput, itemSchema } from "@/lib/validations/master";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackageCategory } from "@prisma/client";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ItemInput & { id?: string }) => Promise<void>;
  uomList: Array<{ id: string; code: string; name: string }>;
  initialData?: {
    id: string;
    itemCode: string;
    name: string;
    category: PackageCategory;
    uomId: string;
    specification?: string | null;
    standardPrice: number | string;
    isActive: boolean;
  } | null;
}

export function ItemDialog({
  open,
  onOpenChange,
  onSubmit,
  uomList,
  initialData,
}: ItemDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      itemCode: "",
      name: "",
      category: PackageCategory.MATERIAL,
      uomId: "",
      specification: "",
      standardPrice: 0,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        itemCode: initialData.itemCode,
        name: initialData.name,
        category: initialData.category,
        uomId: initialData.uomId,
        specification: initialData.specification || "",
        standardPrice: Number(initialData.standardPrice) || 0,
        isActive: initialData.isActive,
      });
    } else {
      reset({
        itemCode: "",
        name: "",
        category: PackageCategory.MATERIAL,
        uomId: uomList[0]?.id || "",
        specification: "",
        standardPrice: 0,
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset, uomList]);

  const handleFormSubmit = async (data: ItemInput) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({ ...data, id: initialData?.id });
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan item material");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Ubah Item Material" : "Tambah Item Material Baru"}
          </DialogTitle>
          <DialogDescription>
            Katalog barang, material konstruksi, komponen fabrikasi, atau jasa swakelola.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs rounded-md bg-destructive/15 text-destructive font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="itemCode">Kode Item *</Label>
              <Input
                id="itemCode"
                placeholder="MAT-BTN-225"
                className="font-mono"
                disabled={isSubmitting}
                {...register("itemCode")}
              />
              {errors.itemCode && (
                <p className="text-xs text-destructive">{errors.itemCode.message}</p>
              )}
            </div>

            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="name">Nama Item / Material *</Label>
              <Input
                id="name"
                placeholder="Beton K-225"
                disabled={isSubmitting}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>Kategori Paket *</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PackageCategory.MATERIAL}>MATERIAL</SelectItem>
                      <SelectItem value={PackageCategory.FABRICATION}>FABRICATION</SelectItem>
                      <SelectItem value={PackageCategory.CONTRACTOR}>CONTRACTOR</SelectItem>
                      <SelectItem value={PackageCategory.HEAVY_EQUIPMENT}>HEAVY_EQUIPMENT</SelectItem>
                      <SelectItem value={PackageCategory.SWAKELOLA}>SWAKELOLA</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>Satuan Ukuran (UoM) *</Label>
              <Controller
                name="uomId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih satuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {uomList.map((uom) => (
                        <SelectItem key={uom.id} value={uom.id}>
                          {uom.name} ({uom.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.uomId && (
                <p className="text-xs text-destructive">{errors.uomId.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="standardPrice">Harga Standar (Rp)</Label>
            <Controller
              control={control}
              name="standardPrice"
              render={({ field }) => (
                <FormattedNumberInput
                  id="standardPrice"
                  prefix="Rp "
                  placeholder="0"
                  disabled={isSubmitting}
                  value={field.value}
                  onChange={(val) => field.onChange(val ?? 0)}
                />
              )}
            />
            {errors.standardPrice && (
              <p className="text-xs text-destructive">{errors.standardPrice.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specification">Spesifikasi Teknis</Label>
            <Textarea
              id="specification"
              placeholder="Rincian dimensi, mutu, atau standar teknis..."
              rows={2}
              disabled={isSubmitting}
              {...register("specification")}
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              {...register("isActive")}
            />
            <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
              Status Item Aktif
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
