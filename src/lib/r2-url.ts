/**
 * Client-safe helper untuk URL berkas Cloudflare R2
 */

/**
 * Normalisasi URL file R2 ke proxy route /api/files/<objectKey>.
 *
 * Menangani 3 format yang mungkin ada:
 *   1. URL absolut lama  : "https://pub-xxx.r2.dev/bast/file.pdf"   → "/api/files/bast/file.pdf"
 *   2. URL relatif baru  : "/api/files/bast/file.pdf"               → tidak berubah
 *   3. Object key saja   : "bast/file.pdf"                          → "/api/files/bast/file.pdf"
 */
export function toProxyUrl(urlOrKey: string | null | undefined): string {
  if (!urlOrKey) return "";

  // Sudah pakai proxy route
  if (urlOrKey.startsWith("/api/files/")) return urlOrKey;

  // URL absolut r2.dev atau r2.cloudflarestorage.com — ambil path-nya saja
  try {
    const parsed = new URL(urlOrKey);
    if (parsed.hostname.endsWith(".r2.dev") || parsed.hostname.endsWith(".r2.cloudflarestorage.com")) {
      return `/api/files${parsed.pathname}`;
    }
  } catch {
    // Bukan URL absolut (misal object key langsung)
  }

  // Object key biasa: "bast/file.pdf"
  return `/api/files/${urlOrKey.replace(/^\/+/, "")}`;
}
