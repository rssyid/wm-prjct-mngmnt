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
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Info } from "lucide-react";
import * as React from "react";

interface HolidayCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function HolidayCsvDialog({
  open,
  onOpenChange,
  onSuccess,
}: HolidayCsvDialogProps) {
  const [csvContent, setCsvContent] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [resultMsg, setResultMsg] = React.useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = async () => {
    setErrorMsg(null);
    setResultMsg(null);

    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setErrorMsg("Konten CSV kosong. Masukkan data atau unggah file.");
      return;
    }

    const holidays: Array<{
      holidayDate: string;
      name: string;
      year: number;
      description?: string;
    }> = [];

    const invalidLines: string[] = [];

    lines.forEach((line, index) => {
      // Abaikan header jika ada
      if (
        index === 0 &&
        (line.toLowerCase().includes("tanggal") || line.toLowerCase().includes("date"))
      ) {
        return;
      }

      // Pemisah bisa berupa semicolon (;) atau koma (,)
      const parts = line.includes(";") ? line.split(";") : line.split(",");
      const datePart = parts[0]?.trim();
      const namePart = parts[1]?.trim();
      const descPart = parts[2]?.trim();

      if (!datePart || !namePart) {
        invalidLines.push(`Baris ${index + 1}: format tidak lengkap (${line})`);
        return;
      }

      // Validasi format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        invalidLines.push(`Baris ${index + 1}: format tanggal harus YYYY-MM-DD (${datePart})`);
        return;
      }

      const year = parseInt(datePart.substring(0, 4), 10);
      holidays.push({
        holidayDate: datePart,
        name: namePart,
        year,
        description: descPart || undefined,
      });
    });

    if (invalidLines.length > 0) {
      setErrorMsg(invalidLines.slice(0, 5).join("\n") + (invalidLines.length > 5 ? `\n...dan ${invalidLines.length - 5} baris lainnya bermasalah.` : ""));
      return;
    }

    if (holidays.length === 0) {
      setErrorMsg("Tidak ada baris data hari libur yang valid ditemukan.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/master?type=holiday-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holidays),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Gagal menyimpan data hari libur");
      }

      setResultMsg(`Berhasil memproses ${json.data.total} hari libur (${json.data.createdCount} baru, ${json.data.updatedCount} diperbarui).`);
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
        setCsvContent("");
        setResultMsg(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah data.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Bulk Import Hari Libur (CSV)</DialogTitle>
          <DialogDescription>
            Impor daftar hari libur nasional sekaligus menggunakan format sederhana: <code className="bg-muted px-1 py-0.5 rounded text-xs">tanggal;nama</code> per baris.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md whitespace-pre-line font-mono">
              {errorMsg}
            </div>
          )}

          {resultMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-md font-medium">
              {resultMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Pilih File CSV</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="text-xs file:text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Atau Tempel / Sunting Data CSV</Label>
            <Textarea
              rows={8}
              placeholder={`2026-01-01;Tahun Baru Masehi\n2026-03-31;Hari Raya Idul Fitri 1447 H\n2026-04-01;Cuti Bersama Idul Fitri\n2026-08-17;Hari Kemerdekaan RI`}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-start space-x-2 p-2.5 rounded bg-muted/60 text-muted-foreground text-xs">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <div>
              Format: <span className="font-mono text-foreground">YYYY-MM-DD;Nama Hari Libur</span>. Pemisah titik-koma (;) atau koma (,). Data tanggal yang sudah ada akan otomatis diperbarui.
            </div>
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
          <Button
            type="button"
            onClick={handleProcessImport}
            disabled={isSubmitting || !csvContent.trim()}
          >
            <FileUp className="mr-2 h-4 w-4" />
            {isSubmitting ? "Memproses..." : "Mulai Impor CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
