import { AppError, apiSuccess, handleApiError } from "@/lib/api-error";
import { checkPresignRateLimit } from "@/lib/ratelimit";
import { getR2BucketName, getR2Client, getR2PublicBaseUrl } from "@/lib/r2";
import { requireRole } from "@/server/auth-guard";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import path from "path";
import { z } from "zod";

const presignSchema = z.object({
  filename: z.string().trim().min(1, "Nama file wajib diisi"),
  contentType: z.string().trim().min(1, "Tipe MIME wajib diisi"),
  size: z.coerce.number().int().positive("Ukuran file harus lebih dari 0"),
  folder: z
    .enum(["progress", "projects", "packages", "bast", "afce", "general"])
    .default("general"),
});

function isAllowedFile(contentType: string, filename: string): boolean {
  const lowerType = contentType.toLowerCase();
  const lowerName = filename.toLowerCase();

  // 1. Gambar
  if (lowerType.startsWith("image/")) {
    return true;
  }

  // 2. Dokumen PDF
  if (lowerType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return true;
  }

  // 3. Spreadsheet Excel (.xlsx / .xls)
  if (
    lowerType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lowerType === "application/vnd.ms-excel" ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls")
  ) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth & Role check (SUPER_ADMIN & WM_HO_SPECIALIST)
    const session = await requireRole(Role.SUPER_ADMIN, Role.WM_HO_SPECIALIST);

    // Rate limit: maks 60 request / jam / user
    const rateLimit = await checkPresignRateLimit(session.user.id);
    if (!rateLimit.success) {
      throw new AppError(
        "Batas unggah tercapai (maksimal 60 berkas per jam). Silakan coba lagi nanti.",
        429
      );
    }

    // 2. Parse & Validate request body
    const body = await request.json();
    const validated = presignSchema.parse(body);

    // 3. Validasi MIME / ekstensi file
    if (!isAllowedFile(validated.contentType, validated.filename)) {
      throw new AppError(
        "Format file tidak didukung. Hanya gambar (image/*), dokumen PDF (.pdf), dan Excel (.xlsx) yang diizinkan.",
        400
      );
    }

    // 4. Validasi ukuran <= MAX_UPLOAD_MB (default 10 MB)
    const maxMb = Number(process.env.MAX_UPLOAD_MB || "10");
    const maxBytes = maxMb * 1024 * 1024;
    if (validated.size > maxBytes) {
      throw new AppError(
        `Ukuran file (${(validated.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal ${maxMb} MB`,
        400
      );
    }

    // 5. Generate unique safe object key
    const rawExt = path.extname(validated.filename).toLowerCase();
    const ext = rawExt || (validated.contentType === "application/pdf" ? ".pdf" : ".jpg");
    const safeBaseName = path
      .basename(validated.filename, rawExt)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);

    const objectKey = `${validated.folder}/${Date.now()}-${randomUUID().slice(0, 8)}-${safeBaseName}${ext}`;

    // 6. Buat presigned PUT URL via S3 SDK
    const r2Client = getR2Client();
    const bucket = getR2BucketName();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: validated.contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    const publicBaseUrl = getR2PublicBaseUrl();
    const publicUrl = `${publicBaseUrl}/${objectKey}`;

    return apiSuccess({
      uploadUrl,
      publicUrl,
      objectKey,
    });
  } catch (error) {
    return handleApiError(error, "Gagal membuat presigned upload URL");
  }
}
