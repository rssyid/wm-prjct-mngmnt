"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";
import { FieldError } from "react-hook-form";

export interface BoqItem {
  itemCode: string;
  name: string;
  uom: string;
  qty: number;
  unitPrice: number;
}

export interface BoqItemError {
  itemCode?: FieldError;
  name?: FieldError;
  uom?: FieldError;
  qty?: FieldError;
  unitPrice?: FieldError;
}

interface BoqTemplateEditorProps {
  items: BoqItem[];
  onChange: (items: BoqItem[]) => void;
  errors?: BoqItemError[] | Record<string, unknown>;
}

export function BoqTemplateEditor({ items, onChange, errors }: BoqTemplateEditorProps) {
  const handleItemChange = (index: number, field: keyof BoqItem, value: string | number) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: field === "qty" || field === "unitPrice" ? Number(value) || 0 : String(value),
    };
    onChange(updated);
  };

  const handleAddItem = () => {
    onChange([
      ...items,
      {
        itemCode: `MAT-${items.length + 1}`,
        name: "",
        uom: "unit",
        qty: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Item Bill of Quantities (BOQ) Proyek
          </h4>
          <p className="text-xs text-muted-foreground">
            Daftar material dan kuantitas rencana yang diimpor dari template varian struktur atau dibuat manual.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          className="text-xs h-8"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Tambah Item
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[120px] text-xs">Kode Item</TableHead>
              <TableHead className="text-xs">Nama Material / Pekerjaan</TableHead>
              <TableHead className="w-[100px] text-xs">Satuan</TableHead>
              <TableHead className="w-[100px] text-xs">Qty</TableHead>
              <TableHead className="w-[140px] text-xs">Est. Harga Satuan (Rp)</TableHead>
              <TableHead className="w-[60px] text-xs text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-6 text-xs text-muted-foreground"
                >
                  Belum ada item BOQ. Pilih varian struktur di atas untuk mengisi template otomatis atau klik &quot;Tambah Item&quot;.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const itemErr = (
                  Array.isArray(errors)
                    ? errors[index]
                    : (errors as Record<number, BoqItemError> | undefined)?.[index]
                ) as BoqItemError | undefined;
                return (
                  <TableRow key={index} className={itemErr ? "bg-rose-50/20 dark:bg-rose-950/10" : undefined}>
                    <TableCell className="p-2 align-top">
                      <Input
                        value={item.itemCode}
                        onChange={(e) =>
                          handleItemChange(index, "itemCode", e.target.value)
                        }
                        className={cn(
                          "h-8 text-xs font-mono",
                          itemErr?.itemCode && "border-rose-500 focus-visible:ring-rose-500"
                        )}
                        placeholder="Kode"
                      />
                      {itemErr?.itemCode?.message && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{itemErr.itemCode.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="p-2 align-top">
                      <Input
                        value={item.name}
                        onChange={(e) =>
                          handleItemChange(index, "name", e.target.value)
                        }
                        className={cn(
                          "h-8 text-xs",
                          itemErr?.name && "border-rose-500 focus-visible:ring-rose-500"
                        )}
                        placeholder="Nama material/jasa"
                      />
                      {itemErr?.name?.message && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{itemErr.name.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="p-2 align-top">
                      <Input
                        value={item.uom}
                        onChange={(e) =>
                          handleItemChange(index, "uom", e.target.value)
                        }
                        className={cn(
                          "h-8 text-xs",
                          itemErr?.uom && "border-rose-500 focus-visible:ring-rose-500"
                        )}
                        placeholder="UoM"
                      />
                      {itemErr?.uom?.message && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{itemErr.uom.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="p-2 align-top">
                      <FormattedNumberInput
                        allowDecimals
                        placeholder="0"
                        value={item.qty}
                        onChange={(val) =>
                          handleItemChange(index, "qty", val ?? 0)
                        }
                        className={cn(
                          "h-8 text-xs tabular-nums text-right",
                          itemErr?.qty && "border-rose-500 focus-visible:ring-rose-500"
                        )}
                      />
                      {itemErr?.qty?.message && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{itemErr.qty.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="p-2 align-top">
                      <FormattedNumberInput
                        prefix="Rp "
                        placeholder="0"
                        value={item.unitPrice}
                        onChange={(val) =>
                          handleItemChange(index, "unitPrice", val ?? 0)
                        }
                        className={cn(
                          "h-8 text-xs tabular-nums text-right",
                          itemErr?.unitPrice && "border-rose-500 focus-visible:ring-rose-500"
                        )}
                      />
                      {itemErr?.unitPrice?.message && (
                        <p className="text-[10px] text-rose-500 mt-0.5">{itemErr.unitPrice.message}</p>
                      )}
                    </TableCell>
                    <TableCell className="p-2 text-center align-top pt-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus item BOQ ${item.name || index + 1}`}
                        onClick={() => handleRemoveItem(index)}
                        className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!Array.isArray(errors) &&
        typeof errors === "object" &&
        errors !== null &&
        "message" in errors &&
        typeof (errors as { message?: unknown }).message === "string" && (
          <p className="text-[11px] text-rose-500 font-medium">
            {(errors as { message: string }).message}
          </p>
        )}
    </div>
  );
}
