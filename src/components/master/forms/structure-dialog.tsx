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
import {
  StructureTypeInput,
  structureTypeSchema,
  StructureVariantInput,
  structureVariantSchema,
} from "@/lib/validations/master";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

// 1. StructureType Dialog
interface StructureTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StructureTypeInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
  } | null;
}

export function StructureTypeDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: StructureTypeDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StructureTypeInput>({
    resolver: zodResolver(structureTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        description: initialData.description || "",
        isActive: initialData.isActive,
      });
    } else {
      reset({
        name: "",
        description: "",
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset]);

  const handleFormSubmit = async (data: StructureTypeInput) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({ ...data, id: initialData?.id });
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan tipe struktur");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Ubah Tipe Struktur" : "Tambah Tipe Struktur"}
          </DialogTitle>
          <DialogDescription>
            Klasifikasi tipe bangunan fisik (contoh: Pintu Air, Gorong-gorong, Jembatan).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs rounded-md bg-destructive/15 text-destructive font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="st-name">Nama Tipe Struktur *</Label>
            <Input
              id="st-name"
              placeholder="Contoh: Pintu Air"
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="st-desc">Deskripsi</Label>
            <Input
              id="st-desc"
              placeholder="Keterangan tipe bangunan..."
              disabled={isSubmitting}
              {...register("description")}
            />
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
              {isSubmitting ? "Menyimpan..." : "Simpan Tipe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 2. StructureVariant Dialog with BOQ Template Items
interface StructureVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StructureVariantInput & { id?: string }) => Promise<void>;
  structureTypes: Array<{ id: string; name: string }>;
  initialData?: {
    id: string;
    structureTypeId: string;
    code: string;
    name: string;
    description?: string | null;
    defaultBoqItems?: Array<{ itemCode: string; name: string; uom: string; qty: number }> | null;
    isActive: boolean;
  } | null;
}

export function StructureVariantDialog({
  open,
  onOpenChange,
  onSubmit,
  structureTypes,
  initialData,
}: StructureVariantDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<StructureVariantInput>({
    resolver: zodResolver(structureVariantSchema),
    defaultValues: {
      structureTypeId: "",
      code: "",
      name: "",
      description: "",
      defaultBoqItems: [],
      isActive: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "defaultBoqItems" as never,
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        structureTypeId: initialData.structureTypeId,
        code: initialData.code,
        name: initialData.name,
        description: initialData.description || "",
        defaultBoqItems: initialData.defaultBoqItems || [],
        isActive: initialData.isActive,
      });
    } else {
      reset({
        structureTypeId: structureTypes[0]?.id || "",
        code: "",
        name: "",
        description: "",
        defaultBoqItems: [
          { itemCode: "MAT-GAL-001", name: "Galian Tanah", uom: "m3", qty: 10 },
        ],
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset, structureTypes]);

  const handleFormSubmit = async (data: StructureVariantInput) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({ ...data, id: initialData?.id });
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan varian struktur");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Ubah Varian Struktur & Template BOQ" : "Tambah Varian Struktur & Template BOQ"}
          </DialogTitle>
          <DialogDescription>
            Spesifikasi dimensi struktur dan template Bill of Quantities (BOQ) bawaan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 text-xs rounded-md bg-destructive/15 text-destructive font-medium border border-destructive/20">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipe Struktur Induk *</Label>
            <Controller
              name="structureTypeId"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe struktur" />
                  </SelectTrigger>
                  <SelectContent>
                    {structureTypes.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.structureTypeId && (
              <p className="text-xs text-destructive">{errors.structureTypeId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="v-code">Kode Varian *</Label>
              <Input
                id="v-code"
                placeholder="Contoh: PA-SRG-1M"
                disabled={isSubmitting}
                {...register("code")}
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="v-name">Nama Varian *</Label>
              <Input
                id="v-name"
                placeholder="Contoh: Pintu Air Sorong 1 m"
                disabled={isSubmitting}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="v-desc">Spesifikasi / Deskripsi</Label>
            <Input
              id="v-desc"
              placeholder="Keterangan dimensi teknis..."
              disabled={isSubmitting}
              {...register("description")}
            />
          </div>

          {/* Template BOQ Items Editor */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Item Template BOQ Bawaan ({fields.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  append({ itemCode: "MAT-NEW", name: "Item Baru", uom: "unit", qty: 1 } as never)
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Tambah Baris BOQ
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-2 items-center bg-muted/40 p-2 rounded-md border border-border"
                >
                  <div className="col-span-3">
                    <Input
                      placeholder="Kode"
                      className="h-8 text-xs font-mono"
                      {...register(`defaultBoqItems.${index}.itemCode` as never)}
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      placeholder="Nama Material"
                      className="h-8 text-xs"
                      {...register(`defaultBoqItems.${index}.name` as never)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Satuan"
                      className="h-8 text-xs"
                      {...register(`defaultBoqItems.${index}.uom` as never)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="any"
                      placeholder="Qty"
                      className="h-8 text-xs tabular-nums"
                      {...register(`defaultBoqItems.${index}.qty` as never)}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Hapus item BOQ varian"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
              {isSubmitting ? "Menyimpan..." : "Simpan Varian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
