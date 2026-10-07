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
import { VendorInput, vendorSchema } from "@/lib/validations/master";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackageCategory } from "@prisma/client";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: VendorInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    name: string;
    category: PackageCategory;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    isActive: boolean;
  } | null;
}

export function VendorDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: VendorDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      category: PackageCategory.MATERIAL,
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        category: initialData.category,
        contactPerson: initialData.contactPerson || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        address: initialData.address || "",
        isActive: initialData.isActive,
      });
    } else {
      reset({
        name: "",
        category: PackageCategory.MATERIAL,
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset]);

  const handleFormSubmit = async (data: VendorInput) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({ ...data, id: initialData?.id });
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Ubah Rekanan / Vendor" : "Tambah Rekanan / Vendor"}
          </DialogTitle>
          <DialogDescription>
            Informasi rekanan pengadaan material, fabrikasi, sewa alat berat, atau kontraktor.
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
              <Label htmlFor="name">Nama Vendor *</Label>
              <Input
                id="name"
                placeholder="PT / CV Sumber Berkah"
                disabled={isSubmitting}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>Kategori Pengadaan *</Label>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Nama Kontak (PIC)</Label>
              <Input
                id="contactPerson"
                placeholder="Nama perwakilan"
                disabled={isSubmitting}
                {...register("contactPerson")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor Telepon</Label>
              <Input
                id="phone"
                placeholder="0812xxxxxxx"
                disabled={isSubmitting}
                {...register("phone")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="kontak@vendor.com"
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Alamat Operasional</Label>
            <Textarea
              id="address"
              placeholder="Alamat kantor / gudang..."
              rows={2}
              disabled={isSubmitting}
              {...register("address")}
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
              Status Vendor Aktif
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
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
