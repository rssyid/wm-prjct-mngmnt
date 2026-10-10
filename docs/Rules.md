# Rules.md — Coding Standards (v2)

> Aturan WAJIB untuk developer & AI Coding Assistant. Perubahan v2 ditandai 🆕.

## 1. Aturan Umum

- TypeScript strict; hindari `any`; pakai tipe `@prisma/client` / `z.infer<>`.
- Teks UI & error user: Bahasa Indonesia. Kode: Inggris (istilah domain baku dipertahankan: `noAr`, `noPrUspk`, `noPoSpk`, `bast`).
- Import via alias `@/`. Tidak menambah dependency tanpa alasan kuat.
- 🆕 Dependency UI berstatus baku: TanStack Table, cmdk, nuqs, TanStack Query (lihat design.md §4). Jangan menggantinya tanpa diskusi.
- Satu komponen = satu file; > 400 baris → pecah.

## 2. Konvensi Penamaan

Tidak berubah dari v1 (kebab-case file, PascalCase komponen, `use-xxx` hooks, `xxxSchema` Zod, `xxx.service.ts`, enum UPPER_SNAKE_CASE, route kebab plural, boolean `is/has/can`).

## 3. Next.js App Router

- Default Server Component; `"use client"` hanya bila perlu. Leaflet/chart/export = `dynamic(..., { ssr: false })` 🆕 atau import dinamis saat aksi user.
- 🆕 State filter halaman list WAJIB via nuqs (query string), bukan `useState` lokal.
- 🆕 Fetch & mutasi client WAJIB via TanStack Query; setelah mutasi gunakan `invalidateQueries`, bukan manipulasi state manual.
- 🆕 Komponen tabel data WAJIB TanStack Table + styling shadcn; jangan render `<table>` mentah untuk data > 20 baris.
- 🆕 Input angka uang/kuantitas besar WAJIB menggunakan `FormattedNumberInput` (separator ribuan otomatis, auto-select nol saat fokus).
- 🆕 Format tanggal pada tabel data padat WAJIB hemat ruang: gunakan helper `formatDayMonth` (`dd/mm`).

## 4. Route Handler Pattern

Urutan baku: **Auth → Authorize → Validate (Zod) → Execute (service/transaksi) → Respond**.
🆕 Tambahan wajib:
- Sebelum mutasi apa pun pada proyek: cek status ≠ `COMPLETED` (guard imutabilitas, B9) → 409.
- Sebelum membuat WorkPackage: cek `AfceDocument.status === "APPROVED"` (gerbang B3) → 403.
- Transisi status hanya lewat `project-transition.service.ts` yang membaca tabel WORKFLOW.md §2; handler lain DILARANG mengubah `Project.status` langsung (kecuali DRAFT saat create).

## 5. Error Handling

- `handleApiError(error, fallbackMessage)`; P2002 → 409, P2025 → 404, AppError → sesuai; jangan bocorkan stack di production.
- 🆕 409 dipakai juga untuk: log minggu duplikat (UNIQUE(workPackageId, weekNo)), transisi ilegal, proyek terkunci.
- Client: toast/FeedbackModal; tidak `alert()`.

## 6. Database & Prisma

- Singleton `prisma` dari `@/lib/prisma` dengan **`@prisma/adapter-neon`** (driver serverless) 🆕.
- Multi-tabel → `$transaction`. Kode proyek WAJIB dari `ProjectCodeCounter` upsert+increment di dalam transaksi create 🆕.
- Filter `deletedAt: null` di semua list. `select`/`include` seperlunya.
- Migrasi: `prisma migrate dev/deploy`; `db push` hanya untuk eksperimen lokal.
- Uang: `Decimal(18,2)`; tampilkan `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" })`.

## 7. Keamanan

- Tidak ada `NEXTAUTH_SECRET` fallback — lempar error bila env hilang.
- `requireRole` di SEMUA handler non-auth (middleware bukan satu-satunya pertahanan).
- 🆕 Rate limit Upstash untuk `/api/auth/**` dan `/api/uploads/presign`.
- 🆕 Upload: server hanya menerbitkan presigned URL (R2) setelah valiasi MIME (`image/*`, `application/pdf`, `.xlsx`) dan ukuran ≤ 10 MB; client WAJIB mengompres foto ≤ 1600 px JPEG q0.8 sebelum meminta presign.
- 🆕 Foto R2 disajikan langsung (tanpa `next/image` optimizer) untuk menjaga kuota image transformations.

## 8. Performa

- Paginasi server-side untuk list > 50 baris; debounce search 300 ms.
- Index sesuai DATABASE.md v2 — PR tanpa index baru untuk kolom filter baru akan ditolak di review.
- 🆕 `GET /api/dashboard/stats` dibaca via cache Upstash (TTL 60 s, key `dash:global`); invalidate setelah mutasi domain.
- Memoize data Gantt/S-Curve (`useMemo`); hindari N+1; aggregate via `groupBy`/`_count`.

## 9. Git & Commit

Conventional Commits; branch `feat/` `fix/`; lolos lint + typecheck + build sebelum merge.

## 10. Checklist AI Assistant 🆕

- [ ] Sudah baca `WORKFLOW.md` sebelum menyentuh transisi status?
- [ ] Sudah baca `DATABASE.md` sebelum query/skema?
- [ ] Endpoint baru: auth guard + Zod + guard B3/B9 bila relevan?
- [ ] Tabel baru → TanStack Table? Filter baru → nuqs? Fetch baru → TanStack Query?
- [ ] Tidak menghapus docstring yang tidak terkait?
