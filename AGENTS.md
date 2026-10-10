# AGENTS.md — WM PRJCT MNGMNT

> File ini dibaca otomatis oleh agent di setiap percakapan. Ikuti instruksinya SEBELUM menulis kode.

## Sumber Kebenaran (folder `docs/`)

Urutan membaca bergantung jenis pekerjaan:

| Jika pekerjaanmu menyentuh... | Baca DULU (wajib, bukan opsional) |
|-------------------------------|-----------------------------------|
| Transisi status, approval, kiriman barang, BAST, cancel/hold | `docs/WORKFLOW.md` → `docs/API.md` |
| Skema, query, model Prisma, hierarki wilayah | `docs/DATABASE.md` → `docs/LOCATION_HIERARCHY.md` → `docs/WORKFLOW.md` |
| Endpoint/route handler baru | `docs/API.md` → `docs/Rules.md` §4 |
| Komponen UI, tabel, filter, warna | `docs/design.md` → `docs/Rules.md` §3 |
| Deploy, env, storage, cache | `docs/DEPLOYMENT.md` → `docs/STACK.md` |
| Scope fitur / acceptance criteria | `docs/PRD.md` |
| Apa yang harus dikerjakan & urutannya | `docs/task.md` |

`docs/Rules.md` berlaku untuk SEMUA kode. `docs/task.md` adalah roadmap — selesaikan satu fase,
centang checkbox-nya di file tersebut, baru lanjut fase berikutnya.

## Larangan Keras (dari WORKFLOW.md)

1. `Project.status` HANYA boleh diubah lewat `src/server/services/project-transition.service.ts` (tabel T1–T10).
2. WorkPackage tidak boleh dibuat sebelum `AfceDocument.status = "APPROVED"` (B3).
3. Proyek `COMPLETED` = read-only; semua mutasi menolak dengan 409 (B9).
4. Kode proyek HARUS dari `ProjectCodeCounter` di dalam transaksi — dilarang `count()`/`max()` di luar transaksi (B10).
5. Approval harus berjenjang berurutan; history attempt tidak pernah dihapus/diubah (B2, B4).

## Prinsip Stack (STACK.md)

- Runtime DB via `@prisma/adapter-neon`; jangan buka koneksi TCP langsung.
- Upload file: presigned URL R2, kompresi foto di client (≤1600px, JPEG q0.8); jangan transit lewat function.
- Dashboard stats lewat cache Upstash TTL 60 detik; invalidasi setiap mutasi domain.
- Foto dari R2 disajikan langsung — JANGAN pakai `next/image` optimizer.

## Disiplin UI (design.md v2)

- Tabel data: TanStack Table + styling shadcn. Filter halaman list: nuqs. Fetch client: TanStack Query.
- Warna status HANYA via `src/lib/constants/status.ts`.
- Komponen berat (peta, Gantt, chart, export) = lazy/dynamic import.

## Sebelum Merge

`npm run lint` && `npx tsc --noEmit` && `npm run build` harus hijau. Conventional Commits.
Setiap selesai satu task, update checkbox di `docs/task.md`.
