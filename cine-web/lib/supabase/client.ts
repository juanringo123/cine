import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../../../supabase/types/database";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Saat pre-render/build, env bisa kosong. Pakai placeholder agar Client
  // Component tidak melempar; di browser nilai aslinya tetap dipakai.
  return createBrowserClient<Database>(
    url || "http://localhost:54321",
    key || "placeholder-anon-key",
  );
}
