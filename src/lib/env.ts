/**
 * Ambil env wajib. TIDAK ADA fallback — lempar error bila kosong (Rules.md §7).
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} belum diset`);
  }
  return value;
}
