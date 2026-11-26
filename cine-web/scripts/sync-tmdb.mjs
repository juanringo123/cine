import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { syncTmdbToSupabase } from "../lib/tmdb-sync-core.mjs";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key] && val !== "") {
      process.env[key] = val;
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cineWebRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(cineWebRoot, "..");

loadEnvFile(path.join(cineWebRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

const args = new Set(process.argv.slice(2));
const archiveSeed = !args.has("--keep-seed");
const seedShowtimes = !args.has("--no-showtimes");

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tmdbApiKey = process.env.TMDB_API_KEY;

if (!supabaseUrl || !serviceKey || !tmdbApiKey) {
  console.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const result = await syncTmdbToSupabase({
    supabase,
    tmdbApiKey,
    archiveSeed,
    seedShowtimes,
  });
  console.log("TMDb sync selesai:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("TMDb sync gagal:", err instanceof Error ? err.message : err);
  process.exit(1);
}
