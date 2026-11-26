import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types/database";

export type TmdbSyncResult = {
  totalSynced: number;
  nowShowing: number;
  comingSoon: number;
  withTrailer: number;
  castSynced: number;
  archivedSeedCount: number;
  showtimesAdded: number;
};

export function syncTmdbToSupabase(params: {
  supabase: SupabaseClient<Database>;
  tmdbApiKey: string;
  nowPlayingLimit?: number;
  upcomingLimit?: number;
  indoNowLimit?: number;
  indoUpcomingLimit?: number;
  archiveSeed?: boolean;
  seedShowtimes?: boolean;
}): Promise<TmdbSyncResult>;
