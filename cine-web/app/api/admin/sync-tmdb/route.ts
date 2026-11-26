import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "../../../../../supabase/types/database";
import { createClient } from "@/lib/supabase/server";
import { syncTmdbToSupabase } from "@/lib/tmdb-sync-core.mjs";

/** Endpoint admin-only untuk menyinkronkan film Now Playing & Upcoming dari TMDb. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Hanya admin" }, { status: 403 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tmdbApiKey = process.env.TMDB_API_KEY;

  if (!supabaseUrl || !serviceKey || !tmdbApiKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY atau TMDB_API_KEY belum tersedia di server." },
      { status: 500 },
    );
  }

  const adminClient = createSupabaseAdmin<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await syncTmdbToSupabase({
      supabase: adminClient,
      tmdbApiKey,
      archiveSeed: true,
      seedShowtimes: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sinkronisasi TMDb gagal." },
      { status: 502 },
    );
  }
}
