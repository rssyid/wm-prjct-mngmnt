import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/files/[...key]
 *
 * Proxy file dari R2 ke browser — menghindari SSL issue pada public r2.dev domain.
 * Hanya untuk membaca/menampilkan file (bukan upload).
 * Tidak memerlukan autentikasi agar file bisa dibuka dari link langsung (PDF viewer, img src, dll).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keyParts } = await params;
  const objectKey = keyParts.join("/");

  if (!objectKey) {
    return new NextResponse("File key tidak ditemukan", { status: 400 });
  }

  try {
    const r2 = getR2Client();
    const bucket = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    const response = await r2.send(command);

    if (!response.Body) {
      return new NextResponse("File tidak ditemukan", { status: 404 });
    }

    // Stream body ke client
    const stream = response.Body.transformToWebStream();

    const headers = new Headers();
    if (response.ContentType) headers.set("Content-Type", response.ContentType);
    if (response.ContentLength) headers.set("Content-Length", String(response.ContentLength));

    // Cache 1 jam di browser, 24 jam di CDN Vercel Edge
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600");

    // Biarkan browser inline (PDF/gambar tampil langsung, bukan download)
    const filename = objectKey.split("/").pop() ?? "file";
    headers.set("Content-Disposition", `inline; filename="${filename}"`);

    return new NextResponse(stream, { status: 200, headers });
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
      return new NextResponse("File tidak ditemukan", { status: 404 });
    }
    console.error("[R2 Proxy] Error:", err);
    return new NextResponse("Gagal mengambil file", { status: 500 });
  }
}
