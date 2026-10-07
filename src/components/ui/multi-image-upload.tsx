"use client";
/* eslint-disable @next/next/no-img-element */

import { Button } from "@/components/ui/button";
import { uploadFileToR2 } from "@/lib/upload";
import {
  AlertCircle,
  Camera,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";
import React, { useRef, useState } from "react";

interface UploadingFileState {
  id: string;
  name: string;
  progress: number;
}

interface MultiImageUploadProps {
  values: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  folder?: "progress" | "projects" | "packages" | "bast" | "afce" | "general";
  maxFiles?: number;
}

export function MultiImageUpload({
  values = [],
  onChange,
  disabled = false,
  folder = "progress",
  maxFiles = 10,
}: MultiImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileState[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (values.length + selectedFiles.length > maxFiles) {
      setErrorMessage(`Maksimal hanya ${maxFiles} foto yang dapat diunggah`);
      return;
    }

    setErrorMessage(null);

    // Proses upload setiap file secara paralel dengan progress masing-masing
    const newUploading: UploadingFileState[] = selectedFiles.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      name: file.name,
      progress: 0,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploading]);

    const uploadPromises = selectedFiles.map(async (file, index) => {
      const uploadId = newUploading[index].id;
      try {
        const publicUrl = await uploadFileToR2(file, {
          folder,
          onProgress: (percent) => {
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === uploadId ? { ...item, progress: percent } : item
              )
            );
          },
        });

        // Selesai upload 1 file
        setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadId));
        return publicUrl;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Gagal upload ${file.name}`;
        setErrorMessage(msg);
        setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadId));
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successfulUrls = results.filter((url): url is string => Boolean(url));
    if (successfulUrls.length > 0) {
      onChange([...values, ...successfulUrls]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelect}
        className="hidden"
        disabled={disabled || uploadingFiles.length > 0}
      />

      {/* Area Tombol Upload */}
      {!disabled && values.length < maxFiles && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles.length > 0}
            className="h-8 text-xs gap-1.5"
          >
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
            Pilih Foto Lapangan (Multi-file)
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Otomatis dikompresi maks 1600px JPEG q0.8 (Tersisa {maxFiles - values.length} slot)
          </span>
        </div>
      )}

      {/* Progress Card untuk berkas yang sedang diupload */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uf) => (
            <div
              key={uf.id}
              className="rounded-md border border-sky-200 bg-sky-50/50 p-2 dark:border-sky-900/50 dark:bg-sky-950/20 text-xs space-y-1"
            >
              <div className="flex items-center justify-between text-sky-800 dark:text-sky-300">
                <span className="truncate max-w-[200px] font-medium flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-sky-600" />
                  {uf.name}
                </span>
                <span className="font-mono text-[11px]">{uf.progress}%</span>
              </div>
              <div className="w-full bg-sky-200 dark:bg-sky-800 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-sky-600 h-1 rounded-full transition-all duration-200"
                  style={{ width: `${uf.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2 border border-rose-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Galeri Thumbnail Foto */}
      {values.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
          {values.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="group relative rounded-md border border-border overflow-hidden bg-muted/40 aspect-video flex items-center justify-center"
            >
              {/* Native img tag - TANPA next/image optimizer sesuai aturan STACK.md §4 & Rules.md §7 */}
              <img
                src={url}
                alt={`Dokumentasi Lapangan ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />

              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 rounded bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                  title="Buka gambar penuh"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="h-7 w-7 rounded bg-rose-600/80 text-white flex items-center justify-center hover:bg-rose-700 transition-colors"
                    title="Hapus foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
