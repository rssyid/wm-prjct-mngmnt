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
import { HolidayInput, holidaySchema } from "@/lib/validations/master";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

interface HolidayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HolidayInput & { id?: string }) => Promise<void>;
  initialData?: {
    id: string;
    holidayDate: string;
    name: string;
    year: number;
    description?: string | null;
  } | null;
}

export function HolidayDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: HolidayDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<HolidayInput>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      holidayDate: "2026-01-01",
      name: "",
      year: 2026,
      description: "Libur Nasional",
    },
  });

  React.useEffect(() => {
    if (initialData) {
      const dateFormatted = initialData.holidayDate.split("T")[0];
      reset({
        holidayDate: dateFormatted,
        name: initialData.name,
        year: initialData.year,
        description: initialData.description || "Libur Nasional",
      });
    } else {
      reset({
        holidayDate: "2026-01-01",
        name: "",
        year: 2026,
        description: "Libur Nasional",
      });
    }
    setErrorMsg(null);
  }, [initialData, open, reset]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue("holidayDate", val);
    if (val) {
      const parsedYear = parseInt(val.split("-")[0], 10);
      if (!isNaN(parsedYear)) {
        setValue("year", parsedYear);
      }
    }
  };

  const handleFormSubmit = async (data: HolidayInput) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({ ...data, id: initialData?.id });
      onOpenChange(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan hari libur");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Ubah Hari Libur" : "Tambah Hari Libur Manual"}
          </DialogTitle>
          <DialogDescription>
            Input hari libur nasional atau cuti bersama untuk kalkulasi SLA hari kerja proyek.
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
              <Label htmlFor="holidayDate">Tanggal Libur *</Label>
              <Input
                id="holidayDate"
                type="date"
                disabled={isSubmitting}
                {...register("holidayDate")}
                onChange={handleDateChange}
              />
              {errors.holidayDate && (
                <p className="text-xs text-destructive">{errors.holidayDate.message}</p>
              )}
            </div>

            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="year">Tahun Kalender *</Label>
              <Input
                id="year"
                type="number"
                min={2020}
                max={2050}
                disabled={isSubmitting}
                {...register("year")}
              />
              {errors.year && (
                <p className="text-xs text-destructive">{errors.year.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nama Hari Libur *</Label>
            <Input
              id="name"
              placeholder="Contoh: Hari Raya Idul Fitri 1447 H"
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Kategori / Keterangan</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value || "Libur Nasional"}
                  value={field.value || "Libur Nasional"}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis libur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Libur Nasional">Libur Nasional</SelectItem>
                    <SelectItem value="Cuti Bersama">Cuti Bersama</SelectItem>
                    <SelectItem value="Libur Khusus">Libur Khusus / Daerah</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
              {isSubmitting ? "Menyimpan..." : "Simpan Hari Libur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
