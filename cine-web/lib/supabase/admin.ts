import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/database";

let cachedRootServiceKey: string | null = null;

function readRootServiceKey(): string {
  if (cachedRootServiceKey !== null) return cachedRootServiceKey;
  if (process.env.VERCEL) {
    cachedRootServiceKey = "";
    return "";
  }
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(/*turbopackIgnore: true*/ file)) continue;
      const lines = fs
        .readFileSync(/*turbopackIgnore: true*/ file, "utf8")
        .split(/\r?\n/);
      for (const line of lines) {
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const idx = line.indexOf("=");
        const k = line.slice(0, idx).trim();
        if (k === "SUPABASE_SERVICE_ROLE_KEY") {
          cachedRootServiceKey = line.slice(idx + 1).trim();
          return cachedRootServiceKey;
        }
      }
    } catch {
      // Abaikan error baca file dan lanjut ke kandidat berikutnya
    }
  }
  cachedRootServiceKey = "";
  return "";
}

/** Supabase service-role client khusus server route & halaman simulasi QRIS. */
export function createAdminClient() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || readRootServiceKey();

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
