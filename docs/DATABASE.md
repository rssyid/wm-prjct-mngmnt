# DATABASE.md — Skema Database (v2.1, LENGKAP — tanpa referensi eksternal)

> **DBMS:** PostgreSQL (Neon, region Singapore) · **ORM:** Prisma 5 + `@prisma/adapter-neon`
> **Sumber kebenaran:** `prisma/schema.prisma` · Migrasi WAJIB via `prisma migrate`.
> **v2.1:** semua kolom ditulis penuh (v2 menyebut "sesuai v1" yang tidak ada di repo — kini lengkap).
> Tambahan: `Project.statusBeforeHold` untuk RESUME (T9 WORKFLOW.md).

Konvensi: PK `id String @default(cuid())`. Semua tabel punya `createdAt`; tabel yang bisa diubah punya `updatedAt`.
Uang = `Decimal(18,2)` (`@db.Decimal(18,2)`). Jumlah terukur = `Decimal(18,3)`. Persen = `Float`.

## 1. Enum (semua status = enum, tanpa String)

| Enum | Nilai |
|------|-------|
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

## 2. User

| Kolom | Tipe | Constraint |
|-------|------|-----------|
| email | String | UNIQUE, lowercase |
| name | String | NOT NULL |
| password | String | NOT NULL, hash bcrypt |
| role | Role | default `WM_HO_SPECIALIST` |
| isActive | Boolean | default true |
| rememberToken | String? | |
Index: `@@index([isActive])`.

## 3. Master Data

| Tabel | Kolom | Constraint |
|-------|-------|-----------|
| `Region` | code, name, isActive | code UNIQUE; 1-N Company |
| `Company` | code, name, isActive, regionId? | code UNIQUE; FK→Region |
| `Estate` | companyId, code, name, region?, isActive | FK→Company (CASCADE); UNIQUE(companyId, code) |
| `Block` | estateId, blockCode, name, plantingYear Int?, areaHectares Float?, isActive | FK→Estate (CASCADE); UNIQUE(estateId, blockCode) |
| `FolderCategory` | code, name, description?, icon?, isActive | code UNIQUE |
| `StructureType` | name, description?, isActive | name UNIQUE |
| `StructureVariant` | structureTypeId, code, name, description?, defaultBoqItems Json?, isActive | FK→StructureType (CASCADE); UNIQUE(structureTypeId, code) |
| `Vendor` | name, category PackageCategory, contactPerson?, phone?, email?, address?, isActive | — |
| `UnitOfMeasurement` | code, name, description?, isActive | code UNIQUE |
| `Holiday` | holidayDate, name, year Int, description? | holidayDate UNIQUE; **seed wajib per tahun** (WORKFLOW.md §4) |
| `PicOfficer` | name, roleTitle?, phone?, email?, companyIds Json?, isActive | — |

### `Item` — Master Material
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| itemCode | String | UNIQUE |
| name | String | NOT NULL |
| category | PackageCategory | default MATERIAL |
| uomId | String | FK→UnitOfMeasurement |
| specification | String? | |
| standardPrice | Decimal(18,2) | default 0 |
| isActive | Boolean | default true |

## 4. Project

| Kolom | Tipe | Constraint / Keterangan |
|-------|------|-------------------------|
| projectCode | String | UNIQUE; format `WM-{COMPANY}-{YYYY}-{SEQ4}` (B10) |
| projectName / displayName | String | NOT NULL |
| folderCategoryId / structureTypeId / companyId / estateId | String | FK wajib |
| structureVariantId / blockId / picId | String? | FK opsional |
| picName | String? | denormalisasi dari PicOfficer |
| latitude / longitude | Float? | titik lokasi |
| geoCoordinates | Json? | polyline/polygon |
| locationType | LocationType | default POINT |
| budgetType | BudgetType | default CAPEX_BUDGETED |
| totalBudgetAmount | Decimal(18,2) | default 0 |
| targetQuantity | Float? | |
| uom | String? | |
| targetStartDate / targetEndDate | DateTime? | baseline |
| constructionPlanStartDate / constructionPlanEndDate | DateTime? | rencana konstruksi |
| revisedEndDate / estCompletionDate | DateTime? | revisi & estimasi |
| status | ProjectStatus | default DRAFT; **hanya berubah via transition service** |
| statusBeforeHold | ProjectStatus? | diisi saat ON_HOLD, untuk RESUME (T9) |
| statusIndicator | StatusIndicator | default ON_TRACK |
| onHoldReason / cancellationReason | String? | wajib diisi saat HOLD/CANCEL |
| sitePlanUrl / drawingUrl | String? | URL R2 |
| boqItems | Json? | array item BOQ |
| surveyElevationData / socializationSignOff | Json? | |
| createdById | String? | FK→User |
| deletedAt | DateTime? | soft delete (B11) |

Index: `@@index([status])`, `@@index([statusIndicator])`, `@@index([companyId])`, `@@index([estateId])`,
`@@index([deletedAt])`, `@@index([updatedAt])`.

### `ProjectCodeCounter`
id, companyId (FK→Company), year Int, lastSeq Int default 0. UNIQUE(companyId, year).
Pemakaian: upsert + increment dalam transaksi create Project (B10).

```ts
const counter = await tx.projectCodeCounter.upsert({
  where: { companyId_year: { companyId, year } },
  update: { lastSeq: { increment: 1 } },
  create: { companyId, year, lastSeq: 1 },
});
const projectCode = `WM-${company.code}-${year}-${String(counter.lastSeq).padStart(4, "0")}`;
```

## 5. AFCE / AR

### `AfceDocument` (1:1 Project)
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| projectId | String | FK UNIQUE→Project (CASCADE) |
| noAr | String | NOT NULL |
| arType / budgetType | String? | |
| approvedAmount | Decimal(18,2) | default 0 |
| drawingReady / rabReady / mapReady / emailSubmitted | Boolean | default false — rabReady memicu T2, emailSubmitted memicu T3 |
| emailSubmittedDate | DateTime? | wajib bila emailSubmitted=true |
| isSupplementary | Boolean | default false |
| supplementaryAmount | Decimal(18,2)? | |
| mcaApprovalDate | DateTime? | |
| currentAttempt | Int | default 1; +1 setiap resubmit (B4) |
| status | AfceStatus | default PENDING |

### `SupplementaryAr`
id, projectId (FK→Project CASCADE), noAr, amount Decimal(18,2), notes?, status AfceStatus default PENDING, timestamps.
Paralel; TIDAK mengubah status proyek (B5). Index: `@@index([projectId])`.

### `ApprovalSnapshot`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| afceDocumentId / workPackageId | String? | FK CASCADE (salah satu terisi) |
| attemptNo | Int | default 1; history attempt lama tidak pernah diubah (B4) |
| documentType | ApprovalDocType | |
| approvalLevel | Int | 1, 2, 3, ... berurutan ketat (B2) |
| role | String | jabatan approver |
| personName | String? | pencatatan paraf (B1) — tanpa FK User |
| status | ApprovalStatus | default WAITING |
| submittedAt / approvedAt / rejectedAt | DateTime? | |
| notes / evidenceDocUrl | String? | |

Index: `@@index([afceDocumentId, attemptNo])`, `@@index([workPackageId])`.

## 6. Pengadaan

### `WorkPackage`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| projectId | String | FK→Project (CASCADE) |
| packageName | String | NOT NULL |
| category | PackageCategory | default MATERIAL |
| vendorId / vendorName | String? / String? | FK + denormalisasi |
| picName | String? | |
| weightPct | Float | default 0; Σ per proyek = 100 |
| progressPct | Float | default 0; diupdate service |
| targetQuantity / uom / volumeAchieved | Float? / String? / Float? | |
| noPrUspk / prUspkDate | String? / DateTime? | tahap PR/USPK |
| noPoSpk / poSpkDate | String? / DateTime? | tahap PO/SPK |
| contractOrPoAmount | Decimal(18,2) | default 0 |
| estDeliveryDate | DateTime? | estimasi kedatangan |
| actualDeliveryDate | DateTime? | cache = tanggal kiriman TERAKHIR (auto dari PackageDelivery) |
| paymentStatus | PaymentStatus | default BELUM_LUNAS |
| paidAmount / paidDate | Decimal(18,2)? / DateTime? | |
| planStartDate / planEndDate | DateTime? | rencana (Gantt) |
| actualStartDate / actualEndDate | DateTime? | realisasi (Gantt) |
| status | PackageStatus | default DRAFT |
| remarks | String? | |
| createdById | String? | FK→User |
| deletedAt | DateTime? | |

> Catatan: tidak ada kolom `deliveryStatus` (redundan dengan `status`); nomor DO pindah ke `PackageDelivery.deliveryOrderNo`.

Index: `@@index([projectId])`, `@@index([vendorId])`, `@@index([status])`, `@@index([deletedAt])`.

### `PackageItem`
id, workPackageId (FK CASCADE), itemId (FK→Item), qtyPlanned Decimal(18,3), qtyReceived Decimal(18,3) default 0 (akumulasi otomatis dari deliveries), unitPrice Decimal(18,2), totalPrice Decimal(18,2). Index: `@@index([workPackageId])`.

### `PackageDelivery` — kiriman berulang (B7)
id, workPackageId (FK CASCADE), deliveryDate DateTime, deliveryOrderNo?, notes? (kerusakan/kurang dicatat di sini), timestamps. Index: `@@index([workPackageId])`.

### `PackageDeliveryItem`
id, packageDeliveryId (FK CASCADE), packageItemId (FK→PackageItem), qtyReceived Decimal(18,3). Index: `@@index([packageItemId])`.

### `PackageDocument`
id, workPackageId (FK CASCADE), docType PackageDocType, docNumber?, docDate?, fileUrl? (R2), notes?. Index: `@@index([workPackageId])`.

## 7. Realisasi

### `ProgressLog`
| Kolom | Tipe | Constraint |
|-------|------|-----------|
| projectId | String | FK→Project (CASCADE) |
| workPackageId | String | FK→WorkPackage (CASCADE) |
| logDate | DateTime | default now; tidak boleh masa depan |
| weekNo | Int | UNIQUE(workPackageId, weekNo) — 1 log/minggu (B6) |
| progressPct | Float | 0–100 |
| volumeAchieved / volumeUnit | Float? / String? | |
| workDescription / weatherCondition | String? | |
| waterLevelCm | Float? | |
| photos | Json? | array URL R2 |
| createdById | String? | FK→User |
| deletedAt | DateTime? | |
Index: `@@index([projectId])`, `@@index([workPackageId])`.

### `HeavyEquipmentLog`
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| projectId | String | FK→Project (CASCADE) |
| workPackageId | String? | FK→WorkPackage |
| logDate | DateTime | |
| unitCode | String | kode unit alat |
| equipmentType | String | excavator, dump truck, ... |
| ownership | EquipmentOwnership | default OWNED |
| hmStart / hmEnd / hmHours | Float | hmHours = hmEnd − hmStart |
| fuelLiters / workVolume | Float? | |
| volumeUnit / workDescription | String? | |
| deletedAt | DateTime? | |
Index: `@@index([projectId])`, `@@index([workPackageId])`.

### `BastDocument` (1:1 Project)
id, projectId (FK UNIQUE→Project CASCADE), bastNumber, bastDate, hoInspectorName?, contractorRepName?, notes?,
bastFileUrl (URL R2, wajib sebelum T7), verifiedById? FK→User (hanya SUPER_ADMIN — B/ matriks API.md),
verifiedAt?. verifiedAt terisi → proyek COMPLETED + read-only (T8, B9).

## 8. Audit

### `AuditLog`
id, userId (FK→User), entity, entityId, action AuditAction, diff Json?, createdAt.
Index: `@@index([entity, entityId])`, `@@index([userId])`.

## 9. Aturan Bisnis Data

1. Transisi status HANYA via tabel T1–T10 (WORKFLOW.md §2) di transition service.
2. Progres proyek = Σ(progressPct × weightPct / 100) — dihitung ulang dalam transaksi setiap mutasi progres/paket.
3. Tanggal: `prUspkDate ≤ poSpkDate ≤ max(deliveryDate)`; `planStartDate ≤ planEndDate`; log tidak boleh masa depan (Zod `.refine()`).
4. `statusIndicator` dari `lib/sla.ts` tunggal; beku saat ON_HOLD.
5. Soft delete berantai (B11); semua list filter `deletedAt: null`.
6. Kode proyek dari counter dalam transaksi yang sama (B10); tidak pernah dipakai ulang.
7. Paket `DELIVERED` bila ΣqtyReceived ≥ ΣqtyPlanned (override manual wajib `remarks`).
