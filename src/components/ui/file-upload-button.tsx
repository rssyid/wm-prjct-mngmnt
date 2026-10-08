"use client";

import { Button } from "@/components/ui/button";
import { uploadFileToR2, UploadOptions } from "@/lib/upload";
import { toProxyUrl } from "@/lib/r2-url";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import React, { useRef, useState } from "react";

interface FileUploadButtonProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: UploadOptions["folder"];
  accept?: string;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export function FileUploadButton({
  value,
  onChange,
  folder = "general",
  accept = "image/*,application/pdf,.xlsx,.xls",
  disabled = false,
  label = "Pilih Berkas",
  description,
  className = "",
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(0);
    setErrorMessage(null);

    try {
      const publicUrl = await uploadFileToR2(file, {
        folder,
        onProgress: (pct) => setProgress(pct),
      });

      onChange(publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengunggah berkas";
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClear = () => {
    onChange(null);
    setErrorMessage(null);
    setProgress(0);
  };

  // Ekstrak nama file sederhana dari URL
  const displayFileName = value ? value.split("/").pop() || "Lihat Dokumen" : "";

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* State 1: Sedang Upload */}
      {isUploading ? (
        <div className="rounded-md border border-sky-200 bg-sky-50/50 p-2.5 dark:border-sky-900/50 dark:bg-sky-950/20 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-sky-800 dark:text-sky-300 font-medium">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
              Mengompres & Mengunggah...
            </span>
            <span className="font-mono text-[11px]">{progress}%</span>
          </div>
          <div className="w-full bg-sky-200 dark:bg-sky-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-600 h-1.5 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : value ? (
        /* State 2: Berkas Sudah Terisi / Selesai Upload */
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <a
              href={toProxyUrl(value)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary hover:underline truncate max-w-[220px] sm:max-w-[320px]"
              title={value}
            >
              {displayFileName}
            </a>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              asChild
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <a href={toProxyUrl(value)} target="_blank" rel="noopener noreferrer" title="Buka tautan">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>

            {!disabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-2 text-[11px]"
                >
                  Ganti
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                  title="Hapus berkas"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* State 3: Belum Ada Berkas */
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="h-8 text-xs gap-1.5"
          >
            <UploadCloud className="h-3.5 w-3.5 text-muted-foreground" />
            {label}
          </Button>
          {description && (
            <span className="text-[11px] text-muted-foreground">{description}</span>
          )}
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
