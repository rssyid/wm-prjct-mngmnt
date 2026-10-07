# design.md — UI/UX Guidelines (v2)

> **Perubahan v2:** library modern (TanStack Table, cmdk, nuqs, TanStack Query), pola skeleton
> bentuk-konten, fallback kartu mobile, aturan token semantik dipertegas, interaksi mikro 150–200 ms.
> Prinsip, palet, dan tipografi v1 dipertahankan.

## 1. Prinsip Desain

1. Data-first — aplikasi operasional; informasi padat, mudah dipindai.
2. Status selalu terlihat — badge status + indikator warna di setiap baris.
3. Konsisten — komponen dari `src/components/ui`; jangan membuat ulang tombol/input custom.
4. Bahasa Indonesia untuk semua label, placeholder, pesan.
5. **Terlihat cepat** — skeleton berbentuk konten, transisi halus, tanpa spinner layar penuh.

## 2. Palet & Warna Semantik

Palet v1 dipertahankan (primary hijau perkebunan `#16A34A`, accent `#0EA5E9`, dsb). Aturan baru yang WAJIB:

1. **Warna status hanya lewat token semantik** — mapping status → label + kelas disimpan di `src/lib/constants/status.ts`; komponen tidak boleh menulis kelas warna status inline.
2. Dark mode: background `#020817`, card cukup terang (`#0A1226` disarankan) dan border lebih kontras agar konten tidak tenggelam.
3. Warna semantik: ON_TRACK/COMPLETED hijau, AT_RISK amber, DELAYED/CANCELLED merah, ON_HOLD slate, PROCUREMENT violet, EXECUTION sky, DRAFT/SURVEY slate pudar.

## 3. Tipografi

Dipertahankan: Inter + JetBrains Mono via `next/font/google` (subset Latin). Kolom angka/uang wajib `tabular-nums`. Format `id-ID` (Rp 1.250.000, dd/MM/yyyy). Heading & body sesuai tabel v1.

## 4. Library Komponen (disesuaikan)

| Kebutuhan | Library | Catatan |
|-----------|---------|---------|
| Primitif UI | shadcn/ui + Radix | Sumber komponen dasar; `npx shadcn@latest add` |
| Tabel data-dense | **TanStack Table** (headless, styling tetap shadcn) | Sorting/filter instan; opsi virtualisasi untuk 1.000+ baris |
| Command palette | **cmdk** (Ctrl+K / ⌘K) | Lompat ke proyek/halaman/aksi cepat |
| State filter via URL | **nuqs** | Filter list masuk query string → shareable, back-button bekerja |
| Fetch client | **TanStack Query** | Cache + dedupe + interval; mengurangi hit ke function/Neon |
| Chart | Recharts (warna dari token CSS) | Lazy-load |
| Peta | react-leaflet via `next/dynamic ssr:false` | Lazy-load |
| Export | jsPDF + jsPDF-autotable, xlsx | Import dinamis saat tombol export ditekan |
| Ikon | hanya `lucide-react` | h-4 w-4 inline, h-5 w-5 nav |
| Animasi | Transisi CSS saja (`transition-all duration-150 ease-out`) | Tanpa library animasi berat |

## 5. Pola UX Wajib

- **Loading:** skeleton menyerupai bentuk konten (baris tabel → baris skeleton; KPI → kartu skeleton). Spinner hanya di tombol submit.
- **Empty state:** ikon + kalimat + CTA tunggal.
- **Form:** label di atas, `*` wajib, Zod `.refine()` dipakai bersama client & server via react-hook-form.
- **Feedback:** toast/FeedbackModal; sukses auto-close 3 detik; error tetap sampai ditutup.
- **Destruktif:** `AlertDialog` (hapus, cancel, ON_HOLD dengan alasan wajib).
- **Filter persisten:** semua filter halaman list ditulis ke URL via nuqs; refresh/back tidak menghilangkan konteks.
- **Aksesibilitas:** kontras WCAG AA, ring fokus terlihat, ikon-button punya `aria-label`, navigasi keyboard bekerja (termasuk di command palette & tabel).

## 6. Layout & Responsif

App shell v1 dipertahankan (sidebar collapsible + navbar). Aturan tambahan v2:

- Di bawah `md`, tabel data-dense **berubah menjadi kartu** per baris (bukan hanya scroll horizontal); kolom kunci 3–4 tampil, sisanya di expand/detail.
- Gantt mobile: scroll horizontal + kolom nama paket sticky.
- Command palette menjadi jalan pintas utama di viewport kecil (sidebar jadi drawer).
- Breakpoint & spacing sesuai tabel v1; radius `--radius: 0.5rem`.

## 7. Referensi Gaya

Linear (kepadatan + command palette), Vercel Dashboard (tipografi, kontras), Monday.com (Gantt), shadcn/ui Dashboard example (layout). Target rasa: "dashboard modern yang terasa instan" — bukan animasi mewah, melainkan transisi pendek, skeleton akurat, dan filter yang sticky di URL.
