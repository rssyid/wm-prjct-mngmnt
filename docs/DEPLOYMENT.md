# DEPLOYMENT.md (v2)

> Perubahan v2: storage final = Cloudflare R2 (Vercel Blob dihapus), tambahan Upstash, adapter Neon,
> cron pemanas, Sentry. Target: Vercel Hobby + Neon Free + R2 Free + Upstash Free.

## 1. Environment Variables (`.env.example`)

```bash
# ── Database (Neon, region Singapore) ───────────────────────
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"

# ── NextAuth ────────────────────────────────────────────────
NEXTAUTH_SECRET="generate-via-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# ── Cloudflare R2 (storage utama) ───────────────────────────
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="wm-prjct-files"
R2_PUBLIC_BASE_URL="https://files.example.com"   # public bucket domain / Worker

# ── Upstash Redis (cache dashboard + rate limit) ────────────
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# ── Monitoring ──────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""                              # source maps (opsional)

# ── App ─────────────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME="WM PRJCT MNGMNT"
NEXT_PUBLIC_MAP_DEFAULT_LAT="0.5071"
NEXT_PUBLIC_MAP_DEFAULT_LNG="101.4478"
MAX_UPLOAD_MB="10"

# ── Seed (dev/awal saja) ────────────────────────────────────
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="ChangeMe!123"
CRON_SECRET=""                                    # proteksi /api/health bila dipanggil cron
```

> `schema.prisma` wajib `directUrl = env("DIRECT_URL")`. Prisma Client memakai adapter Neon serverless di runtime.

## 2. Persiapan Lokal

```bash
git clone <repo-url> wm-prjct-mngmnt && cd wm-prjct-mngmnt
npm ci && cp .env.example .env
npx prisma migrate dev
npm run db:seed          # admin + master + HARI LIBUR tahun berjalan (wajib, lihat WORKFLOW.md §4)
npm run dev
```

## 3. Deploy ke Vercel (Hobby) — langkah baku

1. **Neon:** project baru region **Singapore**; simpan pooled + direct URL; buat branch `dev` untuk Preview.
2. **Upstash:** database gratis region Singapore; simpan REST URL + token.
3. **Cloudflare R2:** bucket `wm-prjct-files`; aktifkan public access (atau Worker + custom domain); buat API token scope bucket.
4. **Vercel:** import repo; Build Command `prisma generate && prisma migrate deploy && next build`; Node 20.x; region function `sin1`.
5. Isi semua env untuk Production **dan** Preview (Preview memakai Neon branch `dev`).
6. `vercel.json`: 1 cron harian (mis. `0 0 * * *` UTC ≈ 07:00 WIB) memanggil `/api/health` dengan header `Authorization: Bearer $CRON_SECRET` — memanaskan Neon sebelum jam kerja.
7. Deploy → login admin seed → **ganti password segera**.
8. Seed produksi sekali dari lokal (`DATABASE_URL` produksi), termasuk hari libur.
9. Custom domain + Sentry project (DSN di env) sebelum UAT.

## 4. CI/CD (GitHub Actions)

Tetap: PR → lint + typecheck + `prisma validate` + build → Vercel Preview; merge `main` → Production. Kuota privat: 2.000 menit/bulan — estimasi pemakaian 5–8 menit per run, headroom besar. Proteksi `main`: CI hijau + 1 approval.

## 5. Cadangan & Batas Free Tier (ringkas)

- Neon: 0,5 GB storage, 100 CU-jam — jauh dari batas pada 10 user (lihat STACK.md §3).
- R2: 10 GB ≈ 7+ tahun foto pada 50 foto/minggu terkompresi.
- Upstash: 500 rb commands/bulan — dashboard cache + rate limit ≈ < 100 rb.
- Vercel: 1 jt invocations — estimasi < 250 rb/bulan.

## 6. Checklist Go-Live

- [x] `NEXTAUTH_SECRET` kuat; fallback hard-coded DIHAPUS dari `lib/auth.ts` & `middleware.ts`
- [x] Migrasi via `prisma migrate deploy` (bukan db push); baseline sudah dibuat & script `db:deploy` siap
- [x] Rate limit login & presign aktif (Upstash)
- [x] Driver serverless Neon aktif di `lib/prisma.ts`
- [x] Cache dashboard 60 s + invalidasi setelah mutasi
- [x] Foto terkompresi client-side & URL publik R2 bekerja
- [x] Hari libur tahun berjalan ter-seed & alert EWS aktif
- [ ] Password admin diganti; kode proyek teruji unik (dua proyek paralel)
- [x] Sentry menangkap error produksi (`@sentry/nextjs` client/server/edge & `next.config.mjs` terhubung)
- [ ] UAT 3 role + alur AR → approval (tolak 1x, resubmit) → PO → 2x kiriman → progres mingguan → BAST verify → COMPLETED terkunci

