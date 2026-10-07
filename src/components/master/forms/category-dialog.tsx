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
import { FolderCategoryInput, folderCategorySchema } from "@/lib/validations/master";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FolderCategoryInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    isActive: boolean;
  } | null;
}

export function CategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: CategoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FolderCategoryInput>({
    resolver: zodResolver(folderCategorySchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      icon: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        description: initialData.description || "",
        icon: initialData.icon || "",
        isActive: initialData.isActive,
      });
    } else {
      reset({
        code: "",
        name: "",
        description: "",
        icon: "",
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset]);

  const handleFormSubmit = async (data: FolderCategoryInput) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({ ...data, id: initialData?.id });
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan kategori");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Ubah Kategori Proyek" : "Tambah Kategori Proyek"}
          </DialogTitle>
          <DialogDescription>
            Klasifikasi pengelompokan struktur dan dokumen proyek (Folder Category).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs rounded-md bg-destructive/15 text-destructive font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">Kode Kategori *</Label>
            <Input
              id="code"
              placeholder="Contoh: WCS, DRG, CUL"
              disabled={isSubmitting}
              {...register("code")}
            />
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nama Kategori *</Label>
            <Input
              id="name"
              placeholder="Contoh: Water Control Structure"
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Input
              id="description"
              placeholder="Keterangan kategori..."
              disabled={isSubmitting}
              {...register("description")}
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
              Status Aktif
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
