# task.md — Roadmap Eksekusi (v2, di-reset per 07/10/2026)

> Legenda: `[x]` selesai · `[ ]` belum. Acuan: PRD v1.1, WORKFLOW.md, DATABASE.md v2, API.md v2, STACK.md, Rules v2, design v2.

## Phase A — Fondasi & Utang Teknis (prioritas tertinggi)

- [x] Hapus fallback `NEXTAUTH_SECRET` di `lib/auth.ts` & `middleware.ts` (lempar error bila kosong)
- [x] `src/types/next-auth.d.ts` (hilangkan `as any` pada session)
- [x] `requireSession()/requireRole()` diterapkan di SEMUA Route Handler
- [x] Baseline `prisma migrate` (berhenti pakai db push di luar lokal)
- [x] Migrasi uang `Float` → `Decimal(18,2)` — SEBELUM data transaksi menumpuk
- [x] Status String → enum: PackageStatus, AfceStatus, ApprovalStatus
- [x] `@@index` lengkap sesuai DATABASE.md v2
- [ ] Pasang zod + react-hook-form + @hookform/resolvers; ESLint + Prettier + Husky/lint-staged

## Phase B — Model & Service Baru

- [x] Model: `Item`, `PackageItem`, `PackageDelivery`, `PackageDeliveryItem`, `SupplementaryAr`, `ProjectCodeCounter`, `AuditLog`
- [x] `attemptNo` pada AFCE/ApprovalSnapshot; history attempt tidak pernah diubah
- [x] `deletedAt` pada WorkPackage/ProgressLog/HeavyEquipmentLog (soft delete berantai)
- [x] `project-transition.service.ts` — SATU-SATUNYA pintu transisi status (tabel T1–T10); guard B9 (COMPLETED terkunci), guard B3 (AFCE APPROVED)
- [x] Generator kode proyek via counter dalam transaksi
- [x] Seed hari libur nasional per tahun (+ input manual di master)
- [x] Agregasi progres tertimbang terpusat dalam transaksi (mutasi log/paket)

## Phase C — Fitur Revisi

- [x] Master Item CRUD (import Excel di tahap berikutnya)
- [ ] Master lokasi Region/Company/Estate/Block UI CRUD lengkap
- [x] Line item per paket (Master Item, qty plan vs received)
- [x] UI kiriman berulang (deliveries) + keterlambatan dari kiriman terakhir
- [x] Resubmit AFCE setelah REJECTED (attempt baru); UI history approval
- [x] Progres mingguan: validasi 1 log/paket/minggu; edit hanya minggu berjalan
- [ ] Verifikasi BAST khusus SUPER_ADMIN; proyek COMPLETED read-only di UI
- [x] Paginasi server + search debounce di list proyek
- [ ] Gantt portofolio; laporan PDF/Excel (status, outstanding payment, realisasi anggaran)
- [ ] Upload dokumen & foto via presign R2 + kompresi client (≤1600 px, q0.8)

## Phase D — Performa & Stack

- [x] Adapter `@prisma/adapter-neon` di `lib/prisma.ts`; region `sin1` untuk Vercel & Neon & Upstash
- [ ] Cache `/api/dashboard/stats` di Upstash (TTL 60 s) + invalidasi mutasi
- [ ] Rate limit `/api/auth/**` & `/api/uploads/presign`
- [ ] Foto R2 tanpa `next/image` optimizer; komponen berat tetap lazy/dinamis
- [ ] Cron harian `/api/health` (pemanasan pra-jam-kerja) + `CRON_SECRET`

## Phase E — UI/UX (design v2)

- [x] Migrasi tabel → TanStack Table; filter → nuqs; fetch → TanStack Query
- [ ] Command palette cmdk (Ctrl+K)
- [x] Konstanta status terpusat `lib/constants/status.ts` (skeleton & kartu mobile pada fase tabel)
- [x] Font Inter + JetBrains Mono via next/font; dark mode kontras ditingkatkan
- [ ] AlertDialog + alasan wajib untuk HOLD/CANCEL; audit aksesibilitas
- [ ] Pecah `projects/[id]/page.tsx` menjadi komponen domain

## Phase F — Rilis

- [ ] `.env.example` final (R2, Upstash, Sentry, CRON_SECRET)
- [ ] GitHub Actions CI hijau; Vercel Production + Preview (Neon branch `dev`)
- [ ] Sentry aktif; custom domain + HTTPS
- [ ] Go-live checklist DEPLOYMENT.md §6 semua tercentang; UAT 3 role + full flow termasuk resubmit AR & dua kiriman
