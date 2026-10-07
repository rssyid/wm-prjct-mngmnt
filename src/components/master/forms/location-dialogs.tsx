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
import { Switch } from "@/components/ui/switch";
import {
  BlockInput,
  blockSchema,
  CompanyInput,
  companySchema,
  EstateInput,
  estateSchema,
  RegionInput,
  regionSchema,
} from "@/lib/validations/master";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

// -----------------------------------------------------------------------------
// 1. Region Dialog
// -----------------------------------------------------------------------------
interface RegionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RegionInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
}

export function RegionDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: RegionDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<RegionInput>({
    resolver: zodResolver(regionSchema),
    defaultValues: {
      code: "",
      name: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        isActive: initialData.isActive,
      });
    } else {
      reset({
        code: "",
        name: "",
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset]);

  const onFormSubmit = async (values: RegionInput) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({ ...values, id: initialData?.id });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan Region";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {initialData ? "Ubah Region" : "Tambah Region Baru"}
            </DialogTitle>
            <DialogDescription>
              Region merupakan kelompok wilayah tingkat teratas (contoh: REG-SUMATERA, REG-KALIMANTAN).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reg-code" className="text-xs">
                Kode Region <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reg-code"
                placeholder="cth: REG-SUMUT"
                className="uppercase font-mono text-xs"
                {...register("code")}
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-name" className="text-xs">
                Nama Region <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reg-name"
                placeholder="cth: Sumatera Utara & Aceh"
                className="text-xs"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label htmlFor="reg-active" className="text-xs font-medium">
                  Status Aktif
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Region aktif dapat digunakan saat pembuatan entitas perusahaan.
                </p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="reg-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
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

// -----------------------------------------------------------------------------
// 2. Company Dialog
// -----------------------------------------------------------------------------
interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CompanyInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    code: string;
    name: string;
    regionId?: string | null;
    isActive: boolean;
  } | null;
  regionList: Array<{ id: string; code: string; name: string }>;
}

export function CompanyDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  regionList,
}: CompanyDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      code: "",
      name: "",
      regionId: null,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        regionId: initialData.regionId || null,
        isActive: initialData.isActive,
      });
    } else {
      reset({
        code: "",
        name: "",
        regionId: null,
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset]);

  const onFormSubmit = async (values: CompanyInput) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({ ...values, id: initialData?.id });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan Perusahaan";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {initialData ? "Ubah Perusahaan (PT)" : "Tambah Perusahaan Baru (PT)"}
            </DialogTitle>
            <DialogDescription>
              Kode perusahaan dipakai sebagai penomoran kode proyek (cth: WM-CMP01-2026-0001).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Region Induk</Label>
              <Controller
                control={control}
                name="regionId"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Pilih Region (Opsional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Tanpa Region --</SelectItem>
                      {regionList.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.name} ({r.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cmp-code" className="text-xs">
                Kode Perusahaan <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cmp-code"
                placeholder="cth: CMP01"
                className="uppercase font-mono text-xs"
                {...register("code")}
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cmp-name" className="text-xs">
                Nama Perusahaan (PT) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cmp-name"
                placeholder="cth: PT Sawit Jaya Makmur"
                className="text-xs"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label htmlFor="cmp-active" className="text-xs font-medium">
                  Status Aktif
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Perusahaan aktif dapat dipilih saat registrasi proyek baru.
                </p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="cmp-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
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

// -----------------------------------------------------------------------------
// 3. Estate Dialog
// -----------------------------------------------------------------------------
interface EstateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EstateInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    companyId: string;
    code: string;
    name: string;
    region?: string | null;
    isActive: boolean;
  } | null;
  companyList: Array<{ id: string; code: string; name: string }>;
  defaultCompanyId?: string;
}

export function EstateDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  companyList,
  defaultCompanyId,
}: EstateDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<EstateInput>({
    resolver: zodResolver(estateSchema),
    defaultValues: {
      companyId: defaultCompanyId || "",
      code: "",
      name: "",
      region: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        companyId: initialData.companyId,
        code: initialData.code,
        name: initialData.name,
        region: initialData.region || "",
        isActive: initialData.isActive,
      });
    } else {
      reset({
        companyId: defaultCompanyId || "",
        code: "",
        name: "",
        region: "",
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, defaultCompanyId, open, reset]);

  const onFormSubmit = async (values: EstateInput) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({ ...values, id: initialData?.id });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan Estate";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {initialData ? "Ubah Estate / Kebun" : "Tambah Estate / Kebun"}
            </DialogTitle>
            <DialogDescription>
              Estate/Kebun berada di bawah naungan satu Perusahaan (PT).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">
                Perusahaan (PT) <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="companyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Pilih Perusahaan" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyList.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.companyId && (
                <p className="text-xs text-destructive">{errors.companyId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="est-code" className="text-xs">
                Kode Estate <span className="text-destructive">*</span>
              </Label>
              <Input
                id="est-code"
                placeholder="cth: EST-01"
                className="uppercase font-mono text-xs"
                {...register("code")}
              />
              {errors.code && (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="est-name" className="text-xs">
                Nama Estate <span className="text-destructive">*</span>
              </Label>
              <Input
                id="est-name"
                placeholder="cth: Kebun Sei Mangkei"
                className="text-xs"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label htmlFor="est-active" className="text-xs font-medium">
                  Status Aktif
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Estate aktif dapat dipilih saat registrasi proyek baru.
                </p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="est-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
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

// -----------------------------------------------------------------------------
// 4. Block Dialog
// -----------------------------------------------------------------------------
interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BlockInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    estateId: string;
    blockCode: string;
    name: string;
    plantingYear?: number | null;
    areaHectares?: number | null;
    isActive: boolean;
  } | null;
  estateList: Array<{ id: string; code: string; name: string }>;
  defaultEstateId?: string;
}

export function BlockDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  estateList,
  defaultEstateId,
}: BlockDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<BlockInput>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      estateId: defaultEstateId || "",
      blockCode: "",
      name: "",
      plantingYear: null,
      areaHectares: null,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (initialData) {
      reset({
        estateId: initialData.estateId,
        blockCode: initialData.blockCode,
        name: initialData.name,
        plantingYear: initialData.plantingYear || null,
        areaHectares: initialData.areaHectares || null,
        isActive: initialData.isActive,
      });
    } else {
      reset({
        estateId: defaultEstateId || "",
        blockCode: "",
        name: "",
        plantingYear: null,
        areaHectares: null,
        isActive: true,
      });
    }
    setErrorMsg(null);
  }, [initialData, defaultEstateId, open, reset]);

  const onFormSubmit = async (values: BlockInput) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({ ...values, id: initialData?.id });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan Blok";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {initialData ? "Ubah Blok Kebun" : "Tambah Blok Kebun Baru"}
            </DialogTitle>
            <DialogDescription>
              Blok merupakan unit terkecil lokasi fisik perkebunan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">
                Estate / Kebun <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="estateId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Pilih Estate" />
                    </SelectTrigger>
                    <SelectContent>
                      {estateList.map((e) => (
                        <SelectItem key={e.id} value={e.id} className="text-xs">
                          {e.name} ({e.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.estateId && (
                <p className="text-xs text-destructive">{errors.estateId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="blk-code" className="text-xs">
                  Kode Blok <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="blk-code"
                  placeholder="cth: B01"
                  className="uppercase font-mono text-xs"
                  {...register("blockCode")}
                />
                {errors.blockCode && (
                  <p className="text-xs text-destructive">{errors.blockCode.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blk-name" className="text-xs">
                  Nama / Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="blk-name"
                  placeholder="cth: Blok Afdeling I"
                  className="text-xs"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="blk-year" className="text-xs">
                  Tahun Tanam
                </Label>
                <Input
                  id="blk-year"
                  type="number"
                  placeholder="cth: 2018"
                  className="font-mono text-xs"
                  {...register("plantingYear", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blk-ha" className="text-xs">
                  Luas (Hektar)
                </Label>
                <Input
                  id="blk-ha"
                  type="number"
                  step="0.01"
                  placeholder="cth: 28.5"
                  className="font-mono text-xs"
                  {...register("areaHectares", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label htmlFor="blk-active" className="text-xs font-medium">
                  Status Aktif
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Blok aktif dapat dipilih saat registrasi proyek baru.
                </p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="blk-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
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
