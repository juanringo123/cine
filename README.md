# CINÉ — Go API

Go API tipis untuk CINÉ. Logic utama tetap di **Supabase** (Auth, PostgREST, Realtime, Storage) dan dipanggil langsung dari Next.js. Go hanya dipakai untuk hal yang butuh kredensial server / secret dan tidak boleh diekspos ke browser.

Stack sesuai project ini: `chi/v5` (router), `pgx/v5` (Postgres + RPC), `godotenv` (env), `go-qrcode` (QR PNG).

## Arsitektur

```
Next.js (browser + server)
 ├── Supabase Auth / PostgREST / Realtime / Storage   <- dipanggil langsung
 └── Go API (D:\cine-app)                             <- endpoint server-only
        └── pgx / Postgres (role postgres|service_role)
              └── RPC: confirm_payment, fail_payment,
                       find_user_by_phone, find_payment_by_external_id,
                       get_ticket_by_code, get_order_by_code, verify_ticket_qr
```

## Prasyarat database

Jalankan `supabase/migrations/0001`–`0007` berurutan. `0007_api_helpers.sql` berisi RPC khusus service role yang dipanggil API ini.

## Menjalankan

```powershell
copy .env.example .env
# isi DATABASE_URL dan WEBHOOK_SECRET
go run ./cmd/server
# atau: docker build -t cine-api . && docker run --env-file .env -p 8080:8080 cine-api
```

Cek: `GET http://localhost:8080/healthz` → `{"status":"ok"}`

> **Supabase pooler (PgBouncer transaction mode):** tambahkan `?pgbouncer=true` pada `DATABASE_URL`, atau gunakan connection string direct/session pooler.

## Endpoint

| Method | Path | RPC dipanggil |
|---|---|---|
| GET | `/healthz` | — |
| POST | `/webhooks/payment` | `confirm_payment` / `fail_payment` |
| POST | `/auth/whatsapp/lookup` | `find_user_by_phone` (rate limit 10/menit per IP) |
| GET | `/tickets/{code}/qr.png` | `get_ticket_by_code` |
| GET | `/orders/{code}/qr.png` | `get_order_by_code` |
| POST | `/tickets/verify` | `verify_ticket_qr` |

### Webhook pembayaran

Body:

```json
{
  "payment_id": "uuid-pembayaran",
  "status": "paid",
  "external_id": "PAY-XXXX",
  "reason": "opsional"
}
```

Header: `X-Signature: sha256=<hex HMAC-SHA256 atas raw body dengan WEBHOOK_SECRET>` (prefix boleh dihilangkan).

Jika gateway hanya mengirim `external_id`, API memanggil `find_payment_by_external_id` dulu. Status `settlement`/`capture` → `paid`; `deny`/`expire`/`cancel` → `failed`; selain itu diabaikan (200, `status: ignored`) agar gateway tidak retry terus.

Buat signature:

```powershell
$body = '{"payment_id":"...","status":"paid"}'
$hex  = (New-Object System.Security.Cryptography.HMACSHA256([Text.Encoding]::UTF8.GetBytes($env:WEBHOOK_SECRET))).ComputeHash([Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") }
$sig  = -join $hex
curl -X POST http://localhost:8080/webhooks/payment -H "Content-Type: application/json" -H "X-Signature: sha256=$sig" -d $body
```

### Lookup WhatsApp

```json
POST /auth/whatsapp/lookup
{ "phone": "08123456789" }
```

→ `{ "found": true, "user_id": "...", "email": "...", "full_name": "...", "nickname": "...", "phone": "628123456789" }`

### Verifikasi tiket

```json
POST /tickets/verify
{ "code": "CNE-ABC123", "token": "uuid-dari-qr" }
```

200 jika valid, 422 jika tidak. Token diverifikasi ulang dari database — kode saja tidak cukup.

## QR

Isi QR default: `CINE:TICKET:<KODE>:<TOKEN>` (atau `CINE:FNB:...`). Jika `TICKET_QR_BASE_URL` diisi, payload berupa URL `https://.../ticket/<kode>?t=<token>`.

## Keamanan

- `DATABASE_URL` memakai role postgres/service_role, **jangan** anon key.
- Semua RPC helper di `0007` di-revoke dari `public`, hanya granted ke `service_role`.
- Webhook diverifikasi HMAC dengan perbandingan constant-time.
- Lookup WhatsApp diberi rate limit untuk mengurangi risiko enumerasi nomor → email. Untuk multi-instance, pindahkan ke Redis/gateway.

## Gateway pembayaran (Midtrans Snap)

Alur: Next.js membuat `payments` pending lewat RPC `create_payment` ? server route `/api/payment/charge` memanggil Go API `POST /payments/charge` ? Go membuat transaksi Snap dengan **server key** ? user diarahkan ke `redirect_url` ? Midtrans mengirim webhook ke `POST /webhooks/payment` ? Go memanggil `confirm_payment`/`fail_payment` dengan service role.

### Menyiapkan Midtrans

1. Daftar & buat project di **https://dashboard.midtrans.com** (pakai **Sandbox** dulu).
2. Ambil **Server Key** dari *Settings ? Access Keys*.
3. Isi `D:\cine-app\.env`:
   ```
   PAYMENT_GATEWAY=midtrans
   MIDTRANS_SERVER_KEY=server-key-sandbox-anda
   MIDTRANS_IS_SANDBOX=true
   WEBHOOK_PROVIDER=midtrans
   INTERNAL_API_KEY=sama-dengan-di-cine-web
   ```
4. Isi `D:\cine-app\cine-web\.env.local`: `INTERNAL_API_KEY=` dengan nilai yang **sama persis**.
5. Di dashboard Midtrans, set **Notification URL** ke `https://<host-go-api>/webhooks/payment`.
   Untuk localhost, pakai tunnel (ngrok/cloudflared) agar Midtrans bisa menjangkau.

> Sebelum server key diisi, `POST /payments/charge` balas 502 dengan pesan `MIDTRANS_SERVER_KEY belum diisi`. Alur lain tetap normal.

### Mode generic (tanpa gateway)

`WEBHOOK_PROVIDER=generic` memakai `WEBHOOK_SECRET` dan HMAC-SHA256 atas raw body (format lama). Cocok untuk testing manual webhook sebelum ada akun gateway.

## Login via WhatsApp OTP

Alur: nomor → Go cari user (`find_user_by_phone`) → kode 6 digit, hash disimpan di tabel `whatsapp_otps` (migration `0008`) → dikirim via provider → user input kode → Go verifikasi → Supabase Auth `generateLink` menghasilkan `token_hash` → browser `verifyOtp({ token_hash, type: 'magiclink' })` untuk dapat sesi.

| `OTP_PROVIDER` | Kebutuhan | Catatan |
|---|---|---|
| `dev` | tidak ada | Kode muncul di response (`dev_code`) dan log server. Untuk testing. |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | Kirim via Twilio WhatsApp. |
| `meta` | `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID` | WhatsApp Cloud API (Meta). |

Wajib: `SUPABASE_SERVICE_ROLE_KEY` di `.env` Go untuk Auth Admin `generateLink`. Tanpa itu, verifikasi balas 502 dengan pesan jelas. Nomor harus terdaftar di `profiles.phone` / `auth.users.phone` (format `62...`).

Rate limit: 5 request OTP / 10 menit per IP, 10 verifikasi / 10 menit per IP. Untuk multi-instance, pindahkan ke Redis/gateway.

## Mode demo / tugas (tanpa gateway)

Untuk keperluan tugas tidak perlu akun Midtrans:
- Biarkan `MIDTRANS_SERVER_KEY=` kosong dan `WEBHOOK_PROVIDER=generic`.
- Di **Admin → Booking / Pesanan F&B**, klik **Tandai Lunas (simulasi)** — memanggil RPC `admin_mark_paid` (migration `0010`) yang meneruskan ke `confirm_payment`. Efeknya sama seperti webhook: status berubah, kursi jadi `booked`, notifikasi terkirim.
- Atau scan QR Dummy QRIS ke `/simulasi-bayar/{orderId}?t={token}`. Untuk mengaktifkannya, pastikan `NEXT_PUBLIC_DEMO_PAYMENT=true` di `cine-web/.env` / `.env.local` (atau Vercel). Token `?t=` (HMAC-SHA256 per-order) hanya diterbitkan kepada pemilik transaksi yang sudah login di `GET /api/simulasi-bayar/{orderId}` atau `/payment/{id}`. Akses langsung hanya bermodal `PAY-...` tanpa `?t=` ditolak halaman simulasi, `GET /api/simulasi-bayar/{orderId}` mewajibkan login & kepemilikan (`401`/`403`), dan `POST /api/simulasi-bayar/{orderId}` mewajibkan `NEXT_PUBLIC_DEMO_PAYMENT=true`, header `X-Simulasi-Token` (atau `X-Internal-Key`), serta status `pending` yang belum kedaluwarsa (`403`/`409`).
- Atau simulasikan webhook manual dengan `WEBHOOK_SECRET` (HMAC-SHA256 atas raw body, header `X-Signature: sha256=<hex>`).

Alur Snap Midtrans baru dipakai jika server key diisi.

## Deploy Vercel & Menghubungkan Go API

Saat `cine-web` dideploy ke Vercel, Route Handler Next.js tidak dapat mengakses `http://localhost:8080`.
- Jalankan Go API di server publik atau ekspos lokal via tunnel (`ngrok http 8080` / Cloudflare Tunnel / Railway).
- Set environment variable di Vercel:
  - `API_URL=https://<host-go-api-publik>` (prioritas utama server-side; atau `NEXT_PUBLIC_API_URL=https://<host-go-api-publik>`) agar `/api/auth/whatsapp/*` dan `/api/payment/charge` aktif.
  - `SUPABASE_SERVICE_ROLE_KEY` (wajib untuk halaman `/simulasi-bayar/[orderId]`, `/api/tickets/verify`, dll.).
  - `NEXT_PUBLIC_DEMO_PAYMENT=true` (hanya jika ingin mengizinkan demo QRIS di deployment tersebut) dan opsional `SIMULASI_PAYMENT_SECRET`.
