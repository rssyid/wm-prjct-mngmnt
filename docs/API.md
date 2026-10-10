# API.md — Rancangan API (v2)

> **Perubahan v2:** endpoint kedatangan berulang (deliveries), attempt approval, guard role per aksi
> kritis (BAST verify, cancel), progres mingguan (409 duplikat minggu), presign upload R2,
> response cache dashboard. Selaras dengan WORKFLOW.md & DATABASE.md v2.

## 1. Arsitektur API

- **Gaya:** REST via Next.js Route Handlers, JSON over HTTPS. Base: `/api`.
- **Auth:** cookie session NextAuth (JWT). Tanpa session → 401; role tidak berhak → 403. Setiap handler: `requireRole` → Zod → service → response.
- **Rate limit:** `/api/auth/**` dan `/api/uploads/presign` dibatasi via Upstash (mis. 10 percobaan login / 5 menit / IP+email).
- **Kunci read-only:** semua mutasi pada proyek `COMPLETED` → 409 "Proyek sudah selesai dan terkunci" (B9).

### Matriks Otorisasi (diperketat)

| Aksi | SUPER_ADMIN | WM_HO_SPECIALIST | MANAGEMENT_VIEWER |
|------|:-:|:-:|:-:|
| GET (baca semua) | ✅ | ✅ | ✅ |
| CRUD proyek, AR, paket, progres, deliveries | ✅ | ✅ | ❌ |
| CRUD master data | ✅ | ✅ | ❌ |
| Tombol transisi manual (Mulai Survei, Mulai Pekerjaan, Ajukan BAST, ON_HOLD) | ✅ | ✅ | ❌ |
| Cancel proyek, verifikasi BAST, CRUD user, restore/purge | ✅ | ❌ | ❌ |

## 2. Daftar Endpoint

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/callback/credentials` | Login (rate limited) |
| GET | `/api/health` | Liveness + `SELECT 1` (untuk cron pemanas) |
| POST | `/api/uploads/presign` | Presigned PUT URL R2 (validasi MIME, ≤ 10 MB, role check) |
| GET | `/api/dashboard/stats` | KPI & hitungan EWS (cache Upstash TTL 60 s) |
| GET/POST/PUT/DELETE | `/api/master?type=...` | CRUD master |
| GET/POST/PUT | `/api/users` | Manajemen user |
| GET/POST | `/api/projects` | List (paginasi server, search debounce) & buat proyek (kode dari counter) |
| GET/PUT/DELETE | `/api/projects/[id]` | Detail, update, soft delete (berantai) |
| GET/POST | `/api/projects/deleted` | Recycle bin & restore (SUPER_ADMIN) |
| POST | `/api/projects/[id]/transition` | Transisi manual: Mulai Survei, Mulai Pekerjaan, Ajukan BAST, ON_HOLD, Lanjutkan, Cancel (lihat §3.3) |
| GET/PUT | `/api/projects/[id]/afce` | Upsert AFCE + approval attempt aktif |
| POST | `/api/projects/[id]/afce/resubmit` | Attempt baru setelah REJECTED (history lama utuh) |
| GET/POST | `/api/projects/[id]/supplementary` | AR tambahan (paralel, tanpa ubah status) |
| POST | `/api/projects/[id]/packages` | Buat paket — **403 bila AFCE belum APPROVED** (B3) |
| PUT/DELETE | `/api/projects/[id]/packages/[packageId]` | Update tahap pengadaan |
| GET/POST | `/api/projects/[id]/packages/[packageId]/deliveries` | Kiriman berulang (§3.4) |
| POST | `/api/projects/[id]/progress` | Log progres mingguan — **409 bila (workPackageId, weekNo) sudah ada** |
| PUT/DELETE | `/api/projects/[id]/progress/[logId]` | Edit/hapus — hanya minggu berjalan, lainnya 409 |
| POST/PUT/DELETE | `/api/projects/[id]/equipment` | Log alat berat |
| PUT | `/api/projects/[id]/bast` | Upsert BAST (upload draf) |
| POST | `/api/projects/[id]/bast/verify` | Verifikasi BAST — **SUPER_ADMIN saja** → COMPLETED |
| GET | `/api/reports?type=...` | Endpoint Laporan Terpadu: `project-status`, `procurement-outstanding`, `budget-realization`, `approval-matrix`, `project-progress` (lihat §3.6) |

## 3. Endpoint Krusial

### 3.1 `POST /api/projects` & Master Data
- **Pembuatan Proyek (`POST /api/projects`)**: Response `201` menghasilkan `projectCode` unik berformat `WM-{COMPANY}-{YYYY}-{SEQ4}` via `ProjectCodeCounter` atomik. Menerima payload komprehensif termasuk `budgetType`, `locationType`, `geoCoordinates` (GeoJSON), `constructionPlanStartDate`, `constructionPlanEndDate`, dan target baseline.
- **Master Data (`/api/master?type=...`)**:
  - `type=region`: Kode, nama, operasional (`ops`), dan nomor urut tampilan (`order`).
  - `type=company`: Kode, nama, alias operasional (`alias`), wilayah (`ops`), nomor urut (`order`), dan `regionId`.
  - `type=estate`: Kode, nama kebun, `companyId`, `ops`, `region`, grup kebun (`group`), kode baru (`estateNew`), kode warisan (`legacyCode`), dan urutan (`order`).
  - `type=block`: `estateId`, `blockCode`, `name`, `plantingYear`, dan luas hektar `areaHectares`.
  - `type=item`: Master material, mendukung batch import via spreadsheet Excel (`itemImportBatchSchema`).
  - `type=holiday`: Master hari libur, mendukung bulk CSV/JSON upload array (`holidayBulkSchema`).
  - `type=vendor`, `type=uom`, `type=category`, `type=structure`, `type=variant` (termasuk template `defaultBoqItems`).

### 3.2 `PUT /api/projects/[id]/afce`
- Mengisi `rabReady=true` → sistem set proyek `RAB_READY` (bila masih SURVEY) dan `emailSubmitted=true` → `WAITING_AFCE_AR`, di transaksi yang sama.
- Mengubah status level N ke `Approved` saat N-1 belum Approved → 400 "Approval harus berurutan".
- Semua level `Approved` → `AfceDocument.status = APPROVED` + proyek `AFCE_AR_APPROVED`.
- Level ditolak → `AfceDocument.status = REJECTED`, proyek kembali `RAB_READY`; attempt berikutnya via `/afce/resubmit` (`attemptNo + 1`, history utuh).

### 3.3 `POST /api/projects/[id]/transition`
```json
{ "action": "START_PHYSICAL_WORK", "remarks": "Galian dimulai 02/11" }
```
`action`: `START_SURVEY | START_PHYSICAL_WORK | REQUEST_BAST | HOLD | RESUME | CANCEL`. `HOLD` wajib `reason`; `CANCEL` hanya SUPER_ADMIN; service memvalidasi terhadap tabel T1–T10 (WORKFLOW.md) → transisi ilegal = 409.

### 3.4 `POST / PUT /api/projects/[id]/packages`
- **Gerbang B3**: Ditolak 403 bila `AfceDocument.status != APPROVED`.
- **Dual-Track Scheduling**:
  - `hasPhysicalWork = true` (default): Paket konstruksi/fisik wajib memiliki jadwal pengadaan (`procurementPlanStartDate` s/d `procurementPlanEndDate`) dan jadwal fisik lapangan (`planStartDate` s/d `planEndDate`).
  - `hasPhysicalWork = false`: Paket murni material/logistik; jadwal fisik dinonaktifkan, progres diukur dari pemenuhan volume kedatangan barang.
- **Validasi Bobot**: Akumulasi total `weightPct` seluruh paket per proyek tidak boleh melebihi 100%.

### 3.5 `POST /api/projects/[id]/packages/[packageId]/deliveries`
```json
{
  "deliveryDate": "2026-11-18",
  "deliveryOrderNo": "DO/SUP/11/0332",
  "notes": "Diterima lengkap, 2 batang retak minor",
  "items": [ { "packageItemId": "cm2pi001", "qtyReceived": 24 } ]
}
```
Efek dalam satu transaksi: insert `PackageDelivery` + `PackageDeliveryItem`; akumulasi `PackageItem.qtyReceived`; `WorkPackage.actualDeliveryDate` = tanggal kiriman terbaru; status paket → `PARTIALLY_DELIVERED` atau `DELIVERED` (bila Σ received ≥ planned); hitung `deliveryDelayDays`.

### 3.6 `POST /api/projects/[id]/bast/verify`
Role: SUPER_ADMIN. Body kosong atau `{ "notes": "..." }`. Mengisi `verifiedAt`, `verifiedById`, proyek → `COMPLETED`. **Tidak ada syarat LUNAS** (B8).

### 3.7 `GET /api/reports`
Mendukung 5 jenis laporan operasional terpusat via query param `type`:
- `project-status`: Status proyek komprehensif, KPI agregat (total, avg progress, counts per indicator).
- `procurement-outstanding`: Paket dengan paymentStatus != LUNAS atau belum DELIVERED/COMPLETED + kalkulasi delay hari.
- `budget-realization`: Perbandingan total anggaran rencana vs komitmen kontrak/PO vs realisasi bayar.
- `approval-matrix`: Matriks persetujuan AR 9-role SAP, approval attempt terkini, activeWaitingRole & SLA review days, penanganan role tidak perlu (`TIDAK_PERLU`).
- `project-progress`: Progres siklus hidup lengkap (Survei s/d BAST) dan rincian paket kerja 6-kolom dengan kategori proyek terkelompok.

**Parameter Filter Bersama:**
- `companyIds`: daftar ID perusahaan dipisahkan koma (multi-select filter berbasis Region).
- `companyId`: fallback ID perusahaan tunggal atau "ALL".
- `status`: filter `ProjectStatus`.
- `statusIndicator`: filter `StatusIndicator` (ON_TRACK, AT_RISK, DELAYED, COMPLETED).
- `search`: pencarian teks pada nama proyek atau kode proyek.
- `startDate` & `endDate`: rentang waktu berdasarkan tanggal target proyek.

## 4. Query Parameter List Proyek

`GET /api/projects?page=1&pageSize=20&search=...&status=...&indicator=...&companyId=...&sort=-updatedAt`
Selalu dengan filter `deletedAt: null`. Response memakai format standar `{ success, data, meta }`.

## 5. Format Standar & Error

Tidak berubah: sukses `{ success: true, data, meta? }`; gagal `{ success: false, error, details? }`. Kode: 400 validasi, 401, 403 (role/gerbang B3), 404, 409 (konflik: duplikat minggu, duplikat kode, transisi ilegal, proyek terkunci), 500 generik tanpa stack trace.
