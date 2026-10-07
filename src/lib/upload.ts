/**
 * Client Upload Helper untuk Cloudflare R2
 * Sesuai docs/STACK.md §4 & docs/Rules.md §7:
 * - Kompresi foto di client: canvas resize maks sisi 1600 px, JPEG quality 0.8 (target <= 500 KB/foto).
 * - Berkas non-gambar (PDF, Excel) dilewatkan tanpa kompresi.
 * - Upload langsung ke R2 via presigned PUT URL dengan tracking progress.
 */

export interface UploadOptions {
  folder?: "progress" | "projects" | "packages" | "bast" | "afce" | "general";
  onProgress?: (percent: number) => void;
}

export interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

/**
 * Kompresi gambar di client menggunakan HTML Canvas:
 * - Maksimal sisi 1600px (menjaga aspect ratio)
 * - Format JPEG quality 0.8
 * - PDF, Excel, dan format lain dilewatkan tanpa perubahan
 */
export async function compressImage(file: File): Promise<File> {
  // Hanya proses jika bertipe image/* dan bukan svg
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        const MAX_DIMENSION = 1600;
        let { width, height } = img;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback jika canvas context gagal dibuat
          resolve(file);
          return;
        }

        // Gambar ke canvas dengan dimensi baru
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Ganti ekstensi file menjadi .jpg
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const compressedFile = new File([blob], newName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          "image/jpeg",
          0.8
        );
      };

      img.onerror = () => {
        // Fallback jika gambar gagal diload
        resolve(file);
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Meminta presigned URL dari server dan langsung mengunggah file ke R2 via XMLHttpRequest
 * Mengembalikan publicUrl dari berkas yang diunggah.
 */
export async function uploadFileToR2(
  file: File,
  options?: UploadOptions
): Promise<string> {
  // 1. Kompresi gambar di client jika file adalah foto
  const preparedFile = await compressImage(file);

  // 2. Minta presigned PUT URL ke backend
  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: preparedFile.name,
      contentType: preparedFile.type || "application/octet-stream",
      size: preparedFile.size,
      folder: options?.folder || "general",
    }),
  });

  const presignJson = await presignRes.json();
  if (!presignRes.ok || !presignJson.success) {
    throw new Error(presignJson.error || "Gagal mendapatkan presigned upload URL");
  }

  const { uploadUrl, publicUrl } = presignJson.data as PresignResponse;

  // 3. Upload langsung ke R2 via PUT dengan progress tracking
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", preparedFile.type || "application/octet-stream");

    if (options?.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options?.onProgress?.(100);
        resolve();
      } else {
        reject(
          new Error(
            `Gagal mengunggah berkas ke storage (HTTP ${xhr.status}: ${xhr.statusText})`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Terjadi gangguan koneksi jaringan saat mengunggah berkas ke storage"));
    };

    xhr.send(preparedFile);
  });

  return publicUrl;
}
