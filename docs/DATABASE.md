# DATABASE.md — Skema Database (v2)

> **DBMS:** PostgreSQL (Neon, region Singapore) · **ORM:** Prisma 5 + `@prisma/adapter-neon`
> **Sumber kebenaran:** `prisma/schema.prisma` · Migrasi WAJIB via `prisma migrate` (bukan `db push`).
> Perubahan v2: uang `Decimal`, status semua enum, model `Item/PackageItem/PackageDelivery/ProjectCodeCounter/AuditLog`, `attemptNo`, `deletedAt` pada anak proyek, index lengkap.

PK seluruh tabel: `id String @default(cuid())`. Semua tabel punya `createdAt` (dan `updatedAt` bila dapat diubah).

## 1. Enum (lengkap — tidak ada lagi status String)

| Enum | Nilai |
|------|-------|
| `Role` | `SUPER_ADMIN`, `WM_HO_SPECIALIST`, `MANAGEMENT_VIEWER` |
| `ProjectStatus` | `DRAFT`, `SURVEY`, `RAB_READY`, `WAITING_AFCE_AR`, `AFCE_AR_APPROVED`, `PROCUREMENT`, `EXECUTION`, `WAITING_BAST`, `COMPLETED`, `ON_HOLD`, `CANCELLED` |
| `StatusIndicator` | `ON_TRACK`, `AT_RISK`, `DELAYED`, `COMPLETED` |
| `BudgetType` | `CAPEX_BUDGETED`, `OPEX_BUDGETED`, `PTA`, `UNBUDGETED` |
| `PackageCategory` | `MATERIAL`, `FABRICATION`, `CONTRACTOR`, `HEAVY_EQUIPMENT`, `SWAKELOLA` |
| `PackageStatus` | `DRAFT`, `PR_SUBMITTED`, `PO_ISSUED`, `IN_DELIVERY`, `PARTIALLY_DELIVERED`, `DELIVERED`, `COMPLETED`, `CANCELLED` |
| `AfceStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `ApprovalStatus` | `WAITING`, `APPROVED`, `REJECTED` |
| `PaymentStatus` | `BELUM_LUNAS`, `DALAM_PROSES`, `LUNAS` |
| `EquipmentOwnership` | `OWNED`, `RENTAL` |

## 2. Auth & User

`User`: id, email (UNIQUE, lowercase), name, password (bcrypt), role (default WM_HO_SPECIALIST), isActive (default true), rememberToken?, createdAt/updatedAt. Index: `@@index([isActive])`.

## 3. Master Data

Hierarki lokasi `Region → Company → Estate → Block` tidak berubah (constraint UNIQUE(companyId, code) untuk Estate; UNIQUE(estateId, blockCode) untuk Block). Master lain: `FolderCategory`, `StructureType`, `StructureVariant` (`defaultBoqItems Json?`), `Vendor`, `UnitOfMeasurement`, `Holiday` (UNIQUE holidayDate; **wajib di-seed per tahun** — lihat WORKFLOW.md §4), `PicOfficer`.

### `Item` — Master Material
id, itemCode (UNIQUE), name, category (PackageCategory, default MATERIAL), uomId (FK → UnitOfMeasurement), specification?, standardPrice Decimal(18,2) default 0, isActive, createdAt/updatedAt.

## 4. Proyek

### `Project`
Kolom sesuai v1 ditambah/ubah:
- **Semua kolom uang** (`totalBudgetAmount`, dll) → `Decimal(18,2)` `@db.Decimal(18,2)`.
- `status ProjectStatus`, `statusIndicator StatusIndicator` (enum, bukan String).
- `deletedAt DateTime?` (soft delete; semua query list `where: { deletedAt: null }`).
- `createdById String?` FK → User.
- Index: `@@index([status])`, `@@index([statusIndicator])`, `@@index([companyId])`, `@@index([estateId])`, `@@index([deletedAt])`, `@@index([updatedAt])`.

### `ProjectCodeCounter` (BARU — untuk aturan B10)
id, companyId (FK → Company), year Int, lastSeq Int default 0, UNIQUE(companyId, year).

```ts
// Dipanggil dalam transaksi pembuatan proyek:
const counter = await tx.projectCodeCounter.upsert({
  where: { companyId_year: { companyId, year } },
  update: { lastSeq: { increment: 1 } },
  create: { companyId, year, lastSeq: 1 },
});
const projectCode = `WM-${company.code}-${year}-${String(counter.lastSeq).padStart(4, "0")}`;
```

## 5. Pengadaan

### `AfceDocument` (1:1 Project)
id, projectId (FK UNIQUE, CASCADE), noAr, arType?, budgetType?, **approvedAmount Decimal(18,2)**, checklist (drawingReady, rabReady, mapReady, emailSubmitted, emailSubmittedDate), **isSupplementary Boolean, supplementaryAmount Decimal(18,2)?**, **currentAttempt Int default 1**, **status AfceStatus** default PENDING, mcaApprovalDate?, createdAt/updatedAt.

> AR tambahan = baris AfceDocument baru? **Tidak.** Tetap 1:1. Supplementary dicatat sebagai snapshot terpisah di `SupplementaryAr` (lihat §5.5) agar paralel tanpa mengubah status proyek (aturan B5).

### `SupplementaryAr` (BARU)
id, projectId (FK → Project, CASCADE), noAr, amount Decimal(18,2), notes?, status AfceStatus default PENDING, createdAt/updatedAt. Index: `@@index([projectId])`.

### `ApprovalSnapshot`
id, afceDocumentId? (FK CASCADE), workPackageId? (FK CASCADE), **attemptNo Int default 1**, documentType (AR/PR/PO), approvalLevel Int, role, personName?, status ApprovalStatus default WAITING, submittedAt/approvedAt/rejectedAt, notes?, evidenceDocUrl?. Index: `@@index([afceDocumentId, attemptNo])`. History attempt lama TIDAK pernah dihapus/diubah (aturan B4).

### `WorkPackage`
Kolom sesuai v1 dengan perubahan:
- `status PackageStatus` (enum). `contractOrPoAmount`, `paidAmount` → `Decimal(18,2)`.
- `actualDeliveryDate` dipertahankan sebagai cache tanggal kiriman terakhir (diisi otomatis dari PackageDelivery terbaru); **bukan** satu-satunya sumber kedatangan.
- `deliveryStatus` dihapus (redundan dengan `status`).
- `deletedAt DateTime?`.
- Index: `@@index([projectId])`, `@@index([vendorId])`, `@@index([status])`, `@@index([deletedAt])`.

### `PackageItem`
id, workPackageId (FK CASCADE), itemId (FK → Item), qtyPlanned Decimal(18,3), qtyReceived Decimal(18,3) default 0 (diupdate agregat dari deliveries), unitPrice Decimal(18,2), totalPrice Decimal(18,2). Index: `@@index([workPackageId])`.

### `PackageDelivery` (BARU — kedatangan berulang, aturan B7)
id, workPackageId (FK CASCADE), deliveryDate DateTime, deliveryOrderNo?, notes? (kerusakan/kurang dicatat di sini). Index: `@@index([workPackageId])`.

### `PackageDeliveryItem` (BARU)
id, packageDeliveryId (FK CASCADE), packageItemId (FK → PackageItem), qtyReceived Decimal(18,3). Index: `@@index([packageItemId])`.

### `PackageDocument`
id, workPackageId (FK CASCADE), docType (PR/PO/DO/INVOICE/OTHER), docNumber?, docDate?, fileUrl?, notes?. Index: `@@index([workPackageId])`.

## 6. Realisasi

### `ProgressLog`
id, projectId, workPackageId (FK CASCADE), logDate, weekNo Int, progressPct Float (0–100), volumeAchieved?, volumeUnit?, workDescription?, weatherCondition?, waterLevelCm?, photos Json?, deletedAt?, createdAt/updatedAt.
- **UNIQUE(workPackageId, weekNo)** — satu log per paket per minggu (aturan B6).
- Index: `@@index([projectId])`, `@@index([workPackageId])`.

### `HeavyEquipmentLog`
Sesuai v1 + `deletedAt DateTime?`. Index: `@@index([projectId])`, `@@index([workPackageId])`.

### `BastDocument` (1:1 Project)
id, projectId (FK UNIQUE CASCADE), bastNumber, bastDate, hoInspectorName?, contractorRepName?, notes?, bastFileUrl, **verifiedById? FK → User (hanya boleh SUPER_ADMIN di service)**, verifiedAt?. Saat verifiedAt terisi → proyek COMPLETED + read-only (aturan B9).

## 7. Audit & Pelacakan

### `AuditLog` (BARU)
id, userId (FK → User), entity, entityId, action (CREATE/UPDATE/DELETE/RESTORE/TRANSITION), diff Json?, createdAt. Index: `@@index([entity, entityId])`, `@@index([userId])`.

Selain itu `createdById` ditambahkan pada `Project`, `WorkPackage`, `ProgressLog`.

## 8. Aturan Bisnis Data (sinkron dengan WORKFLOW.md)

1. Transisi status proyek HANYA lewat tabel T1–T10 di WORKFLOW.md §2 — ditegakkan di service, bukan UI.
2. Progres proyek = Σ(progressPct × weightPct / 100), dihitung ulang dalam transaksi setiap mutasi ProgressLog/WorkPackage.
3. Validasi tanggal: `prUspkDate ≤ poSpkDate ≤ max(deliveryDate)`; `planStartDate ≤ planEndDate` (Zod `.refine()`).
4. `statusIndicator` dari `lib/sla.ts` tunggal; dibekukan saat ON_HOLD.
5. Soft delete berantai; list endpoints wajib filter `deletedAt: null`.
6. Kode proyek dari `ProjectCodeCounter` dalam transaksi yang sama dengan insert Project.
