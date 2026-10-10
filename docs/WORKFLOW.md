# WORKFLOW.md — State Machine & Aturan Transisi

> **Sumber kebenaran** alur status proyek & pengadaan. Service layer WAJIB mengimplementasikan
> tabel transisi di sini; UI tidak boleh menawarkan aksi yang tidak ada di tabel.
> Versi 1.0 · 07/10/2026 · Ditetapkan dari sesi keputusan bisnis (20 pertanyaan).

## 1. State Machine Proyek

```
DRAFT --[Mulai Survei: manual]--> SURVEY
SURVEY --[AFCE.rabReady = true: otomatis]--> RAB_READY
RAB_READY --[AFCE.emailSubmitted = true: otomatis]--> WAITING_AFCE_AR
WAITING_AFCE_AR --[semua level Approved: otomatis]--> AFCE_AR_APPROVED
AFCE_AR_APPROVED --[WorkPackage pertama dibuat: otomatis]--> PROCUREMENT
PROCUREMENT --[Mulai Pekerjaan Fisik: manual]--> EXECUTION
EXECUTION --[Ajukan BAST: manual]--> WAITING_BAST
WAITING_BAST --[BAST.verifiedAt terisi oleh SUPER_ADMIN]--> COMPLETED
```

Status khusus: `ON_HOLD` (dari status aktif mana pun, kecuali COMPLETED) dan `CANCELLED` (hanya SUPER_ADMIN; dari status mana pun kecuali COMPLETED).

## 2. Tabel Transisi Detail

| # | Dari → Ke | Pemicu | Pelaku | Prasyarat / Efek Samping |
|---|-----------|--------|--------|--------------------------|
| T1 | DRAFT → SURVEY | Tombol "Mulai Survei" | WM_HO_SPECIALIST, SUPER_ADMIN | — |
| T2 | SURVEY → RAB_READY | `AfceDocument.rabReady = true` | Sistem (otomatis saat upsert AFCE) | Draft AFCE dibuat otomatis bila belum ada |
| T3 | RAB_READY → WAITING_AFCE_AR | `AfceDocument.emailSubmitted = true` | Sistem (otomatis) | `emailSubmittedDate` wajib terisi |
| T4 | WAITING_AFCE_AR → AFCE_AR_APPROVED | Semua `ApprovalSnapshot` attempt aktif = APPROVED | Sistem (otomatis) | `AfceDocument.status = APPROVED` |
| T5 | AFCE_AR_APPROVED → PROCUREMENT | WorkPackage pertama dibuat | Sistem (otomatis) | Syarat baku #B3 terpenuhi |
| T6 | PROCUREMENT → EXECUTION | Tombol "Mulai Pekerjaan Fisik" | WM_HO_SPECIALIST, SUPER_ADMIN | Minimal 1 WorkPackage DELIVERED atau pengakuan manual + `remarks` |
| T7 | EXECUTION → WAITING_BAST | Tombol "Ajukan BAST" | WM_HO_SPECIALIST, SUPER_ADMIN | `bastFileUrl` wajib terupload; progres boleh < 100% (keputusan: progres 100% sudah termasuk finishing, tidak dipaksa) |
| T8 | WAITING_BAST → COMPLETED | `BastDocument.verifiedAt` terisi | SUPER_ADMIN saja | Proyek menjadi read-only total |
| T9 | aktif → ON_HOLD | Tombol "Tahan" + `onHoldReason` wajib | WM_HO_SPECIALIST, SUPER_ADMIN | EWS dibekukan; kembali ke status terakhir via "Lanjutkan" |
| T10 | aktif → CANCELLED | Tombol "Batalkan" + `cancellationReason` wajib | SUPER_ADMIN saja | COMPLETED tidak bisa dibatalkan atau di-ON_HOLD |

> "aktif" = DRAFT, SURVEY, RAB_READY, WAITING_AFCE_AR, AFCE_AR_APPROVED, PROCUREMENT, EXECUTION, WAITING_BAST.

## 3. Aturan Baku (Business Rules)

- **B1 — Pencatatan paraf terpusat.** Approval AR dicatat oleh WM_HO_Specialist atas nama approver. Maka `ApprovalSnapshot` memakai `personName` (string), TANPA relasi ke User. Tidak ada notifikasi ke approver di dalam sistem.
- **B2 — Approval berjenjang ketat.** Level N tidak bisa di-set `Approved` sebelum level N-1 `Approved`. Ditolak di level mana pun menghentikan jenjang (level di atasnya tidak bisa diubah).
- **B3 — Gerbang pengadaan.** WorkPackage hanya bisa dibuat jika `AfceDocument.status = APPROVED` (proyek di AFCE_AR_APPROVED). Tidak ada jalur darurat.
- **B4 — Penolakan AR = attempt baru.** Saat ditolak: `AfceDocument.status = REJECTED`, proyek kembali ke `RAB_READY`. Pengajuan ulang membuat attempt baru (`attemptNo + 1`) — **history attempt lama disimpan permanen**, tidak pernah ditimpa. Tidak ada batas jumlah pengajuan ulang.
- **B5 — AR tambahan (supplementary).** `isSupplementary = true`: tidak dibatasi jumlahnya, berjalan paralel, TIDAK mengubah status proyek dan tidak mengganggu approval AR utama.
- **B6 — Progres mingguan.** Satu `ProgressLog` per WorkPackage per `weekNo`. Koreksi: log minggu berjalan boleh edit/hapus (agregat dihitung ulang dalam transaksi); log minggu lampau read-only. Progres proyek = Σ(progressPct × weightPct / 100), dihitung ulang di service setiap mutasi.
- **B7 — Kedatangan berulang.** Satu paket boleh punya banyak `PackageDelivery` (tanggal + qty per kiriman + notes). Barang rusak/kurang dicatat di `deliveryNotes` saja — qtyReceived mencerminkan yang fisik diterima. Status paket `DELIVERED` hanya bila ΣqtyReceived ≥ ΣqtyPlanned (bisa dioverride manual dengan alasan). Keterlambatan = max(tanggal kiriman) − `estDeliveryDate`.
- **B8 — Pembayaran independen dari BAST.** Proyek boleh `COMPLETED` walau ada paket `paymentStatus != LUNAS`. Tagihan outstanding dipantau lewat laporan, bukan pemblokiran.
- **B9 — Imutabilitas akhir.** `COMPLETED` = read-only: semua endpoint mutasi untuk proyek tersebut menolak dengan 409 "Proyek sudah selesai dan terkunci". Tidak bisa CANCELLED maupun ON_HOLD.
- **B10 — Kode proyek abadi.** Format `WM-{COMPANY_CODE}-{YYYY}-{SEQ4}` (mis. `WM-CMP01-2026-0042`). Nomor urut per company per tahun, reset setiap tahun, **tidak pernah dipakai ulang** termasuk setelah hard delete. Implementasi: tabel `ProjectCodeCounter` + increment dalam transaksi (lihat DATABASE.md v2 §10).
- **B11 — Soft delete berantai.** Hapus proyek mengisi `deletedAt` pada Project dan seluruh anak (WorkPackage, ProgressLog, HeavyEquipmentLog, PackageDelivery, dokumen). Restore memulihkan semuanya. Hanya SUPER_ADMIN yang bisa restore/purge.
- **B12 — Dual-Track Paket Kerja (Pengadaan Murni vs Fisik Lapangan).** Paket kerja bertipe `hasPhysicalWork = false` (Material Saja) hanya memiliki lini pengadaan logistik, tanpa jadwal fisik lapangan. Progresnya mencerminkan pemenuhan kedatangan volume material (100% saat barang tiba lengkap). Di antarmuka laporan, bar progres paket material ditampilkan dengan aksen biru/sky.
- **B13 — Sinkronisasi Otomatis Tanggal Selesai Fisik.** Tanggal realisasi fisik (`actualStartDate` dan `actualEndDate`) pada paket fisik disinkronkan otomatis dari riwayat `ProgressLog`: `actualStartDate` dari log pertama yang mulai bekerja (>0%), dan `actualEndDate` otomatis tercatat saat progres mencapai 100%.
- **B14 — Matriks Persetujuan 9-Role Standar SAP.** Persetujuan AR diatur berjenjang mengikuti 9 role standar SAP (Estate Manager, Area Manager, VP, MCA, hingga Direktur/CEO). Role yang tidak relevan untuk proyek tertentu dapat ditandai `[TIDAK_PERLU]` (badge NA abu-abu) dan tidak menghalangi kelanjutan approval ke jenjang berikutnya.

## 4. State Machine Paket Pengadaan (WorkPackage)

```
DRAFT --[Input No PR / USPk]--> PR_SUBMITTED
PR_SUBMITTED --[Input No PO / SPK]--> PO_ISSUED
PO_ISSUED --[Kiriman Pertama Berjalan]--> IN_DELIVERY
IN_DELIVERY --[Sebagian Item Diterima]--> PARTIALLY_DELIVERED
PARTIALLY_DELIVERED / IN_DELIVERY --[Σ qtyReceived ≥ planned / Override]--> DELIVERED
DELIVERED / Pekerjaan Lapangan Tuntas --> COMPLETED
```

## 5. EWS / Status Indicator

Tidak berubah: `lib/sla.ts` membandingkan progres aktual vs rencana linear (hari kerja dikurangi tabel `Holiday`). Beku saat ON_HOLD. Prasyarat: `Holiday` wajib terisi per tahun — jika tahun berjalan tidak punya data libur, SLA fallback ke kalender 7 hari dan UI menampilkan peringatan di halaman master.
