# DATABASE.md — Kamus Data & Skema Database Lengkap (Live Neon PostgreSQL)

> **DBMS:** PostgreSQL 16 (Neon Serverless, region Singapore)  
> **Driver Adapter:** `@prisma/adapter-neon` (WebSocket serverless via `@neondatabase/serverless`)  
> **Sumber Kebenaran:** Database Live Neon (`ep-calm-water-b3jlnd37.c-4.ap-southeast-1.aws.neon.tech`) & `prisma/schema.prisma`  
> **Integritas:** Total 26 tabel entitas domain + 14 enum kustom. Seluruh nilai uang memakai `numeric(18,2)`, volume item memakai `numeric(18,3)`, dan progres/bobot memakai `float8` / `Float`.

---

## 1. Enum Database (14 Enum Kustom)

Semua status dan kategori pada sistem menggunakan ENUM PostgreSQL tanpa tipe `String` bebas:

| Enum | Nilai-Nilai Aktif |
|---|---|
| `Role` | `SUPER_ADMIN`, `WM_HO_SPECIALIST`, `MANAGEMENT_VIEWER` |
| `ProjectStatus` | `DRAFT`, `SURVEY`, `RAB_READY`, `WAITING_AFCE_AR`, `AFCE_AR_APPROVED`, `PROCUREMENT`, `EXECUTION`, `WAITING_BAST`, `COMPLETED`, `ON_HOLD`, `CANCELLED` |
| `StatusIndicator` | `ON_TRACK`, `AT_RISK`, `DELAYED`, `COMPLETED` |
| `BudgetType` | `CAPEX_BUDGETED`, `OPEX_BUDGETED`, `PTA`, `UNBUDGETED` |
| `LocationType` | `POINT`, `LINE`, `POLYGON` |
| `PackageCategory` | `MATERIAL`, `FABRICATION`, `CONTRACTOR`, `HEAVY_EQUIPMENT`, `SWAKELOLA` |
| `PackageStatus` | `DRAFT`, `PR_SUBMITTED`, `PO_ISSUED`, `IN_DELIVERY`, `PARTIALLY_DELIVERED`, `DELIVERED`, `COMPLETED`, `CANCELLED` |
| `AfceStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `ApprovalStatus` | `WAITING`, `APPROVED`, `REJECTED` |
| `ApprovalDocType` | `AR`, `PR`, `PO` |
| `PackageDocType` | `PR`, `PO`, `DO`, `INVOICE`, `OTHER` |
| `PaymentStatus` | `BELUM_LUNAS`, `DALAM_PROSES`, `LUNAS` |
| `EquipmentOwnership` | `OWNED`, `RENTAL` |
| `AuditAction` | `CREATE`, `UPDATE`, `DELETE`, `RESTORE`, `PURGE`, `TRANSITION`, `LOGIN_FAILED` |

---

## 2. Akun & Otentikasi

### Model `User`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `email` | `text` | `String` | **Tidak (NOT NULL)** | — | Alamat surel login pengguna (disimpan lowercase, UNIQUE) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama lengkap pengguna |
| `password` | `text` | `String` | **Tidak (NOT NULL)** | — | Hash sandi bcrypt (server-side only, dilarang expose) |
| `role` | `Role` | `Role` | **Tidak (NOT NULL)** | `'WM_HO_SPECIALIST'::"Role"` | Peran hak akses: SUPER_ADMIN, WM_HO_SPECIALIST, atau MANAGEMENT_VIEWER |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif user (false = akun dinonaktifkan) |
| `rememberToken` | `text` | `String?` | Ya | — | Token sesi tambahan |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pembuatan akun |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan profil |

**Indeks & Unique Constraint:**
- `@@index([isActive])`

## 3. Master Data Wilayah & Operasional Perkebunan

### Model `Region`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `code` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode wilayah regional (contoh: REG1, UNIQUE) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama wilayah regional |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif wilayah |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |
| `ops` | `text` | `String?` | Ya | — | Operasional wilayah (contoh: SUMATERA, KALBAR, WILTIM) |
| `order` | `int4` | `Int` | **Tidak (NOT NULL)** | `0` | Nomor urut tampilan di UI selector |

### Model `Company`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `code` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode singkatan PT/perusahaan (contoh: THIP, UNIQUE) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama legal perusahaan |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif perusahaan |
| `regionId` | `text` | `String?` | Ya | — | Relasi ke Region (SetNull bila dihapus) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |
| `alias` | `text` | `String?` | Ya | — | Nama alias operasional (contoh: TH Indo Plantation) |
| `ops` | `text` | `String?` | Ya | — | Wilayah operasional kebun (SUMATERA, KALBAR, WILTIM) |
| `order` | `int4` | `Int` | **Tidak (NOT NULL)** | `0` | Nomor urut tampilan di UI selector |

**Indeks & Unique Constraint:**
- `@@index([regionId])`

### Model `Estate`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `companyId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Company induk (Cascade onDelete) |
| `code` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode estate (UNIQUE bersama companyId) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama kebun/estate |
| `region` | `text` | `String?` | Ya | — | Nama region internal |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif estate |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |
| `estateNew` | `text` | `String?` | Ya | — | Kode estate format baru (contoh: THP1..THP20, JJP1) |
| `group` | `text` | `String?` | Ya | — | Grup manajemen estate (contoh: THIP 1, Sumatera 1) |
| `legacyCode` | `text` | `String?` | Ya | — | Kode lama/warisan (contoh: KSB, KSR, KDP) |
| `ops` | `text` | `String?` | Ya | — | Operasional wilayah |
| `order` | `int4` | `Int` | **Tidak (NOT NULL)** | `0` | Nomor urut tampilan |

**Indeks & Unique Constraint:**
- `@@unique([companyId, code])`
- `@@index([order])`

### Model `Block`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `estateId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Estate (Cascade onDelete) |
| `blockCode` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode blok tanaman (UNIQUE bersama estateId) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama/keterangan blok |
| `plantingYear` | `int4` | `Int?` | Ya | — | Tahun tanam kelapa sawit |
| `areaHectares` | `float8` | `Float?` | Ya | — | Luas blok dalam hektar (Ha) |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif blok |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

**Indeks & Unique Constraint:**
- `@@unique([estateId, blockCode])`

### Model `FolderCategory`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `code` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode kategori proyek tata air (UNIQUE) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama kategori proyek |
| `description` | `text` | `String?` | Ya | — | Deskripsi cakupan kategori |
| `icon` | `text` | `String?` | Ya | — | Nama ikon visual Lucide |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif kategori |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

### Model `StructureType`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama tipe infrastruktur tata air (contoh: Pintu Air, Tanggul, Saluran, Jembatan, UNIQUE) |
| `description` | `text` | `String?` | Ya | — | Deskripsi tipe struktur |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif tipe struktur |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

### Model `StructureVariant`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `structureTypeId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke StructureType (Cascade onDelete) |
| `code` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode varian spesifik (UNIQUE bersama structureTypeId) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama spesifikasi varian |
| `description` | `text` | `String?` | Ya | — | Keterangan detail varian struktur |
| `defaultBoqItems` | `jsonb` | `Json?` | Ya | — | Template standar BOQ JSON: [{ itemCode, name, uom, qty }] |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif varian |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

**Indeks & Unique Constraint:**
- `@@unique([structureTypeId, code])`

### Model `Vendor`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama penyedia barang/jasa vendor |
| `category` | `PackageCategory` | `PackageCategory` | **Tidak (NOT NULL)** | — | Kategori spesialisasi vendor (MATERIAL, FABRICATION, CONTRACTOR, HEAVY_EQUIPMENT, SWAKELOLA) |
| `contactPerson` | `text` | `String?` | Ya | — | Nama kontak PIC vendor |
| `phone` | `text` | `String?` | Ya | — | Nomor telepon/kontak |
| `email` | `text` | `String?` | Ya | — | Surel vendor |
| `address` | `text` | `String?` | Ya | — | Alamat fisik kantor/workshop vendor |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif vendor |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

### Model `UnitOfMeasurement`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `code` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode satuan pengukuran (m, m3, unit, btg, kg, ls, UNIQUE) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama lengkap satuan ukuran |
| `description` | `text` | `String?` | Ya | — | Keterangan pemakaian satuan |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif satuan ukuran |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

### Model `Holiday`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `holidayDate` | `date` | `DateTime` | **Tidak (NOT NULL)** | — | Tanggal libur nasional / cuti bersama (Format Date, UNIQUE) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama hari libur nasional / hari besar |
| `year` | `int4` | `Int` | **Tidak (NOT NULL)** | — | Tahun kalender (wajib di-seed per tahun, WORKFLOW.md §4) |
| `description` | `text` | `String?` | Ya | — | Keterangan tambahan hari libur |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

**Indeks & Unique Constraint:**
- `@@index([year])`

### Model `PicOfficer`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama petugas PIC spesialis tata air |
| `roleTitle` | `text` | `String?` | Ya | — | Jabatan resmi (contoh: Water Management Specialist) |
| `phone` | `text` | `String?` | Ya | — | Nomor telepon petugas |
| `email` | `text` | `String?` | Ya | — | Alamat surel petugas |
| `companyIds` | `jsonb` | `Json?` | Ya | — | Daftar ID perusahaan yang diawasi (JSON array) |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif petugas PIC |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

### Model `Item`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `itemCode` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode unik item material (UNIQUE) |
| `name` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama barang / material konstruksi |
| `category` | `PackageCategory` | `PackageCategory` | **Tidak (NOT NULL)** | `'MATERIAL'::"PackageCategory"` | Kategori pengadaan barang (default MATERIAL) |
| `uomId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke UnitOfMeasurement (Restrict onDelete) |
| `specification` | `text` | `String?` | Ya | — | Spesifikasi teknis standar material |
| `standardPrice` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | `0` | Harga satuan standar (Numeric 18,2) |
| `isActive` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Status aktif item |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

**Indeks & Unique Constraint:**
- `@@index([uomId])`

## 4. Proyek & Penomoran Atomik

### Model `Project`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `projectCode` | `text` | `String` | **Tidak (NOT NULL)** | — | Kode terstandarisasi WM-{COMPANY}-{YYYY}-{SEQ4} (UNIQUE, Aturan B10) |
| `projectName` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama teknis proyek tata air |
| `displayName` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama tampilan proyek yang ramah pengguna |
| `folderCategoryId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi kategori folder kerja (Restrict onDelete) |
| `structureTypeId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi tipe struktur tata air (Restrict onDelete) |
| `companyId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Perusahaan pemilik proyek (Restrict onDelete) |
| `estateId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Estate lokasi kebun (Restrict onDelete) |
| `structureVariantId` | `text` | `String?` | Ya | — | Relasi ke varian tipe struktur (SetNull) |
| `blockId` | `text` | `String?` | Ya | — | Relasi blok perkebunan spesifik (SetNull) |
| `picId` | `text` | `String?` | Ya | — | Relasi ke master PicOfficer (SetNull) |
| `picName` | `text` | `String?` | Ya | — | Denormalisasi nama PIC untuk efisiensi kueri |
| `latitude` | `float8` | `Float?` | Ya | — | Koordinat lintang lokasi utama |
| `longitude` | `float8` | `Float?` | Ya | — | Koordinat bujur lokasi utama |
| `geoCoordinates` | `jsonb` | `Json?` | Ya | — | Data spasial poligon/polyline koordinat batas (JSON) |
| `locationType` | `LocationType` | `LocationType` | **Tidak (NOT NULL)** | `'POINT'::"LocationType"` | Tipe geometri spasial: POINT, LINE, POLYGON |
| `budgetType` | `BudgetType` | `BudgetType` | **Tidak (NOT NULL)** | `'CAPEX_BUDGETED'::"BudgetType"` | Tipe anggaran: CAPEX_BUDGETED, OPEX_BUDGETED, PTA, UNBUDGETED |
| `totalBudgetAmount` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | `0` | Total nilai pagu anggaran proyek (Numeric 18,2) |
| `targetQuantity` | `float8` | `Float?` | Ya | — | Target volume fisik yang akan dibangun |
| `uom` | `text` | `String?` | Ya | — | Satuan ukuran target volume fisik (m, m3, unit, dll) |
| `targetStartDate` | `timestamp` | `DateTime?` | Ya | — | Target tanggal awal baseline jadwal proyek |
| `targetEndDate` | `timestamp` | `DateTime?` | Ya | — | Target batas akhir penyelesaian proyek |
| `constructionPlanStartDate` | `timestamp` | `DateTime?` | Ya | — | Rencana awal pekerjaan konstruksi |
| `constructionPlanEndDate` | `timestamp` | `DateTime?` | Ya | — | Rencana akhir pekerjaan konstruksi |
| `revisedEndDate` | `timestamp` | `DateTime?` | Ya | — | Target tanggal penyelesaian yang telah direvisi |
| `estCompletionDate` | `timestamp` | `DateTime?` | Ya | — | Estimasi tanggal selesai berdasarkan laju progres lapangan |
| `progressPct` | `float8` | `Float` | **Tidak (NOT NULL)** | `0` | Agregat progres tertimbang: Σ(progressPct × weightPct / 100) |
| `status` | `ProjectStatus` | `ProjectStatus` | **Tidak (NOT NULL)** | `'DRAFT'::"ProjectStatus"` | Status siklus hidup proyek (HANYA via transition service T1–T10) |
| `statusBeforeHold` | `ProjectStatus` | `ProjectStatus?` | Ya | — | Status proyek sebelum ON_HOLD (disimpan untuk aksi RESUME T9) |
| `statusIndicator` | `StatusIndicator` | `StatusIndicator` | **Tidak (NOT NULL)** | `'ON_TRACK'::"StatusIndicator"` | Indikator EWS SLA terpusat: ON_TRACK, AT_RISK, DELAYED, COMPLETED |
| `onHoldReason` | `text` | `String?` | Ya | — | Alasan penahanan proyek (wajib saat status beralih ke ON_HOLD) |
| `cancellationReason` | `text` | `String?` | Ya | — | Alasan pembatalan proyek (wajib saat status beralih ke CANCELLED) |
| `sitePlanUrl` | `text` | `String?` | Ya | — | URL file gambar denah / site plan (Cloudflare R2) |
| `drawingUrl` | `text` | `String?` | Ya | — | URL file gambar teknik konstruksi (Cloudflare R2) |
| `boqItems` | `jsonb` | `Json?` | Ya | — | Snapshot daftar BOQ proyek (JSON array) |
| `surveyElevationData` | `jsonb` | `Json?` | Ya | — | Data hasil survei elevasi dan topografi (JSON) |
| `socializationSignOff` | `jsonb` | `Json?` | Ya | — | Bukti dokumen persetujuan sosialisasi kebun (JSON) |
| `createdById` | `text` | `String?` | Ya | — | ID user pembuat proyek (SetNull) |
| `deletedAt` | `timestamp` | `DateTime?` | Ya | — | Penanda waktu soft-delete proyek (Aturan B11) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu inisiasi proyek |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu mutasi data proyek terakhir |

**Indeks & Unique Constraint:**
- `@@index([status])`
- `@@index([statusIndicator])`
- `@@index([companyId])`
- `@@index([estateId])`
- `@@index([deletedAt])`
- `@@index([updatedAt])`

### Model `ProjectCodeCounter`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `companyId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Company pemilik counter (Restrict onDelete) |
| `year` | `int4` | `Int` | **Tidak (NOT NULL)** | — | Tahun kalender penomoran proyek (UNIQUE bersama companyId) |
| `lastSeq` | `int4` | `Int` | **Tidak (NOT NULL)** | `0` | Nomor urut proyek terakhir (di-increment dalam transaksi atomik B10) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pembuatan counter |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu increment counter |

**Indeks & Unique Constraint:**
- `@@unique([companyId, year])`

## 5. Administrasi & Approval AFCE/AR

### Model `AfceDocument`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `projectId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Project induk (1:1, UNIQUE, Cascade onDelete) |
| `noAr` | `text` | `String?` | Ya | — | Nomor dokumen AR resmi dari SAP (NULLABLE saat draft awal inisiasi) |
| `arType` | `text` | `String?` | Ya | — | Tipe dokumen AR (Capex, Opex, Urgent) |
| `budgetType` | `text` | `String?` | Ya | — | Kategori anggaran AR |
| `approvedAmount` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | `0` | Nilai nominal AR yang disetujui manajemen (Numeric 18,2) |
| `drawingReady` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `false` | Checklist kesiapan gambar teknik (drawing) |
| `rabReady` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `false` | Checklist kesiapan RAB (memicu transisi T2 RAB_READY) |
| `mapReady` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `false` | Checklist kesiapan peta lokasi tata air |
| `emailSubmitted` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `false` | Checklist pengiriman email permohonan AR (memicu T3 WAITING_AFCE_AR) |
| `emailSubmittedDate` | `timestamp` | `DateTime?` | Ya | — | Waktu pengiriman surel permohonan AR |
| `isSupplementary` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `false` | Flag apakah terdapat AR tambahan/suplemen |
| `supplementaryAmount` | `numeric` | `Decimal?` | Ya | — | Nilai nominal AR tambahan bila ada (Numeric 18,2) |
| `mcaApprovalDate` | `timestamp` | `DateTime?` | Ya | — | Tanggal persetujuan final manajemen/MCA |
| `currentAttempt` | `int4` | `Int` | **Tidak (NOT NULL)** | `1` | Nomor putaran pengajuan aktif (+1 setiap kali resubmit, B4) |
| `status` | `AfceStatus` | `AfceStatus` | **Tidak (NOT NULL)** | `'PENDING'::"AfceStatus"` | Status persetujuan dokumen AFCE: PENDING, APPROVED, REJECTED |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu inisiasi draft AFCE |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan status AFCE |

### Model `SupplementaryAr`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `projectId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Project induk (Cascade onDelete) |
| `noAr` | `text` | `String` | **Tidak (NOT NULL)** | — | Nomor dokumen AR suplemen |
| `amount` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | — | Nilai nominal AR suplemen (Numeric 18,2) |
| `notes` | `text` | `String?` | Ya | — | Catatan alasan pengajuan AR suplemen |
| `status` | `AfceStatus` | `AfceStatus` | **Tidak (NOT NULL)** | `'PENDING'::"AfceStatus"` | Status persetujuan AR suplemen (PENDING, APPROVED, REJECTED) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan |

**Indeks & Unique Constraint:**
- `@@index([projectId])`

### Model `ApprovalSnapshot`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `afceDocumentId` | `text` | `String?` | Ya | — | Relasi ke AfceDocument (Cascade onDelete) |
| `workPackageId` | `text` | `String?` | Ya | — | Relasi ke WorkPackage (Cascade onDelete) |
| `attemptNo` | `int4` | `Int` | **Tidak (NOT NULL)** | `1` | Nomor attempt pengajuan (Audit history tidak pernah dihapus, B4) |
| `documentType` | `ApprovalDocType` | `ApprovalDocType` | **Tidak (NOT NULL)** | — | Tipe dokumen persetujuan: AR, PR, PO |
| `approvalLevel` | `int4` | `Int` | **Tidak (NOT NULL)** | — | Tingkat persetujuan berjenjang berurutan ketat (1, 2, 3.. B2) |
| `role` | `text` | `String` | **Tidak (NOT NULL)** | — | Jabatan approver standar SAP: EM, GEM, RH, HP, MCA, CFO, COO, CEO, Chairman |
| `personName` | `text` | `String?` | Ya | — | Nama pejabat yang memaraf dokumen (tanpa FK User, B1) |
| `status` | `ApprovalStatus` | `ApprovalStatus` | **Tidak (NOT NULL)** | `'WAITING'::"ApprovalStatus"` | Status paraf: WAITING, APPROVED, REJECTED |
| `submittedAt` | `timestamp` | `DateTime?` | Ya | — | Waktu pengajuan paraf ke pejabat bersangkutan |
| `approvedAt` | `timestamp` | `DateTime?` | Ya | — | Waktu pemberian paraf persetujuan |
| `rejectedAt` | `timestamp` | `DateTime?` | Ya | — | Waktu penolakan paraf |
| `notes` | `text` | `String?` | Ya | — | Catatan penolakan atau instruksi persetujuan |
| `evidenceDocUrl` | `text` | `String?` | Ya | — | URL berkas bukti pengesahan/tanda tangan (Cloudflare R2) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pembuatan snapshot |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan status paraf |

**Indeks & Unique Constraint:**
- `@@index([afceDocumentId, attemptNo])`
- `@@index([workPackageId])`

## 6. Pengadaan & Logistik Material

### Model `WorkPackage`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `projectId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Project induk (Cascade onDelete) |
| `packageName` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama paket pekerjaan pengadaan / konstruksi |
| `category` | `PackageCategory` | `PackageCategory` | **Tidak (NOT NULL)** | `'MATERIAL'::"PackageCategory"` | Kategori paket: MATERIAL, FABRICATION, CONTRACTOR, HEAVY_EQUIPMENT, SWAKELOLA |
| `vendorId` | `text` | `String?` | Ya | — | Relasi ke Vendor penyedia (Restrict onDelete) |
| `vendorName` | `text` | `String?` | Ya | — | Denormalisasi nama vendor |
| `picName` | `text` | `String?` | Ya | — | Nama penanggung jawab paket kerja |
| `weightPct` | `float8` | `Float` | **Tidak (NOT NULL)** | `0` | Bobot paket dalam proyek (Float, total Σ per proyek harus = 100%) |
| `progressPct` | `float8` | `Float` | **Tidak (NOT NULL)** | `0` | Realisasi progres paket (0–100%, dari log mingguan atau penerimaan barang) |
| `targetQuantity` | `float8` | `Float?` | Ya | — | Target kuantitas volume paket kerja |
| `uom` | `text` | `String?` | Ya | — | Satuan ukuran paket kerja |
| `volumeAchieved` | `float8` | `Float?` | Ya | — | Akumulasi capaian volume fisik atau kedatangan material |
| `noPrUspk` | `text` | `String?` | Ya | — | Nomor PR / USPK pengadaan barang/jasa |
| `prUspkDate` | `timestamp` | `DateTime?` | Ya | — | Tanggal pengajuan PR / USPK |
| `noPoSpk` | `text` | `String?` | Ya | — | Nomor PO / SPK kontrak pengadaan |
| `poSpkDate` | `timestamp` | `DateTime?` | Ya | — | Tanggal terbit PO / SPK |
| `contractOrPoAmount` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | `0` | Nilai nominal kontrak atau PO (Numeric 18,2) |
| `estDeliveryDate` | `timestamp` | `DateTime?` | Ya | — | Estimasi tanggal kedatangan barang di lokasi |
| `actualDeliveryDate` | `timestamp` | `DateTime?` | Ya | — | Cache tanggal kiriman TERAKHIR (otomatis dari PackageDelivery) |
| `paymentStatus` | `PaymentStatus` | `PaymentStatus` | **Tidak (NOT NULL)** | `'BELUM_LUNAS'::"PaymentStatus"` | Status pembayaran tagihan paket: BELUM_LUNAS, DALAM_PROSES, LUNAS |
| `paidAmount` | `numeric` | `Decimal?` | Ya | — | Nilai nominal pembayaran yang telah dicairkan (Numeric 18,2) |
| `paidDate` | `timestamp` | `DateTime?` | Ya | — | Tanggal realisasi pembayaran paket |
| `planStartDate` | `timestamp` | `DateTime?` | Ya | — | Rencana awal pelaksanaan fisik lapangan (Gantt Matriks baris Fisik) |
| `planEndDate` | `timestamp` | `DateTime?` | Ya | — | Rencana batas akhir penyelesaian fisik lapangan |
| `actualStartDate` | `timestamp` | `DateTime?` | Ya | — | Realisasi awal fisik: auto-sync dari tanggal log progres pertama (>0%) |
| `actualEndDate` | `timestamp` | `DateTime?` | Ya | — | Realisasi selesai fisik: auto-sync dari log saat progres mencapai 100% |
| `status` | `PackageStatus` | `PackageStatus` | **Tidak (NOT NULL)** | `'DRAFT'::"PackageStatus"` | Status paket: DRAFT, PR_SUBMITTED, PO_ISSUED, IN_DELIVERY, PARTIALLY_DELIVERED, DELIVERED, COMPLETED, CANCELLED |
| `remarks` | `text` | `String?` | Ya | — | Catatan paket / alasan keterlambatan / justifikasi override manual DELIVERED |
| `createdById` | `text` | `String?` | Ya | — | ID user pembuat paket kerja (SetNull) |
| `deletedAt` | `timestamp` | `DateTime?` | Ya | — | Penanda waktu soft delete berantai paket kerja |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pembuatan paket kerja |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan paket kerja |
| `revisedEndDate` | `timestamp` | `DateTime?` | Ya | — | Target tanggal penyelesaian fisik yang direvisi |
| `hasPhysicalWork` | `bool` | `Boolean` | **Tidak (NOT NULL)** | `true` | Flag penanda apakah paket memiliki pekerjaan fisik lapangan (default true; false = murni pengadaan/material saja) |
| `procurementPlanEndDate` | `timestamp` | `DateTime?` | Ya | — | Rencana batas akhir kedatangan pengadaan material |
| `procurementPlanStartDate` | `timestamp` | `DateTime?` | Ya | — | Rencana awal jadwal pengadaan (Gantt Matriks baris Pengadaan) |
| `procurementRevisedEndDate` | `timestamp` | `DateTime?` | Ya | — | Target revisi batas akhir pengadaan bila terjadi keterlambatan |

**Indeks & Unique Constraint:**
- `@@index([projectId])`
- `@@index([vendorId])`
- `@@index([status])`
- `@@index([deletedAt])`

### Model `PackageItem`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `workPackageId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke WorkPackage induk (Cascade onDelete) |
| `itemId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Master Item material (Restrict onDelete) |
| `qtyPlanned` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | — | Jumlah kuantitas yang direncanakan dipesan (Numeric 18,3) |
| `qtyReceived` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | `0` | Akumulasi kuantitas barang yang telah diterima di kebun (Numeric 18,3) |
| `unitPrice` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | — | Harga satuan material per UoM (Numeric 18,2) |
| `totalPrice` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | — | Total harga kuantitas direncanakan (Numeric 18,2) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan line item |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan item |

**Indeks & Unique Constraint:**
- `@@index([workPackageId])`
- `@@index([itemId])`

### Model `PackageDelivery`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `workPackageId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke WorkPackage induk (Cascade onDelete) |
| `deliveryDate` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Tanggal surat jalan / penerimaan kiriman barang di lokasi |
| `deliveryOrderNo` | `text` | `String?` | Ya | — | Nomor Surat Jalan / Delivery Order (DO) |
| `notes` | `text` | `String?` | Ya | — | Catatan kondisi penerimaan barang (rusak/kurang/sesuai) |
| `deletedAt` | `timestamp` | `DateTime?` | Ya | — | Penanda waktu soft-delete kiriman |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan kiriman barang |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan kiriman |

**Indeks & Unique Constraint:**
- `@@index([workPackageId])`

### Model `PackageDeliveryItem`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `packageDeliveryId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke PackageDelivery induk (Cascade onDelete) |
| `packageItemId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke PackageItem yang diterima (Restrict onDelete) |
| `qtyReceived` | `numeric` | `Decimal` | **Tidak (NOT NULL)** | — | Jumlah kuantitas barang yang tiba pada pengiriman ini (Numeric 18,3) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan penerimaan barang |

**Indeks & Unique Constraint:**
- `@@index([packageDeliveryId])`
- `@@index([packageItemId])`

### Model `PackageDocument`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `workPackageId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke WorkPackage induk (Cascade onDelete) |
| `docType` | `PackageDocType` | `PackageDocType` | **Tidak (NOT NULL)** | — | Jenis dokumen pengadaan: PR, PO, DO, INVOICE, OTHER |
| `docNumber` | `text` | `String?` | Ya | — | Nomor dokumen fisik/digital |
| `docDate` | `timestamp` | `DateTime?` | Ya | — | Tanggal penerbitan dokumen |
| `fileUrl` | `text` | `String?` | Ya | — | URL file dokumen tersimpan di Cloudflare R2 |
| `notes` | `text` | `String?` | Ya | — | Keterangan dokumen |
| `deletedAt` | `timestamp` | `DateTime?` | Ya | — | Penanda waktu soft-delete dokumen |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu unggah dokumen |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan dokumen |

**Indeks & Unique Constraint:**
- `@@index([workPackageId])`

## 7. Realisasi Lapangan, Alat Berat & BAST

### Model `ProgressLog`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `projectId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Project induk (Cascade onDelete) |
| `workPackageId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke WorkPackage yang dilaporkan (Cascade onDelete) |
| `logDate` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Tanggal pelaporan kegiatan mingguan (default now, tidak boleh masa depan) |
| `weekNo` | `int4` | `Int` | **Tidak (NOT NULL)** | — | Nomor urut minggu pelaksanaan proyek (UNIQUE bersama workPackageId, B6) |
| `progressPct` | `float8` | `Float` | **Tidak (NOT NULL)** | — | Persentase progres fisik kumulatif paket pada minggu tersebut (0–100%) |
| `volumeAchieved` | `float8` | `Float?` | Ya | — | Volume kumulatif capaian fisik pekerjaan |
| `volumeUnit` | `text` | `String?` | Ya | — | Satuan ukuran capaian volume fisik |
| `workDescription` | `text` | `String?` | Ya | — | Uraian rincian pekerjaan yang dilaksanakan dalam minggu berjalan |
| `weatherCondition` | `text` | `String?` | Ya | — | Kondisi cuaca dominan (Cerah, Hujan Ringan, Banjir) |
| `waterLevelCm` | `float8` | `Float?` | Ya | — | Tinggi muka air saluran dalam centimeter (cm) |
| `photos` | `jsonb` | `Json?` | Ya | — | Daftar URL dokumentasi foto lapangan dari R2 (JSON array) |
| `createdById` | `text` | `String?` | Ya | — | ID user pelapor progres lapangan (SetNull) |
| `deletedAt` | `timestamp` | `DateTime?` | Ya | — | Penanda waktu soft-delete log progres |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pembuatan log progres |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu koreksi log progres pada minggu berjalan |

**Indeks & Unique Constraint:**
- `@@unique([workPackageId, weekNo])`
- `@@index([projectId])`
- `@@index([workPackageId])`

### Model `HeavyEquipmentLog`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `projectId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Project induk (Cascade onDelete) |
| `workPackageId` | `text` | `String?` | Ya | — | Relasi opsional ke WorkPackage terkait (SetNull) |
| `logDate` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Tanggal pengoperasian unit alat berat |
| `unitCode` | `text` | `String` | **Tidak (NOT NULL)** | — | Nomor/kode lambung unit alat berat (contoh: EX-01) |
| `equipmentType` | `text` | `String` | **Tidak (NOT NULL)** | — | Tipe alat berat (Excavator Long Arm, Bulldozer, Dump Truck, dll) |
| `ownership` | `EquipmentOwnership` | `EquipmentOwnership` | **Tidak (NOT NULL)** | `'OWNED'::"EquipmentOwnership"` | Status kepemilikan alat: OWNED (Milik Perusahaan) atau RENTAL (Sewa) |
| `hmStart` | `float8` | `Float` | **Tidak (NOT NULL)** | — | Angka hour meter awal operasional |
| `hmEnd` | `float8` | `Float` | **Tidak (NOT NULL)** | — | Angka hour meter akhir operasional |
| `hmHours` | `float8` | `Float` | **Tidak (NOT NULL)** | — | Total durasi jam kerja operasional alat (hmEnd − hmStart) |
| `fuelLiters` | `float8` | `Float?` | Ya | — | Konsumsi bahan bakar solar dalam liter |
| `workVolume` | `float8` | `Float?` | Ya | — | Volume kerja hasil galian/timbunan alat berat |
| `volumeUnit` | `text` | `String?` | Ya | — | Satuan ukuran volume kerja (m3, meter) |
| `workDescription` | `text` | `String?` | Ya | — | Uraian jenis kegiatan operasional alat |
| `deletedAt` | `timestamp` | `DateTime?` | Ya | — | Penanda waktu soft-delete log alat berat |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan log alat |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan log alat |

**Indeks & Unique Constraint:**
- `@@index([projectId])`
- `@@index([workPackageId])`

### Model `BastDocument`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `projectId` | `text` | `String` | **Tidak (NOT NULL)** | — | Relasi ke Project induk (1:1, UNIQUE, Cascade onDelete) |
| `bastNumber` | `text` | `String` | **Tidak (NOT NULL)** | — | Nomor resmi dokumen Berita Acara Serah Terima (BAST) |
| `bastDate` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Tanggal penandatanganan dokumen BAST |
| `hoInspectorName` | `text` | `String?` | Ya | — | Nama inspektur pemeriksa mutu dari Head Office (HO) |
| `contractorRepName` | `text` | `String?` | Ya | — | Nama perwakilan kontraktor pelaksana |
| `notes` | `text` | `String?` | Ya | — | Catatan hasil inspeksi teknis lapangan |
| `bastFileUrl` | `text` | `String` | **Tidak (NOT NULL)** | — | URL berkas pindaian dokumen BAST yang diunggah ke R2 (Wajib) |
| `verifiedById` | `text` | `String?` | Ya | — | ID user SUPER_ADMIN yang memverifikasi BAST (SetNull) |
| `verifiedAt` | `timestamp` | `DateTime?` | Ya | — | Waktu verifikasi final oleh SUPER_ADMIN (memicu status COMPLETED B9) |
| `deletedAt` | `timestamp` | `DateTime?` | Ya | — | Penanda waktu soft-delete BAST |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pembuatan draft BAST |
| `updatedAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | — | Waktu pembaruan BAST |

## 8. Audit Log

### Model `AuditLog`

| Nama Kolom | Tipe Postgres (Neon) | Tipe Prisma | Nullable | Nilai Default | Keterangan & Constraint Bisnis |
|---|---|---|---|---|---|
| `id` | `text` | `String` | **Tidak (NOT NULL)** | — | Primary Key (CUID) |
| `userId` | `text` | `String` | **Tidak (NOT NULL)** | — | ID user yang melakukan tindakan (Restrict onDelete) |
| `entity` | `text` | `String` | **Tidak (NOT NULL)** | — | Nama entitas domain yang dimutasi (Project, WorkPackage, AfceDocument, dll) |
| `entityId` | `text` | `String` | **Tidak (NOT NULL)** | — | ID record entitas yang bersangkutan |
| `action` | `AuditAction` | `AuditAction` | **Tidak (NOT NULL)** | — | Jenis aksi: CREATE, UPDATE, DELETE, RESTORE, PURGE, TRANSITION, LOGIN_FAILED |
| `diff` | `jsonb` | `Json?` | Ya | — | Rekaman perubahan payload sebelum dan sesudah mutasi (JSON) |
| `createdAt` | `timestamp` | `DateTime` | **Tidak (NOT NULL)** | `CURRENT_TIMESTAMP` | Waktu pencatatan jejak audit (Immutable) |

**Indeks & Unique Constraint:**
- `@@index([entity, entityId])`
- `@@index([userId])`

---

## 9. Aturan Integritas Data & Logika Bisnis (Sesuai Kode Live)

1. **Transisi Status Proyek Terpusat (Aturan B1–B10)**:
   - Kolom `Project.status` HANYA dapat diubah melalui `src/server/services/project-transition.service.ts` mengikuti tabel State Machine T1–T10.
   - Proyek berstatus `COMPLETED` bersifat **read-only mutlak**; semua API mutasi menolak perubahan dengan kode status HTTP 409 (Aturan B9).
2. **Kalkulasi Agregat Progres Proyek**:
   - Kolom `Project.progressPct` dihitung ulang otomatis di dalam transaksi database setiap kali terjadi penambahan/perubahan/penghapusan log progres atau paket kerja:
     \[ \text{progressPct} = \sum \left( \text{WorkPackage.progressPct} \times \frac{\text{WorkPackage.weightPct}}{100} \right) \]
3. **Dual-Track Paket Kerja (Aturan B12)**:
   - Paket bertanda `hasPhysicalWork = false` (Murni Pengadaan / Material) tidak memiliki jadwal pelaksanaan fisik di lapangan, tidak menampilkan sub-baris fisik di WBS Matriks Gantt, dan persentase capaian dihitung dari pemenuhan volume material yang tiba (bar warna sky-500 pada laporan).
   - Paket bertanda `hasPhysicalWork = true` memiliki dua linimasa terpisah: Jadwal Pengadaan (`procurementPlan*`) dan Jadwal Pelaksanaan Fisik Lapangan (`plan*`).
4. **Auto-Sinkronisasi Tanggal Aktual Fisik (Aturan B13)**:
   - `WorkPackage.actualStartDate` disinkronkan otomatis dari tanggal log progres pertama yang mencatat progres > 0%.
   - `WorkPackage.actualEndDate` disinkronkan otomatis dari tanggal log progres saat progres fisik mencapai **100% mutlak**. Koreksi log di bawah 100% pada minggu berjalan akan mengembalikan `actualEndDate` menjadi `null`.
5. **Penomoran Kode Proyek Atomik (Aturan B10)**:
   - Penomoran format `WM-{COMPANY}-{YYYY}-{SEQ4}` HANYA diperoleh dari `ProjectCodeCounter` melalui transaksi atomik database (`tx.projectCodeCounter.upsert`). Dilarang keras melakukan `count()` di luar transaksi.
6. **Preservasi Riwayat Audit Approval AFCE (Aturan B4 & B14)**:
   - Kolom `AfceDocument.noAr` bersifat opsional (`Nullable`) pada saat draft proyek awal dibuat.
   - Matriks paraf approval AR berjenjang 9 level (`EM`, `GEM`, `RH`, `HP`, `MCA`, `CFO`, `COO`, `CEO`, `Chairman`).
   - Setiap kali terjadi penolakan dan pengajuan ulang (*resubmit*), field `currentAttempt` bertambah (+1) dan riwayat attempt lama pada `ApprovalSnapshot` **tidak pernah dihapus atau diubah**.
7. **Penerimaan Material Berulang & Tanggal Kiriman Terakhir**:
   - Setiap penerimaan Surat Jalan dicatat di `PackageDelivery` dan `PackageDeliveryItem`. Kolom `WorkPackage.actualDeliveryDate` secara otomatis di-cache dari tanggal pengiriman terakhir yang tercatat.
   - Paket otomatis berstatus `DELIVERED` apabila total kuantitas diterima (\(\sum \text{qtyReceived}\)) telah memenuhi atau melebihi kuantitas yang direncanakan (\(\sum \text{qtyPlanned}\)).
8. **Soft Delete Berantai (Aturan B11)**:
   - Penghapusan proyek menandai kolom `deletedAt` pada entitas `Project`, `WorkPackage`, `ProgressLog`, `PackageDelivery`, dan `PackageDocument`. Semua kueri operasional menyaring data aktif dengan klausul `deletedAt: null`.
