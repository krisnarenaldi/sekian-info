# Panduan Deployment Vercel — Sekian Info v2

## Persyaratan

- Akun [Vercel](https://vercel.com)
- Akun [Supabase](https://supabase.com) dengan project yang sudah disetup
- API key [Google Gemini](https://aistudio.google.com)

---

## Environment Variables

Set seluruh variabel berikut di **Vercel Dashboard → Project Settings → Environment Variables**.

### Supabase

| Variable | Wajib | Deskripsi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase. Contoh: `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon/public key Supabase, digunakan oleh frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key Supabase, digunakan oleh backend/cron (jangan expose ke client) |

> Temukan ketiga nilai ini di: **Supabase Dashboard → Project Settings → API**.

### Gemini AI

| Variable | Wajib | Deskripsi |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | API key Google Gemini 2.5 Flash untuk summarisasi dan embedding |

> Dapatkan API key di: [Google AI Studio](https://aistudio.google.com/app/apikey).

### Cron Security

| Variable | Wajib | Deskripsi |
|---|---|---|
| `CRON_SECRET` | ✅ | Secret token untuk mengamankan endpoint cron. Vercel akan mengirim header `Authorization: Bearer <CRON_SECRET>` secara otomatis |

> Generate nilai acak yang kuat, misalnya: `openssl rand -hex 32`

### Opsional

| Variable | Wajib | Default | Deskripsi |
|---|---|---|---|
| `EMBEDDING_MODEL` | ❌ | `gemini` | Model embedding yang digunakan. Nilai: `gemini` (Gemini Embedding) atau `bge-small` (BGE Small lokal) |

---

## Konfigurasi Vercel Cron Jobs

File `vercel.json` sudah dikonfigurasi dengan 4 cron job berikut (jadwal dalam UTC):

| Path | Jadwal (UTC) | Waktu WIB | Fungsi |
|---|---|---|---|
| `/api/cron/inspirasi` | `5 17 * * *` | 00:05 WIB | Pilih konten inspirasi harian secara acak |
| `/api/cron/news` | `0 23 * * *` | 06:00 WIB | Pipeline berita Indonesia Hari Ini |
| `/api/cron/market` | `5 23 * * *` | 06:05 WIB | Pipeline data pasar keuangan |
| `/api/cron/ai-news` | `10 23 * * *` | 06:10 WIB | Pipeline berita AI global |

> Vercel Cron hanya tersedia pada plan **Pro** ke atas.
> Vercel secara otomatis mengirim header `Authorization: Bearer <CRON_SECRET>` ke setiap cron endpoint.

---

## Langkah Deployment

1. Push kode ke repository GitHub/GitLab.
2. Import project di [Vercel Dashboard](https://vercel.com/new).
3. Set seluruh environment variables di atas pada tab **Environment Variables**.
4. Deploy — Vercel akan otomatis mendeteksi Next.js dan menggunakan konfigurasi yang benar.
5. Pastikan tabel Supabase sudah dibuat menggunakan migration SQL di folder `supabase/`.

---

## Verifikasi Setelah Deploy

- Akses `https://<your-domain>/api/health` untuk mengecek status koneksi database dan data terakhir diperbarui.
- Cron job pertama akan berjalan sesuai jadwal UTC yang dikonfigurasi di `vercel.json`.

---

## Database Schema

Jalankan SQL migration berikut di **Supabase SQL Editor** sebelum deployment pertama:

```bash
# File migration tersedia di:
supabase/migrations/
```

Atau jalankan langsung via Supabase CLI:

```bash
supabase db push
```
