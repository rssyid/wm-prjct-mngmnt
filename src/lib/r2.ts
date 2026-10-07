import { S3Client } from "@aws-sdk/client-s3";
import { getRequiredEnv } from "@/lib/env";

let r2ClientInstance: S3Client | null = null;

/**
 * Singleton S3Client terhubung ke Cloudflare R2
 */
export function getR2Client(): S3Client {
  if (!r2ClientInstance) {
    const accountId = getRequiredEnv("R2_ACCOUNT_ID");
    const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");

    r2ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Matikan kalkulasi checksum otomatis yang tidak didukung atau memicu penolakan CORS browser pada R2 presigned PUT
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return r2ClientInstance;
}

export function getR2BucketName(): string {
  return process.env.R2_BUCKET || "wm-prjct-files";
}

export function getR2PublicBaseUrl(): string {
  const url = process.env.R2_PUBLIC_BASE_URL || "";
  return url.replace(/\/+$/, "");
}
