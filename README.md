# WM PRJCT MNGMNT (Water Management Project Management)

Sistem Informasi Manajemen Proyek Tata Air (Water Management) perkebunan terintegrasi dari inisiasi, perizinan AFCE/AR (SAP), pengadaan material, realisasi progres fisik lapangan, hingga serah terima BAST.

---

## 🚀 Fitur Utama

- **Inisiasi Proyek & Registrasi**: Kode proyek terstandarisasi per Estate/Wilayah, penomoran urut otomatis di dalam transaksi atomik (`ProjectCodeCounter`).
- **Alur Persetujuan AFCE/AR Berjenjang**: Matriks persetujuan 9 tingkat (hingga VPA/CEO), snapshot attempt, penolakan dan resubmission dengan preservasi riwayat audit.
- **WBS Matriks & Dual-Track Timeline**:
  - Penjadwalan paket pengadaan material murni (`hasPhysicalWork = false`) dan paket fisik lapangan terintegrasi (`hasPhysicalWork = true`).
  - Sinkronisasi otomatis tanggal aktual penyelesaian (`actualEndDate`) ketika realisasi fisik mencapai 100%.
  - Visualisasi Gantt Chart responsif dan Kurva S deviasi rencana vs realisasi.
- **Log Progres & Kedatangan Berulang**: Pencatatan kedatangan bertahap per item material, log progres mingguan tertimbang, dokumentasi foto lapangan (terkompresi langsung ke Cloudflare R2), serta log HM alat berat.
- **Sistem Laporan Komprehensif (3-Tab)**:
  - **Tab 1: Ringkasan Eksekutif** (KPI Portofolio & Status Proyek).
  - **Tab 2: Progres & Fisik Lapangan** (Tabel 6-Kolom Padat tanpa scroll horizontal).
  - **Tab 3: Status Pengadaan & Material** (Outstanding PO, Keterlambatan Kiriman, dan Pembayaran).
  - Filter multi-select perusahaan (`nuqs`) & ekspor instan client-side ke PDF (lanskap rapi) dan Excel (multi-sheet).
- **Spasial & GIS**: Integrasi peta Leaflet dan pembaca shapefile (`shpjs`) untuk batas blok perkebunan.
- **Keamanan & Performa**: Autentikasi NextAuth Credentials, RBAC (SUPER_ADMIN, WM_HO_SPECIALIST, MANAGEMENT_VIEWER), proteksi status proyek terkunci (`COMPLETED`), cache Upstash Redis dengan invalidasi domain, dan monitoring error produksi via Sentry.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Framework** | Next.js 14 (App Router), TypeScript, React 18 |
| **Styling & UI** | Tailwind CSS, shadcn/ui, Lucide Icons, Radix UI |
| **State & Table** | TanStack Query v5, TanStack Table v8, `nuqs` (URL Query State) |
| **Database & ORM** | PostgreSQL (Neon Serverless via `@prisma/adapter-neon`), Prisma ORM |
| **Cache & Limit** | Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`) |
| **File Storage** | Cloudflare R2 via AWS SDK S3 Presigned URL |
| **GIS & Chart** | Leaflet, `react-leaflet`, `shpjs`, Recharts, `motion` |
| **Ekspor Dokumen** | `jspdf`, `jspdf-autotable`, `xlsx` (dynamic lazy import) |
| **Observability** | Sentry (`@sentry/nextjs`) |

---

## 📁 Dokumentasi Sistem (`docs/`)

Setiap pengembangan dan integrasi sistem mengacu pada dokumentasi terpadu di folder `docs/`:

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document, user stories, dan acceptance criteria.
- [`docs/DATABASE.md`](docs/DATABASE.md) — Skema database Prisma, relasi, indeks, dan aturan integritas data.
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — State machine proyek T1–T10, aturan bisnis B1–B14, dan alur approval.
- [`docs/API.md`](docs/API.md) — Spesifikasi REST API, route handlers, query params laporan, dan format respons.
- [`docs/design.md`](docs/design.md) — Standar desain UI/UX, sistem warna status, tabel 6-kolom padat, dan guideline komponen.
- [`docs/STACK.md`](docs/STACK.md) — Rincian pustaka, arsitektur serverless, dan batas layanan free-tier.
- [`docs/Rules.md`](docs/Rules.md) — Konvensi koding, format numerik/tanggal, penanganan error, dan validasi Zod.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Panduan konfigurasi environment, migrasi DB, CORS R2, dan deploy Vercel.
- [`docs/QUICKSTART.md`](docs/QUICKSTART.md) — Panduan inisiasi dan setup environment developer lokal.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — Panduan eksekusi fase pengembangan (P1–P16).
- [`docs/task.md`](docs/task.md) — Checklist tracking implementasi fitur end-to-end.

---

## 💻 Memulai Pengembangan Lokal

1. **Clone repository dan install dependencies**:
   ```bash
   git clone <repo-url> wm-prjct-mngmnt
   cd wm-prjct-mngmnt
   npm install
   ```

2. **Setup Environment**:
   Salin file `.env.example` menjadi `.env` dan lengkapi konfigurasi database Neon serta NextAuth secret:
   ```bash
   cp .env.example .env
   ```

3. **Migrasi & Seed Database**:
   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```

4. **Jalankan Development Server**:
   ```bash
   npm run dev
   ```
   Akses aplikasi di [http://localhost:3000](http://localhost:3000).

5. **Lint & Build Verification**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   ```
