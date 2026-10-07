# QUICKSTART.md — Panduan Setup dari Nol (Proyek Baru)

> Untuk developer pemula. Ikuti berurutan, jangan melompat.
> Target akhir panduan ini: aplikasi jalan di `localhost:3000`, bisa login, tersambung ke Neon.

## Langkah 0 — Pasang Alat (sekali saja)

1. **Node.js 20 LTS** — unduh dari https://nodejs.org (pilih LTS). Cek di terminal: `node -v` harus menampilkan `v20.x`.
2. **Git** — https://git-scm.com. Cek: `git --version`.
3. **Antigravity IDE** — sudah terpasang (dipakai sebagai editor + agent).
4. Buat akun gratis: GitHub, Vercel (login pakai GitHub), Neon (neon.tech), Cloudflare, Upstash.

## Langkah 1 — Buat Proyek Next.js

Buka terminal di folder kerja, lalu:

```bash
npx create-next-app@14 wm-prjct-mngmnt --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd wm-prjct-mngmnt
```

Saat ditanya "Turbopack" pilih **No** (biar sesuai dokumentasi Next 14 konvensional).

Jalankan uji pertama:

```bash
npm run dev
```

Buka http://localhost:3000 — kalau halaman Next.js muncul, fondasi sudah benar. Tekan `Ctrl+C` untuk berhenti.

## Langkah 2 — Dorong ke GitHub

```bash
git add -A
git commit -m "chore: init next.js 14 app"
```

Buat repo privat baru di GitHub (nama `wm-prjct-mngmnt`), lalu ikuti perintah push yang ditampilkan GitHub
(`git remote add origin ...` lalu `git push -u origin main`).

## Langkah 3 — Masukkan Dokumen

1. Salin 9 file hasil diskusi ke folder `docs/` di dalam proyek (buatlah foldernya).
2. Salin `AGENTS.md` ke ROOT proyek (sejajar `package.json`, BUKAN di dalam `docs/`).
3. Commit: `git add -A && git commit -m "docs: add knowledge base" && git push`.

## Langkah 4 — Buat Database Neon (gratis)

1. Login https://neon.tech → New Project → region **Singapore** → nama `wm-prjct-mngmnt`.
2. Di dashboard, salin DUA connection string:
   - **Pooled** (ada tulisan `-pooler`) → nanti jadi `DATABASE_URL`.
   - **Direct** → nanti jadi `DIRECT_URL`.
3. Buat file `.env` di root proyek dengan isi:

```bash
DATABASE_URL="postgreqsl://...-pooler/..."   # ganti dengan pooled URL
DIRECT_URL="postgresql://.../..."            # ganti dengan direct URL
NEXTAUTH_SECRET=""                            # sementara kosong, diisi langkah berikut
NEXTAUTH_URL="http://localhost:3000"
```

4. Generate secret: jalankan `openssl rand -base64 32` (Mac/Linux/Git Bash) atau minta agent Antigravity
   membuatkannya, lalu tempel ke `NEXTAUTH_SECRET`.

## Langkah 5 — Buka di Antigravity & Percakapan Pertama

1. Buka folder proyek di Antigravity.
2. Pastikan mode **Planning** aktif untuk percakapan awal.
3. Prompt percakapan PERTAMA (salin persis):

```
Ini proyek Next.js 14 baru yang masih kosong. Baca AGENTS.md di root, lalu docs/Rules.md,
docs/DATABASE.md, dan docs/WORKFLOW.md. Kerjakan fondasi:

1. Instal dependency sesuai docs/STACK.md: prisma + @prisma/client + @prisma/adapter-neon
   + @neondatabase/serverless, next-auth v4, bcryptjs, zod, react-hook-form +
   @hookform/resolvers, shadcn/ui (jalankan npx shadcn init, style default).
2. Tulis prisma/schema.prisma LENGKAP mengikuti docs/DATABASE.md v2 (semua model, enum,
   index, Decimal untuk uang, directUrl env DIRECT_URL).
3. Buat src/lib/prisma.ts singleton dengan adapter Neon serverless.
4. Jalankan npx prisma migrate dev --name init.
5. Buat prisma/seed.js: 1 user SUPER_ADMIN (email/password dari env SEED_*), 1 Region +
   1 Company + 1 Estate + 2 Block contoh, beberapa UoM (m, m3, unit, btg), contoh Vendor,
   StructureType "Pintu Air" + 1 Variant dengan template BOQ, dan hari libur 2026.
6. Setup NextAuth Credentials sesuai docs/STACK.md (JWT, session berisi id+role,
   TIDAK ADA fallback secret) + middleware proteksi route + halaman /login.
7. Pastikan npm run build hijau, lalu Update checkbox terkait di docs/task.md.

Sebelum mulai, tampilkan Implementation Plan dulu untuk saya review.
```

4. Review plan-nya (cek: apakah ia menyebut DATABASE.md dan adapter Neon?), setujui, tunggu.
5. Setelah selesai, minta agent menjalankan: `npm run db:seed` lalu `npm run dev`.

## Langkah 6 — Uji Coba Pertama

1. Buka http://localhost:3000 → harus melempar ke `/login`.
2. Login pakai email/password seed.
3. Kalau masuk: SELAMAT, fondasi selesai. Commit: `git add -A && git commit -m "feat: auth + db foundation" && git push`.

## Selanjutnya — Irama Kerja Harian

- Satu percakapan = satu fase di `docs/task.md`. Sebutkan nama fase dan dokumen wajib bacanya.
- Selalu tutup dengan perintah: "update checkbox di docs/task.md".
- Sebelum commit: pastikan `npm run build` hijau.
- Setup Vercel/R2/Upstash/Sentry TIDAK perlu sekarang — cukup saat mendekati deploy (DEPLOYMENT.md §3).
