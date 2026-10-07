"use client";

import { Badge } from "@/components/ui/badge";
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
import { PackageCategory } from "@prisma/client";
import { AlertCircle, CheckCircle, FileSpreadsheet, Upload } from "lucide-react";
import * as React from "react";

interface ItemExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  uomList: Array<{ id: string; code: string; name: string }>;
}

interface ParsedItem {
  rowNumber: number;
  itemCode: string;
  name: string;
  category: PackageCategory;
  uomId: string;
  uomCode: string;
  specification?: string;
  standardPrice: number;
  isActive: boolean;
}

interface FailedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  reason: string;
}

export function ItemExcelImportDialog({
  open,
  onOpenChange,
  onSuccess,
  uomList,
}: ItemExcelImportDialogProps) {
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [parsedItems, setParsedItems] = React.useState<ParsedItem[]>([]);
  const [failedRows, setFailedRows] = React.useState<FailedRow[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [resultMsg, setResultMsg] = React.useState<string | null>(null);

  // Normalisasi pemetaan kategori dari Excel
  const mapCategory = (rawCat: string | undefined): PackageCategory | null => {
    if (!rawCat) return PackageCategory.MATERIAL;
    const clean = rawCat.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (Object.values(PackageCategory).includes(clean as PackageCategory)) {
      return clean as PackageCategory;
    }
    // Mapping alias
    if (clean.includes("ALAT") || clean.includes("BERAT")) return PackageCategory.HEAVY_EQUIPMENT;
    if (clean.includes("KONTRAKTOR") || clean.includes("BORONG")) return PackageCategory.CONTRACTOR;
    if (clean.includes("FABRIKASI")) return PackageCategory.FABRICATION;
    if (clean.includes("SWAKELOLA")) return PackageCategory.SWAKELOLA;
    if (clean.includes("MATERIAL") || clean.includes("BAHAN")) return PackageCategory.MATERIAL;
    return null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setErrorMsg(null);
    setResultMsg(null);
    setParsedItems([]);
    setFailedRows([]);
    setIsParsing(true);

    try {
      // Dinamis import pustaka xlsx sesuai aturan design.md §4 & STACK.md
      const XLSX = await import("xlsx");

      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      if (rawRows.length === 0) {
        setErrorMsg("File Excel kosong atau tidak memiliki baris data.");
        setIsParsing(false);
        return;
      }

      const validList: ParsedItem[] = [];
      const errorList: FailedRow[] = [];

      rawRows.forEach((row, index) => {
        const rowNumber = index + 2; // Baris 1 adalah header Excel

        // Ambil nilai kolom dengan toleransi nama header (case-insensitive & trim)
        const getCol = (possibleNames: string[]) => {
          for (const key of Object.keys(row)) {
            const normalizedKey = key.trim().toLowerCase();
            if (possibleNames.some((p) => p.toLowerCase() === normalizedKey)) {
              return row[key];
            }
          }
          return undefined;
        };

        const rawCode = getCol(["itemCode", "item_code", "kode item", "kode_item", "kode"]);
        const rawName = getCol(["name", "nama", "nama material", "nama_material", "nama item"]);
        const rawCategory = getCol(["category", "kategori", "kategori item"]);
        const rawUom = getCol(["uom", "satuan", "uomCode", "kode satuan"]);
        const rawPrice = getCol(["standardPrice", "standard_price", "harga", "harga standar", "harga_standar"]);
        const rawSpec = getCol(["specification", "spesifikasi", "spec"]);

        const itemCode = rawCode ? String(rawCode).trim().toUpperCase() : "";
        const name = rawName ? String(rawName).trim() : "";
        const uomStr = rawUom ? String(rawUom).trim().toUpperCase() : "";

        if (!itemCode) {
          errorList.push({ rowNumber, raw: row, reason: "Kode item kosong" });
          return;
        }

        if (!name) {
          errorList.push({ rowNumber, raw: row, reason: "Nama material/item kosong" });
          return;
        }

        const category = mapCategory(rawCategory ? String(rawCategory) : undefined);
        if (!category) {
          errorList.push({
            rowNumber,
            raw: row,
            reason: `Kategori '${rawCategory}' tidak valid (Gunakan: MATERIAL, FABRICATION, CONTRACTOR, HEAVY_EQUIPMENT, SWAKELOLA)`,
          });
          return;
        }

        // Cari UoM yang cocok
        const matchedUom = uomList.find(
          (u) =>
            u.code.toUpperCase() === uomStr ||
            u.name.toUpperCase() === uomStr
        );

        if (!matchedUom) {
          errorList.push({
            rowNumber,
            raw: row,
            reason: `Satuan UoM '${rawUom}' tidak ditemukan di Master UoM`,
          });
          return;
        }

        const standardPrice = Number(rawPrice) || 0;
        if (standardPrice < 0) {
          errorList.push({ rowNumber, raw: row, reason: "Harga standar tidak boleh negatif" });
          return;
        }

        validList.push({
          rowNumber,
          itemCode,
          name,
          category,
          uomId: matchedUom.id,
          uomCode: matchedUom.code,
          specification: rawSpec ? String(rawSpec).trim() : undefined,
          standardPrice,
          isActive: true,
        });
      });

      setParsedItems(validList);
      setFailedRows(errorList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Format file tidak didukung";
      setErrorMsg("Gagal membaca file Excel: " + msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedItems.length === 0) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const payload = parsedItems.map((item) => ({
        itemCode: item.itemCode,
        name: item.name,
        category: item.category,
        uomId: item.uomId,
        specification: item.specification || null,
        standardPrice: item.standardPrice,
        isActive: true,
      }));

      const res = await fetch("/api/master?type=item-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Gagal mengimpor data item");
      }

      setResultMsg(
        `Sukses memproses ${json.data.total} item (${json.data.createdCount} dibuat baru, ${json.data.updatedCount} diperbarui).`
      );

      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
        setParsedItems([]);
        setFailedRows([]);
        setResultMsg(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses impor.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <span>Import Excel Master Material / Item</span>
          </DialogTitle>
          <DialogDescription>
            Unggah file spreadsheet Excel (<code className="text-xs bg-muted px-1">.xlsx</code>, <code className="text-xs bg-muted px-1">.xls</code>) untuk melakukan batch upsert data material.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
              {errorMsg}
            </div>
          )}

          {resultMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-md font-medium">
              {resultMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Pilih File Spreadsheet (.xlsx)</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isParsing || isSubmitting}
              className="text-xs file:text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Kolom wajib: <span className="font-mono text-foreground">itemCode, name, category, uom, standardPrice</span> (opsional: <span className="font-mono">specification</span>).
            </p>
          </div>

          {isParsing && (
            <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
              Sedang membaca dan memvalidasi file Excel...
            </div>
          )}

          {/* Ringkasan Hasil Validasi File */}
          {!isParsing && (parsedItems.length > 0 || failedRows.length > 0) && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  <span>{parsedItems.length} Baris Siap Diimpor</span>
                </div>
                {failedRows.length > 0 && (
                  <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    <span>{failedRows.length} Baris Gagal</span>
                  </div>
                )}
              </div>

              {/* Laporan Baris Gagal */}
              {failedRows.length > 0 && (
                <div className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 rounded-lg p-3 space-y-2">
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    Daftar Baris Tidak Lolos Validasi:
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
                    {failedRows.map((f, i) => (
                      <div key={i} className="flex items-start space-x-2 text-rose-700 dark:text-rose-300">
                        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 border-rose-300 dark:border-rose-800 font-mono">
                          Baris {f.rowNumber}
                        </Badge>
                        <span className="text-[11px]">{f.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Baris Valid */}
              {parsedItems.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Pratinjau {Math.min(parsedItems.length, 5)} dari {parsedItems.length} Item Valid:
                  </div>
                  <div className="divide-y divide-border text-xs max-h-40 overflow-y-auto">
                    {parsedItems.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-primary mr-2">{item.itemCode}</span>
                          <span className="font-medium text-foreground">{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                          <span className="text-muted-foreground font-mono">{item.uomCode}</span>
                          <span className="font-mono font-medium">
                            Rp {item.standardPrice.toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
          <Button
            type="button"
            onClick={handleExecuteImport}
            disabled={isSubmitting || parsedItems.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isSubmitting ? "Menyimpan ke Database..." : `Impor ${parsedItems.length} Item`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
