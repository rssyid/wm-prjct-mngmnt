# STACK.md — Keputusan Tech Stack & Optimasi Free Tier

> **Konteks:** Aplikasi personal/portofolio (bukan komersial) — Vercel Hobby aman dipakai.
> **Skala beban:** ~10 user aktif, ~50 foto progres/minggu (~1,3 GB/tahun setelah kompresi).
> **Status:** Menggantikan bagian "Tech Stack" di Architecture.md. Versi 1.0 · 07/10/2026.

## 1. Matriks Keputusan Stack

| Layer | Keputusan Final | Limit Gratis / Bulan | Keterangan |
|-------|-----------------|----------------------|------------|
| Hosting | **Vercel Hobby** | 100 GB transfer, 1 jt function invocations, 4 CPU-jam, 5.000 image transformations, Blob 1 GB | Boleh karena non-komersial. Blob TIDAK dipakai untuk file aplikasi |
| Database | **Neon Free** (region Singapore `sin1`) | 0,5 GB storage/project, 20 GB total, 100 CU-jam compute, scale-to-zero 5 menit idle, 10 branches/project | Branch `dev` untuk preview |
| Storage file | **Cloudflare R2** | 10 GB storage, 1 jt Class A (write), 10 jt Class B (read), egress Rp0 | Dipilih karena Vercel Blob hanya 1 GB (~9 bulan untuk beban foto) |
| Cache + rate limit | **Upstash Redis** | 500 ribu commands, 256 MB, 10 GB bandwidth | Cache dashboard stats + rate limit login |
| CI/CD | **GitHub Actions** (repo privat) | 2.000 menit, 500 MB artifact | Lint + typecheck + build saja; deploy ditangani Vercel Git Integration |
| Monitoring | **Vercel Logs + Sentry Free** | Vercel simpan runtime log 1 jam; Sentry untuk jejak error jangka panjang | Setup Sentry sejak awal sebelum user aktif |
| Auth / ORM / UI | NextAuth v4 JWT, Prisma 5, Next.js 14 + Tailwind + shadcn/ui | — | Tidak berubah dari Architecture.md |

## 2. Masalah Performa Utama: Cold Start Neon

Dengan 10 user, aplikasi akan sering idle > 5 menit → Neon *scale to zero* → query pertama lambat 1–3 detik. Mitigasi wajib (bukan opsional):

1. **Driver serverless:** gunakan `@neondatabase/serverless` via Prisma adapter (`@prisma/adapter-neon`) agar koneksi lewat HTTP/WebSocket, bukan TCP handshake yang lambat saat cold start.
2. **Dua connection string tetap dipertahankan:** runtime memakai URL `-pooler` (`DATABASE_URL`), migrasi memakai `DIRECT_URL`.
3. **Cache dashboard:** response `GET /api/dashboard/stats` di-cache di Upstash dengan TTL 60 detik (key: `dash:{companyId?}`). Invalidasi manual saat ada mutasi progres/paket/proyek. Mengurangi hit ke Neon sekaligus mempercepat.
4. **Cron pemanas (opsional):** Vercel Cron Hobby terbatas; cukup 1 cron harian memanggil `GET /api/health` yang melakukan `SELECT 1`. Tujuannya bukan menjaga Neon tetap panas sepanjang hari, melainkan memanaskan sebelum jam kerja mulai.
5. **Query hemat:** semua endpoint list wajib `select`/`include` seperlunya + `@@index` sesuai DATABASE.md v2. Di 0,25 vCPU, query tanpa index akan terasa.

## 3. Anggaran Penggunaan (safety margin)

| Metrik | Perkiraan Pemakaian | Kuota | Headroom |
|--------|--------------------:|------:|---------:|
| Function invocations | 5–10 rb/hari (~200 rb/bln, termasuk dashboard auto-refresh 60 s) | 1.000 rb | 5x |
| Fast Data Transfer | < 5 GB | 100 GB | 20x |
| Image transformations (next/image) | 0 — foto disajikan langsung dari R2 | 5.000 | — |
| Neon compute | < 30 CU-jam | 100 CU-jam | 3x |
| Neon storage | < 200 MB tahun pertama | 500 MB | wajar |
| R2 storage | 1,3 GB/tahun | 10 GB | 7+ tahun |
| Upstash commands | < 100 rb | 500 rb | 5x |

Kesimpulan: tidak ada kuota yang terancam dalam ≥ 2 tahun; fokus optimasi adalah **latensi**, bukan kuota.

## 4. Pengiriman Foto (R2)

1. Kompresi di **client** sebelum upload: canvas resize maks sisi 1600 px, JPEG quality 0,8 → target ≤ 500 KB/foto.
2. Client meminta **presigned PUT URL** ke `POST /api/uploads/presign` (auth + validasi MIME/ukuran di server), lalu upload langsung ke R2 — file tidak transit lewat function Vercel.
3. Foto disajikan via public URL R2 (atau Worker + custom domain). **Jangan** lewat `next/image` optimizer untuk foto R2 agar kuota 5.000 image transformations tidak terpakai.
4. DB hanya menyimpan URL (Json array di ProgressLog, kolom fileUrl di dokumen) — tidak berubah dari skema.

## 5. Keputusan yang Ditolak (dengan alasan)

- Vercel Blob sebagai storage utama — 1 GB habis < 1 tahun.
- Migrasi ke Cloudflare Pages/Workers — tidak perlu untuk aplikasi non-komersial; App Router penuh lebih produktif.
- DB self-host di VPS — beban operasional tidak sebanding untuk skala 10 user.
- Redis lokal / node-cache — tidak persisten antar instance serverless.
