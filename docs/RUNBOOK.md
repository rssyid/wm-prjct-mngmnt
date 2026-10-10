# RUNBOOK.md — Semua Prompt Percakapan (eksekusi berurutan)

> Cara pakai: setiap percakapan = percakapan BARU di Antigravity, mode **Planning**, tempel prompt persis.
> Setelah selesai: uji manual sesuai checklist → `npm.cmd run build` hijau → commit → percakapan baru.
> Jangan pernah gabung dua percakapan. Jika error: tempel error ke percakapan yang sama dengan "perbaiki ini".
> Asumsi awal: fondasi, service layer inti, dan CRUD Proyek SUDAH selesai.

---

## P4 — AFCE & Approval

```
/plan Baca docs/WORKFLOW.md §2 (T2–T5, B1–B5) dan docs/API.md §3.2, docs/DATABASE.md §5.
Transition service dan auth-guard sudah ada — pakai, jangan dibuat ulang.

Kerjakan modul AFCE/AR:
1. GET / PUT /api/projects/[id]/afce — upsert AFCE. Checklist rabReady & emailSubmitted
   memicu transisi otomatis via transition service (bukan set status langsung).
   Upsert approvals array = snapshot attempt currentAttempt. Approve level N sebelum
   N-1 Approved → 400 "Approval harus berurutan". Semua Approved → AfceStatus APPROVED +
   transisi. Ada yang REJECTED → AfceStatus REJECTED + proyek kembali RAB_READY.
2. POST /api/projects/[id]/afce/resubmit — attemptNo + 1, snapshot baru WAITING,
   history attempt lama tidak disentuh (B4).
3. GET+POST /api/projects/[id]/supplementary — AR tambahan paralel, tidak menyentuh
   status proyek (B5).
4. UI tab "AFCE / AR" di detail proyek: form checklist + nominal, jenjang approval
   (level dinamis tambah/hapus baris: role, nama, status, tanggal), tampilan history
   attempt yang collapsed, tombol "Ajukan Ulang" muncul hanya saat REJECTED,
   badge status AFCE di header.
5. Badge notifikasi navbar: jumlah AR REJECTED + approval waiting (endpoint kecil
   /api/dashboard/stats boleh menyediakan hitungannya dulu).
6. Build hijau, update checkbox docs/task.md (Phase C: resubmit AFCE + history approval).
Tampilkan Implementation Plan dulu.
```

**Uji:** checklist rabReady → status berubah RAB_READY; emailSubmitted → WAITING_AFCE_AR; approve level 2 sebelum level 1 → error berbahasa Indonesia; tolak level 1 → status REJECTED + "Ajukan Ulang" muncul → resubmit → history attempt 1 masih terlihat.
**Commit:** `feat: modul afce — approval berjenjang, attempt resubmit, supplementary`

---

## P5 — Work Package & Kedatangan Berulang

```
/plan Baca docs/WORKFLOW.md (B3, B7, T5) dan docs/API.md §2 + §3.3 + §3.4, docs/DATABASE.md §6.
Transition service sudah ada.

Kerjakan modul pengadaan:
1. POST /api/projects/[id]/packages — gerbang B3: AFCE belum APPROVED → 403. Pembuatan
   paket pertama memicu transisi ke PROCUREMENT via transition service. Validasi tanggal
   prUspkDate ≤ poSpkDate via Zod .refine. weightPct total per proyek tidak boleh > 100
   (validasi di service, error 400).
2. PUT / DELETE /api/projects/[id]/packages/[packageId] — update tahap PR→PO; status paket
   otomatis: noPrUspk terisi → PR_SUBMITTED; noPoSpk terisi → PO_ISSUED. Validasi uang
   Decimal. DELETE = soft delete.
3. POST / GET /api/projects/[id]/packages/[packageId]/deliveries — kiriman berulang:
   satu pengiriman = PackageDelivery + PackageDeliveryItem per item. Satu transaksi:
   akumulasi PackageItem.qtyReceived, actualDeliveryDate = kiriman terakhir, status paket
   IN_DELIVERY / PARTIALLY_DELIVERED / DELIVERED (Σreceived ≥ Σplanned; override manual
   wajib remarks), hitung deliveryDelayDays = kiriman terakhir − estDeliveryDate.
4. UI tab "Pengadaan": tabel paket (badge status, bobot, nilai PO), drawer/dialog detail
   paket berisi: form PR/PO, line item dari Master Item (qty plan × harga → total),
   timeline kiriman (bisa tambah kiriman ke-2, ke-3), ringkasan qty planned vs received
   per item, peringatan keterlambatan hari.
5. Pembayaran per paket: paymentStatus + paidAmount + paidDate (form kecil di detail paket).
6. Build hijau, update checkbox docs/task.md (Phase C: line item, deliveries, keterlambatan).
Tampilkan Implementation Plan dulu.
```

**Uji:** buat paket sebelum AFCE APPROVED → 403; bobot total > 100 → ditolak; kiriman parsial (setengah qty) → status PARTIALLY_DELIVERED; kiriman kedua melengkapi → DELIVERED + selisih keterlambatan benar; rusak dicatat di notes kiriman.
**Commit:** `feat: work package — gate afce, line item, kedatangan berulang, pembayaran`

---

## P6 — Progres Mingguan & Alat Berat

```
/plan Baca docs/WORKFLOW.md (B6), docs/API.md §2 + §3.4(progress), docs/DATABASE.md §7,
docs/PRD.md US-03. Progress service (agregasi) sudah ada — pakai.

Kerjakan modul realisasi:
1. POST /api/projects/[id]/progress — wajib workPackageId + weekNo; duplikat → 409;
   logDate tidak boleh masa depan; foto = array URL (untuk sementara terima URL manual,
   upload asli menyusul di P9); cuaca + tinggi muka air opsional. Setelah simpan:
   hitung ulang progres paket + proyek dalam transaksi via progress service.
2. PUT / DELETE /api/projects/[id]/progress/[logId] — hanya minggu berjalan
   (weekNo == minggu berjalan proyek) boleh diubah; minggu lampau → 409.
   Setelah mutasi: agregasi dihitung ulang.
3. POST/PUT/DELETE /api/projects/[id]/equipment — log alat berat; hmEnd ≥ hmStart via Zod;
   hmHours dihitung server.
4. UI tab "Realisasi": per-paket kartu berisi form progres mingguan (minggu berjalan
   ter-highlight), riwayat log per minggu (read-only untuk minggu lampau), tabel alat
   berat; header proyek menampilkan progres total tertimbang.
5. Build hijau, update checkbox docs/task.md (Phase C: progres mingguan).
Tampilkan Implementation Plan dulu.
```

**Uji:** input 2 log minggu sama untuk paket sama → error 409; edit log minggu lalu → ditolak; 2 paket bobot 40/60 → progres proyek sesuai rumus (uji hitung manual).
**Commit:** `feat: progres mingguan per paket + log alat berat dengan agregasi transaksi`

---

## P7 — BAST & Penutupan Proyek

```
/plan Baca docs/WORKFLOW.md (T7–T10, B8, B9) dan docs/API.md §2 (transition, bast,
bast/verify), docs/DATABASE.md §7 (BastDocument).

Kerjakan modul penutupan:
1. POST /api/projects/[id]/transition — pastikan action REQUEST_BAST mensyaratkan
   bastFileUrl terisi (placeholder dulu bila upload belum jadi — isi URL dummy dari
   form input teks; upload asli di P9), HOLD/RESUME/CANCEL berjalan sesuai aturan,
   CANCEL hanya SUPER_ADMIN (403), COMPLETED menolak semua (409).
2. PUT /api/projects/[id]/bast — upsert draft BAST (nomor, tanggal, inspektur, notes).
3. POST /api/projects/[id]/bast/verify — khusus SUPER_ADMIN: isi verifiedAt +
   verifiedById → proyek COMPLETED. Tidak mensyaratkan LUNAS (B8).
4. UI tab "BAST": form draft, tombol "Ajukan BAST" (transisi ke WAITING_BAST),
   tombol "Verifikasi" hanya terlihat untuk SUPER_ADMIN; setelah COMPLETED seluruh
   workspace read-only (semua tombol mutasi disabled + banner "Proyek terkunci").
5. Tombol ON_HOLD dengan dialog alasan wajib; "Lanjutkan" mengembalikan status sebelumnya;
   tombol Batalkan Proyek hanya untuk SUPER_ADMIN dengan AlertDialog + alasan wajib.
6. Build hijau, update checkbox docs/task.md (Phase C: BAST + COMPLETED read-only,
   Phase E: AlertDialog HOLD/CANCEL).
Tampilkan Implementation Plan dulu.
```

**Uji:** user WM_HO_SPECIALIST tidak melihat tombol verifikasi & cancel; verify → status COMPLETED → coba edit paket → tombol disabled / API menjawab 409; HOLD → isi alasan → EWS beku → Lanjutkan → status kembali.
**Commit:** `feat: bast, verifikasi super admin, kunci proyek completed, hold/resume/cancel`

---

## P8 — Dashboard & EWS

```
/plan Baca docs/PRD.md US-04, docs/API.md §2 (dashboard/stats), docs/STACK.md §2.4,
docs/WORKFLOW.md §4, docs/DATABASE.md (Holiday). Tabel Holiday sudah ter-seed 2026.

Kerjakan dashboard & early warning:
1. src/lib/sla.ts — SATU tempat kalkulasi: bandingkan progressPct aktual vs rencana
   linear (targetStartDate..targetEndDate, hari kerja = hari kalender − Holiday −
   Minggu; Sabtu dihitung kerja). AT_RISK bila deviasi > 10 poin, DELAYED bila
   targetEndDate lewat atau deviasi > 25 poin, COMPLETED bila status COMPLETED.
   ON_HOLD dibekukan. Sinkronkan Project.statusIndicator lewat progress service
   (setiap perubahan progres) — jangan dihitung dua kali di tempat lain.
2. GET /api/dashboard/stats — KPI: total proyek per status, per indicator, proyek
   DELAYED teratas, ringkasan pengadaan (paket outstanding), belum ada cache dulu.
3. Halaman / : kartu KPI (angka tabular-nums), daftar proyek AT_RISK/DELAYED dengan
   badge warna dari lib/constants/status.ts, auto-refresh via TanStack Query
   refetchInterval 60 detik; skeleton saat loading.
4. Badge navbar membaca angka yang sama (satu sumber data).
5. Build hijau, update checkbox docs/task.md (bagian dashboard/EWS).
Tampilkan Implementation Plan dulu.
```

**Uji:** buat proyek dengan tanggal lewat dan progres rendah → masuk daftar DELAYED di dashboard; ubah progres → indikator berubah konsisten di list, workspace, dan navbar.
**Commit:** `feat: dashboard kpi + ews sla terpusat`

---

## P9 — Upload File (Cloudflare R2)

```
/plan Baca docs/STACK.md §4 dan docs/Rules.md §7, docs/DEPLOYMENT.md §1 (env R2).
Setup akun: saya sudah mengisi R2_* di .env (jika belum ada, minta saya dulu —
JANGAN buat nilai palsu).

Kerjakan upload:
1. POST /api/uploads/presign — auth + role, validasi MIME (image/*, application/pdf,
   .xlsx) dan ukuran ≤ MAX_UPLOAD_MB, hasilkan presigned PUT URL R2 (sdk @aws-sdk/client-s3
   dengan endpoint R2), kembalikan { uploadUrl, publicUrl }.
2. Helper client src/lib/upload.ts: compressImage(file) — canvas resize maks 1600px
   JPEG q0.8 (PDF/xlsx dilewat tanpa kompresi) → minta presign → PUT langsung ke R2 →
   kembalikan publicUrl.
3. Integrasikan ke: foto progres (multi-upload dengan progress per file), sitePlanUrl &
   drawingUrl di form proyek, PackageDocument (PR/PO/DO/Invoice), bastFileUrl,
   evidenceDocUrl approval.
4. Tampilkan foto sebagai link/thumbnail dari publicUrl R2 TANPA next/image optimizer.
5. Build hijau, update checkbox docs/task.md (Phase C: upload dokumen & foto R2).
Tampilkan Implementation Plan dulu.
```

**Uji:** upload foto 8 MB → terkompresi ≤ 500 KB; upload .docx → ditolak; foto tampil dari domain R2; bastFileUrl tersimpan dan bisa dibuka.
**Commit:** `feat: upload r2 — presign, kompresi client, integrasi semua modul`

---

## P10 — Master Data Sisanya & Users

```
/plan Baca docs/API.md §1–2, docs/DATABASE.md §3, docs/design.md.
Pola master yang sudah ada (UoM, Vendor, dst) dijadikan acuan — konsisten.

Kerjakan:
1. Master lokasi Region/Company/Estate/Block: CRUD lengkap dengan relasi berantai di UI
   (pilih Region → daftar Company-nya; dst), konfirmasi AlertDialog bila hapus akan
   cascade (Estate/Block), tolak hapus bila masih dipakai proyek (cek count, 409 pesan
   jelas).
2. Manajemen user /users: CRUD, assign role, toggle aktif/nonaktif, reset password
   (set langsung oleh admin + wajib ganti — sederhana: bcrypt di server), JANGAN pernah
   mengembalikan field password/rememberToken (select eksplisit). Khusus SUPER_ADMIN.
3. Master Hari Libur: input manual + bulk dari CSV sederhana (tanggal;nama per baris)
   agar tahun baru gampang diisi; tampilkan peringatan di dashboard bila tahun berjalan
   kosong.
4. Import Excel master Item (xlsx, dinamis import): kolom itemCode, name, category, uom,
   standardPrice; baris gagal dilaporkan dengan nomor baris; upsert by itemCode.
5. Build hijau, update checkbox docs/task.md (Phase C: master lokasi, Phase 3 lama:
   import excel; users).
Tampilkan Implementation Plan dulu.
```

**Uji:** hapus Estate yang dipakai proyek → 409 dengan pesan jelas; nonaktifkan user lalu login pakai user itu → gagal; import 5 baris Excel dengan 1 baris rusak → 4 masuk, 1 dilaporkan.
**Commit:** `feat: master lokasi, manajemen user, hari libur csv, import excel item`

---

## P11 — Gantt, S-Curve & Portofolio

```
/plan Baca docs/design.md §4–6 (Gantt lazy, sticky column, kartu mobile), docs/PRD.md F-08,
docs/API.md. Komponen berat WAJIB lazy-load.

Kerjakan visualisasi:
1. Gantt chart per proyek (tab "Timeline" di workspace): bar rencana (border accent) vs
   realisasi (fill accent) per paket dari planStartDate..planEndDate dan
   actualStartDate..actualEndDate, milestone tanggal penting, kolom nama paket sticky saat
   scroll horizontal; memoize data dengan useMemo.
2. S-Curve: Recharts, kurva rencana linear kumulatif vs realisasi kumulatif tertimbang;
   warna dari token CSS.
3. Gantt portofolio di /reports atau section dashboard: semua proyek aktif dalam satu
   timeline, bar diberi warna statusIndicator; responsif (di mobile jadi daftar kartu
   dengan progress bar, sesuai aturan design.md §6).
4. Build hijau, update checkbox docs/task.md (Phase C: gantt portofolio; Phase E bila relevan).
Tampilkan Implementation Plan dulu.
```

**Uji:** timeline proyek 3 paket → bar rencana vs realisasi terlihat benar; proyek DELAYED berwarna merah di portofolio; di lebar layar < 768px tidak ada tabel rusak.
**Commit:** `feat: gantt per proyek, s-curve, gantt portofolio`

---

## P12 — Laporan & Export

```
/plan Baca docs/PRD.md F-09, docs/design.md §4 (jsPDF + xlsx import dinamis saat tombol
ditekan).

Kerjakan laporan:
1. Halaman /reports untuk MANAGEMENT_VIEWER juga (read-only): pilih jenis laporan +
   filter (company, rentang tanggal, status).
2. Laporan Status Proyek — PDF (jsPDF + autotable): KPI ringkas + tabel proyek
   (kode, nama, status, indikator, progres, target selesai).
3. Laporan Pengadaan Outstanding — Excel (xlsx): paket dengan paymentStatus != LUNAS atau
   belum DELIVERED: kolom paket, vendor, PO, estimasi, keterlambatan hari, nilai.
4. Laporan Realisasi Anggaran — Excel: totalBudgetAmount vs Σ contractOrPoAmount vs
   Σ paidAmount per proyek.
5. Semua export diformat id-ID (Rp, dd/MM/yyyy), nama file berisi tanggal.
6. Build hijau, update checkbox docs/task.md.
Tampilkan Implementation Plan dulu.
```

**Uji:** export PDF terbuka dan angka rupiah berformat `Rp 1.250.000`; Excel outstanding hanya berisi paket belum lunas; library jsPDF/xlsx tidak ikut di bundle awal (cek network tab: termuat saat klik export).
**Commit:** `feat: laporan pdf status proyek + excel outstanding dan anggaran`

---

## P13 — Performa & Keamanan Produksi

```
/plan Baca docs/STACK.md §2 dan docs/Rules.md §7–8, docs/DEPLOYMENT.md §1 (env Upstash &
CRON_SECRET). Saya sudah mengisi UPSTASH_REDIS_REST_* dan CRON_SECRET di .env
(jika belum, minta saya dulu).

Kerjakan:
1. Cache /api/dashboard/stats di Upstash: TTL 60 detik, key per company bila terfilter;
   helper invalidateDashboardCache() dipanggil dari semua service mutasi domain
   (project, package, progress, afce, bast).
2. Rate limit Upstash: /api/auth/callback/credentials max 10 percobaan / 5 menit
   (IP+email, respon 429 pesan Indonesia); /api/uploads/presign max 60 / jam / user.
3. GET /api/health: cek header Authorization Bearer CRON_SECRET, jalankan SELECT 1,
   kembalikan { ok: true } — untuk cron pemanas.
4. Command palette cmdk (Ctrl+K): cari proyek (nama/kode) + aksi cepat buat proyek baru
   + navigasi halaman.
5. Audit aksesibilitas cepat: semua ikon-button ber-aria-label, fokus terlihat.
6. Build hijau, update checkbox docs/task.md (Phase D sisa, Phase E cmdk + a11y).
Tampilkan Implementation Plan dulu.
```

**Uji:** salah password 11x berturut → ke-11 ditolak 429; buka dashboard 2x → hit kedua lebih cepat; Ctrl+K mencari proyek berfungsi.
**Commit:** `feat: cache dashboard upstash, rate limit, health cron, command palette`

---

## P14 — Deploy ke Vercel

```
/plan Baca docs/DEPLOYMENT.md §3–6 dan docs/STACK.md.
Jalankan saya langkah demi langkah untuk deploy (saya yang klik di dashboard, Anda yang
menyiapkan kode/konfig):
1. Rapikan .env.example persis seperti docs/DEPLOYMENT.md §1.
2. Tambahkan vercel.json dengan 1 cron harian 0 0 * * * ke /api/health dan Node 20,
   region sin1.
3. Buat workflow .github/workflows/ci.yml (lint, tsc, prisma validate+generate, build)
   persis docs/DEPLOYMENT.md.
4. Siapkan script/db:seed produksi dan beri saya langkah persis: membuat branch dev di
   Neon, mengisi env Production & Preview di Vercel, mendaftarkan R2 + Upstash env,
   seed produksi sekali dari lokal, custom domain (jika ada), dan menjalankan
   go-live checklist DEPLOYMENT.md §6 satu per satu.
5. Build lokal hijau dulu sebelum saya connect repo ke Vercel.
Tampilkan Implementation Plan dulu.
```

**Uji:** URL Vercel terbuka via HTTPS → bisa login → buat proyek percobaan → cron/besok pagi cek tidak ada cold start menyakitkan.
**Commit:** `chore: deploy vercel — ci, cron, env`

---

## P15 — UAT & Penutupan

```
/plan Baca docs/PRD.md (semua user stories + AC) dan docs/DEPLOYMENT.md §6.
Buat lembar UAT: daftar uji manual per role (SUPER_ADMIN, WM_HO_SPECIALIST,
MANAGEMENT_VIEWER) mencakup alur penuh: buat proyek → survei → RAB → AFCE ditolak →
resubmit → approved → 2 paket (bobot 40/60) → PR → PO → kiriman parsial → kiriman
lengkap terlambat → mulai eksekusi → 4 minggu progres → alat berat → ajukan BAST →
verifikasi → COMPLETED terkunci → export 3 laporan. Eksekusi yang bisa otomatis
(seed user 3 role, skenario data dummy) Anda kerjakan; yang manual beri saya langkah
klik-persisnya. Tandai di docs/task.md bahwa UAT dilaksanakan.
```

**Uji akhir (Anda sendiri):** jalankan skenario penuh tanpa error; coba rusak aturan (approve lompat level, edit COMPLETED, kode duplikat) → semuanya ditolak dengan pesan Indonesia.
**Commit:** `test: uat 3 role alur penuh` → aplikasi selesai, go-live.

---

## P16 — Pembaruan Laporan 3-Tab & WBS Matriks (Phase F)

```
/plan Baca docs/PRD.md (F-08 & F-09), docs/WORKFLOW.md (B12, B13), docs/design.md §4, docs/API.md §3.6.

Kerjakan penyempurnaan UI/UX WBS dan Laporan:
1. WBS Matriks Gantt & Kurva S:
   - Dukungan paket kerja Dual-Track: paket murni pengadaan material (`hasPhysicalWork = false`)
     hanya menampilkan bar pengadaan & kedatangan material (sky-500); paket dengan pekerjaan fisik
     lapangan (`hasPhysicalWork = true`) menampilkan dual timeline (pengadaan + fisik lapangan emerald-500).
   - Auto-sync tanggal selesai aktual lapangan (`actualEndDate`) saat progres fisik mencapai 100%.
2. Halaman Laporan Terpadu (`/reports`):
   - 3 Tab navigasi: "Ringkasan Eksekutif" (View 1), "Progres & Fisik Lapangan" (View 2), dan "Pengadaan & Material" (View 3).
   - Format Tabel 6-Kolom Padat pada View 2: Nama Proyek & Lokasi, Status & Periode, Bobot & Deviasi,
     Timeline Rencana vs Aktual (dd/mm), Realisasi Mingguan (Bobot Tertimbang), dan Dokumentasi Lapangan.
   - Filter Multi-Select Perusahaan (`nuqs`), status multi-filter, dan rentang tanggal.
   - Export dinamis Client-Side: jsPDF / autotable untuk PDF lanskap rapi & xlsx untuk spreadsheet multi-sheet.
3. Build hijau, update checkbox docs/task.md (Phase F).
```

**Uji:** Buka WBS paket non-fisik → bar material tampil warna sky; buat progres 100% pada paket fisik → tanggal aktual auto-sync ke tanggal log; buka /reports → tabel 6 kolom muat tanpa scroll horizontal, export PDF & Excel berhasil.
**Commit:** `feat: laporan 3 tab padat, wbs matriks dual-track pengadaan dan fisik`

