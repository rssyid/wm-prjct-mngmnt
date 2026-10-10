# PRD.md — Product Requirements Document (v1.1)

> **Aplikasi:** WM PRJCT MNGMNT (Water Management Project Management) — personal/portofolio.
> **Perubahan v1.1:** state machine dipisah ke `WORKFLOW.md`; keputusan bisnis dari sesi 07/10/2026
> (approval paraf terpusat, kedatangan berulang, BAST independen dari pembayaran, dsb).
> **Pemilik:** Product Owner · **Status:** Living Document.

## 1. Visi Produk

Satu sumber kebenaran (single source of truth) untuk seluruh siklus hidup proyek Water Management — perencanaan, pengajuan anggaran (AFCE/AR), pengadaan (PR → PO → barang tiba), eksekusi, hingga serah terima (BAST) — sehingga setiap proyek dapat dipantau real-time, transparan, dan terukur.

## 2. Problem Statement

| # | Masalah | Dampak |
|---|---------|--------|
| 1 | Data proyek tersebar di Excel, email, chat | Duplikasi, versi tidak konsisten |
| 2 | Status pengadaan (AR, PR, PO, kedatangan) sulit dilacak | Keterlambatan material tidak terdeteksi dini |
| 3 | Tidak ada perbandingan otomatis rencana vs realisasi | Manajemen tidak tahu proyek mana yang delay |
| 4 | Laporan progres disusun manual | Lambat, rawan salah hitung |
| 5 | Approval berjenjang tidak terdokumentasi | Tidak ada audit trail |

## 3. Target Pengguna

| Persona | Role | Kebutuhan Utama |
|---------|------|-----------------|
| Super Admin | `SUPER_ADMIN` | Kelola user/master, cancel proyek, verifikasi BAST, restore/purge |
| WM HO Specialist / PIC | `WM_HO_SPECIALIST` | Buat proyek, input AFCE/AR (mencatat paraf approver), PR/PO, kedatangan, progres mingguan, ajukan BAST |
| Manajemen | `MANAGEMENT_VIEWER` | Dashboard, Gantt, laporan, EWS — read only |

## 4. Fitur Inti (MVP)

| ID | Fitur | Prioritas |
|----|-------|-----------|
| F-01 | Login (NextAuth Credentials, JWT, remember me, rate limit login via Upstash) | P0 |
| F-02 | Master data: Item/Material, UoM, Vendor, Kategori, Struktur & Varian (template BOQ), Hari Libur (wajib per tahun), Region/Company/Estate/Block, PIC | P0 |
| F-03 | Manajemen user (CRUD, role, aktif/nonaktif) | P0 |
| F-04 | Penambahan proyek (lokasi + peta, anggaran, struktur, target, BOQ, kode otomatis `WM-{COMP}-{YYYY}-{SEQ4}` abadi) | P0 |
| F-05 | Pengadaan: AFCE/AR (checklist, approval berjenjang dengan attempt history, supplementary paralel); WorkPackage (PR/PO, vendor, nilai); kedatangan berulang per item; dokumen PR/PO/DO/Invoice | P0 |
| F-06 | Realisasi: progres mingguan (1 log/paket/minggu), log alat berat, pembayaran per paket, BAST (verifikasi SUPER_ADMIN) | P0 |
| F-07 | Manajemen proyek: state machine (lihat WORKFLOW.md), EWS/SLA, ON_HOLD/CANCELLED, soft delete berantai, dashboard | P0 |
| F-08 | Visualisasi Jadwal WBS & Kurva S: Mode Ganda (1. Matriks Mingguan spreadsheet-style dengan sub-baris Pengadaan vs Fisik 100%, legenda PLAN/REVISED/THIS_WEEK_REVISED, simbol '#' & '✓', milestone AFCE 14 hari 9-role SAP; 2. Timeline Bar horizontal klasik dengan milestone), serta Kurva S Recharts kumulatif | P1 |
| F-09 | Sistem Laporan Terpadu 3-Tab: Tab 1 "Ringkasan Eksekutif" (KPI portofolio & status), Tab 2 "Progres & Fisik Lapangan" (Tabel 6-Kolom Padat tanpa scroll horizontal), Tab 3 "Pengadaan & Material" (Outstanding PO, Keterlambatan, Pembayaran); filter multi-select perusahaan (`nuqs`); ekspor dinamis PDF (jspdf) & Excel (xlsx) | P1 |

### 4.1 Alur Status

Lihat `WORKFLOW.md` §1–2 (sumber kebenaran). Ringkasan:
`DRAFT → SURVEY → RAB_READY → WAITING_AFCE_AR → AFCE_AR_APPROVED → PROCUREMENT → EXECUTION → WAITING_BAST → COMPLETED`, plus `ON_HOLD`/`CANCELLED` dari status aktif mana pun.

## 5. User Stories (revisi)

**US-01 — Membuat Proyek Baru** — tidak berubah; tambahan AC: kode dari counter per company-tahun, tidak pernah duplikat walau ada hard delete.

**US-02 — Melacak Pengadaan dari AR hingga Barang Tiba**
> Sebagai **WM HO Specialist**, saya mencatat AR, PR, PO, dan setiap kiriman barang (bisa lebih dari satu kiriman per paket), agar tahu persis pengadaan tertahan di mana.
- AC: tanggal PR ≤ PO; status paket otomatis mengikuti dokumen; **paket baru hanya bisa dibuat setelah AR APPROVED**; kedatangan dicatat per kiriman per item (`PackageDelivery`); barang rusak/kurang dicatat di notes kiriman; keterlambatan = kiriman terakhir − estimasi.

**US-03 — Mencatat Realisasi Lapangan**
> Sebagai **PIC**, saya input progres mingguan per paket (%, volume, foto opsional, cuaca, tinggi air), agar realisasi bisa dibandingkan rencana.
- AC: maksimal 1 log per paket per minggu; koreksi hanya untuk minggu berjalan; agregat bobot dihitung ulang otomatis di server; tidak bisa input tanggal masa depan. Tanggal selesai fisik tercatat otomatis saat mencapai 100%.

**US-04 — Memantau Portofolio & Laporan**
> Sebagai **Manajemen / HO**, saya memantau portofolio proyek melalui 3 tab laporan interaktif: Tab 1 "Ringkasan Eksekutif" (KPI portofolio & status), Tab 2 "Progres & Fisik Lapangan" (Tabel 6-Kolom Padat tanpa scroll horizontal), dan Tab 3 "Pengadaan & Material" (Outstanding PO, Keterlambatan, Pembayaran).

## 6. Keputusan Bisnis (dari sesi 07/10/2026 & Pembaruan Terkini)

1. Approval dicatat paraf oleh WM_HO_Specialist atas nama approver; berjenjang ketat; penolakan → attempt baru, history disimpan, tanpa batas pengajuan ulang.
2. AR tambahan (supplementary) paralel, tidak dibatasi, tidak mengubah status proyek.
3. Transisi EXECUTION dan WAITING_BAST bersifat manual (tombol), bukan otomatis dari progres.
4. Proyek boleh COMPLETED walau ada paket belum LUNAS; BAST diverifikasi SUPER_ADMIN; COMPLETED = read-only abadi.
5. Cancel proyek hanya SUPER_ADMIN; COMPLETED tidak bisa dibatalkan/ditahan.
6. Foto progres opsional (tidak diwajibkan per log).
7. Paket murni material (`hasPhysicalWork = false`) tidak memiliki jadwal fisik; progres dihitung dari persentase penerimaan barang dan ditampilkan dengan bar biru/sky.
8. Matriks approval AR mengadopsi 9 role standar SAP dengan dukungan penandaan `[TIDAK_PERLU]` (badge NA abu-abu).
9. Tabel rincian paket kerja distandarisasi menjadi 6 kolom tematik padat untuk menghindari scroll horizontal berlebih.

## 7. Non-Functional Requirements

- **Keamanan:** bcrypt; middleware + `requireRole` di setiap Route Handler; rate limit `/api/auth` via Upstash; tidak ada secret fallback hard-coded; upload divalidasi MIME/ukuran di server (presign R2).
- **Performa:** list < 2 detik untuk 1.000 proyek (paginasi server-side + index + adapter Neon serverless); dashboard stats di-cache 60 detik; first paint tidak diblokir komponen berat (peta/Gantt/export lazy).
- **Ketersediaan:** 99% jam kerja (free tier: cold start Neon dimitigasi, lihat STACK.md §2).
- **Auditability:** snapshot approval (attempt history), AuditLog untuk mutasi penting, kode proyek abadi, COMPLETED immutable.
- **Bahasa UI:** Bahasa Indonesia.

## 8. Out of Scope (MVP)

- Integrasi SAP/ERP, notifikasi WhatsApp/email otomatis, aplikasi mobile native, multi-currency.
- **Mode offline / input lapangan tanpa sinyal** — diputuskan out of scope; mitigasi: form ringan, foto dikompres client, submit bisa diulang.
- Notifikasi ke approver di dalam sistem (approval adalah pencatatan, bukan workflow aktif).

## 9. Success Metrics

- 100% proyek WM baru dicatat di sistem dalam 3 bulan.
- Waktu penyusunan laporan bulanan turun ≥ 70%.
- Proyek delay terdeteksi ≥ 2 minggu sebelum target selesai.
