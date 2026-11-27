const LOCAL_API_URL_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

export type GoApiUrlResolution =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Menentukan base URL Go API dari env server (`API_URL`) atau publik (`NEXT_PUBLIC_API_URL`).
 * Memberikan pesan konfigurasi yang jelas bila belum diset atau masih menunjuk localhost di Vercel.
 */
export function resolveGoApiUrl(serviceName: string): GoApiUrlResolution {
  const raw = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!raw) {
    return {
      ok: false,
      error: `${serviceName} belum dikonfigurasi. Atur environment variable API_URL atau NEXT_PUBLIC_API_URL ke URL Go API publik (mis. domain/ngrok/Railway).`,
    };
  }

  if (process.env.VERCEL && LOCAL_API_URL_RE.test(raw)) {
    return {
      ok: false,
      error: `${serviceName} tidak dapat menghubungi Go API lokal (${raw}) dari Vercel. Atur API_URL (atau NEXT_PUBLIC_API_URL) ke URL publik Go API (mis. ngrok/domain), lalu redeploy.`,
    };
  }

  return { ok: true, url: raw };
}
