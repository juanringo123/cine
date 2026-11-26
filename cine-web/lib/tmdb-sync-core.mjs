const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

const CANDIDATE_SLOTS = [
  "10:15",
  "13:15",
  "16:15",
  "19:15",
  "21:30",
  "09:00",
  "11:15",
  "13:30",
  "15:45",
  "18:00",
  "20:15",
  "11:00",
  "14:00",
  "17:00",
  "20:00",
  "12:00",
  "15:00",
  "18:30",
  "21:00",
];

function slugify(value) {
  const base = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "movie";
}

function mapAgeRating(releaseDates) {
  const results = Array.isArray(releaseDates?.results) ? releaseDates.results : [];
  const preferredCountries = ["ID", "US"];

  for (const iso of preferredCountries) {
    const entry = results.find((r) => r.iso_3166_1 === iso);
    if (!entry || !Array.isArray(entry.release_dates)) continue;
    const certObj = entry.release_dates.find(
      (d) => typeof d.certification === "string" && d.certification.trim() !== "",
    );
    if (!certObj) continue;

    const raw = certObj.certification.trim().toUpperCase();
    if (["SU", "G", "PG", "ALL", "0+", "7+"].includes(raw)) return "SU";
    if (["13+", "R13", "PG-13", "12", "12+", "13"].includes(raw)) return "13+";
    if (["17+", "D17", "R", "16", "16+", "17", "18", "18+"].includes(raw)) return "17+";
    if (["21+", "D21", "NC-17", "21"].includes(raw)) return "21+";
  }
  return null;
}

function pickYouTubeTrailer(videos) {
  const list = Array.isArray(videos?.results) ? videos.results : [];
  const yt = list.filter((v) => v.site === "YouTube" && typeof v.key === "string" && v.key);
  if (yt.length === 0) return null;

  const picked =
    yt.find((v) => v.official && v.type === "Trailer") ||
    yt.find((v) => v.type === "Trailer") ||
    yt.find((v) => v.type === "Teaser") ||
    yt[0];

  return picked ? `https://www.youtube.com/watch?v=${picked.key}` : null;
}

async function tmdbFetch(path, params, apiKey) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  const isBearer = apiKey.startsWith("eyJ");
  if (!isBearer) {
    url.searchParams.set("api_key", apiKey);
  }

  const headers = { Accept: "application/json" };
  if (isBearer) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDb ${path} gagal (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function toTimeString(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function getJakartaTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function addDaysISO(baseIso, offsetDays) {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function priceFor(screenType, dateIso) {
  const dow = new Date(`${dateIso}T00:00:00Z`).getUTCDay(); // 0=Minggu, 6=Sabtu
  const isWeekend = dow === 0 || dow === 6;
  switch (screenType) {
    case "3d":
      return isWeekend ? 65000 : 50000;
    case "imax":
      return isWeekend ? 90000 : 75000;
    case "premiere":
      return isWeekend ? 115000 : 95000;
    case "regular_2d":
    default:
      return isWeekend ? 55000 : 40000;
  }
}

export async function syncTmdbToSupabase({
  supabase,
  tmdbApiKey,
  nowPlayingLimit = 15,
  upcomingLimit = 10,
  indoNowLimit = 10,
  indoUpcomingLimit = 6,
  archiveSeed = true,
  seedShowtimes = true,
}) {
  if (!tmdbApiKey) throw new Error("TMDB_API_KEY belum diisi.");

  const today = getJakartaTodayISO();
  const indoNowFrom = addDaysISO(today, -90);
  const indoUpFrom = addDaysISO(today, 1);
  const indoUpTo = addDaysISO(today, 210);

  const [nowRes, upRes, indoNowRes, indoUpRes] = await Promise.all([
    tmdbFetch("/movie/now_playing", { region: "ID", language: "id-ID", page: 1 }, tmdbApiKey),
    tmdbFetch("/movie/upcoming", { region: "ID", language: "id-ID", page: 1 }, tmdbApiKey),
    tmdbFetch(
      "/discover/movie",
      {
        with_original_language: "id",
        language: "id-ID",
        sort_by: "popularity.desc",
        "primary_release_date.gte": indoNowFrom,
        "primary_release_date.lte": today,
        page: 1,
      },
      tmdbApiKey,
    ),
    tmdbFetch(
      "/discover/movie",
      {
        with_original_language: "id",
        language: "id-ID",
        sort_by: "popularity.desc",
        "primary_release_date.gte": indoUpFrom,
        "primary_release_date.lte": indoUpTo,
        page: 1,
      },
      tmdbApiKey,
    ),
  ]);

  const seenIds = new Set();
  const queue = [];

  for (const item of (indoNowRes.results || []).filter((m) => m?.poster_path).slice(0, indoNowLimit)) {
    if (!item?.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    queue.push({ id: item.id, status: "now_showing" });
  }

  for (const item of (nowRes.results || []).slice(0, nowPlayingLimit)) {
    if (!item?.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    queue.push({ id: item.id, status: "now_showing" });
  }

  let indoUpAdded = 0;
  for (const item of (indoUpRes.results || []).filter((m) => m?.poster_path)) {
    if (indoUpAdded >= indoUpcomingLimit) break;
    if (!item?.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    queue.push({ id: item.id, status: "coming_soon" });
    indoUpAdded += 1;
  }

  let intlUpAdded = 0;
  for (const item of upRes.results || []) {
    if (intlUpAdded >= upcomingLimit) break;
    if (!item?.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    queue.push({ id: item.id, status: "coming_soon" });
    intlUpAdded += 1;
  }

  const detailedMovies = [];
  const genreMap = new Map();

  for (const entry of queue) {
    const detail = await tmdbFetch(
      `/movie/${entry.id}`,
      { language: "id-ID", append_to_response: "videos,credits,release_dates" },
      tmdbApiKey,
    );

    let overview = typeof detail.overview === "string" ? detail.overview.trim() : "";
    let trailerUrl = pickYouTubeTrailer(detail.videos);

    if (!overview || !trailerUrl) {
      const enDetail = await tmdbFetch(
        `/movie/${entry.id}`,
        { language: "en-US", append_to_response: "videos" },
        tmdbApiKey,
      ).catch(() => null);

      if (enDetail) {
        if (!overview && typeof enDetail.overview === "string") {
          overview = enDetail.overview.trim();
        }
        if (!trailerUrl) {
          trailerUrl = pickYouTubeTrailer(enDetail.videos);
        }
      }
    }

    const title = (detail.title || detail.original_title || `Movie ${entry.id}`).trim();
    const durationMinutes =
      typeof detail.runtime === "number" && detail.runtime > 0
        ? Math.min(detail.runtime, 240)
        : 110;
    const rating =
      typeof detail.vote_average === "number" && detail.vote_average > 0
        ? Math.min(10, Math.round(detail.vote_average * 10) / 10)
        : null;

    const genres = Array.isArray(detail.genres)
      ? detail.genres
          .filter((g) => g?.name)
          .map((g) => {
            const gSlug = slugify(g.name);
            genreMap.set(gSlug, { name: g.name.trim(), slug: gSlug });
            return gSlug;
          })
      : [];

    const director =
      Array.isArray(detail.credits?.crew)
        ? detail.credits.crew.find((c) => c.job === "Director")?.name ?? null
        : null;

    const cast = Array.isArray(detail.credits?.cast)
      ? detail.credits.cast.slice(0, 10).map((c, idx) => ({
          name: c.name,
          character_name: c.character ? String(c.character).slice(0, 120) : null,
          photo_url: c.profile_path ? `${TMDB_IMG_BASE}/w185${c.profile_path}` : null,
          sort_order: idx + 1,
        }))
      : [];

    detailedMovies.push({
      row: {
        tmdb_id: detail.id,
        slug: `${slugify(title)}-${detail.id}`,
        title,
        synopsis: overview || null,
        duration_minutes: durationMinutes,
        release_date: detail.release_date || null,
        age_rating: mapAgeRating(detail.release_dates),
        country: detail.production_countries?.[0]?.name ?? null,
        director,
        status: entry.status,
        poster_url: detail.poster_path ? `${TMDB_IMG_BASE}/w500${detail.poster_path}` : null,
        backdrop_url: detail.backdrop_path
          ? `${TMDB_IMG_BASE}/w1280${detail.backdrop_path}`
          : null,
        trailer_url: trailerUrl,
        rating,
      },
      genreSlugs: genres,
      cast,
    });
  }

  if (detailedMovies.length === 0) {
    throw new Error("TMDb tidak mengembalikan film apa pun.");
  }

  // 1. Upsert movies berdasarkan tmdb_id
  const { data: upsertedMovies, error: movieErr } = await supabase
    .from("movies")
    .upsert(
      detailedMovies.map((m) => m.row),
      { onConflict: "tmdb_id" },
    )
    .select("id, tmdb_id, slug, status, duration_minutes");

  if (movieErr) {
    throw new Error(`Upsert movies gagal: ${movieErr.message}`);
  }

  const movieIdByTmdb = new Map((upsertedMovies || []).map((m) => [m.tmdb_id, m.id]));

  // 2. Upsert genres & sinkronkan movie_genres + movie_cast
  if (genreMap.size > 0) {
    const { error: genreErr } = await supabase
      .from("genres")
      .upsert(Array.from(genreMap.values()), { onConflict: "slug" });
    if (genreErr) throw new Error(`Upsert genres gagal: ${genreErr.message}`);
  }

  const { data: allGenres, error: fetchGenreErr } = await supabase
    .from("genres")
    .select("id, slug");
  if (fetchGenreErr) throw new Error(`Baca genres gagal: ${fetchGenreErr.message}`);
  const genreIdBySlug = new Map((allGenres || []).map((g) => [g.slug, g.id]));

  let castInserted = 0;
  for (const item of detailedMovies) {
    const movieId = movieIdByTmdb.get(item.row.tmdb_id);
    if (!movieId) continue;

    // Sinkronkan movie_genres
    await supabase.from("movie_genres").delete().eq("movie_id", movieId);
    const mgRows = Array.from(new Set(item.genreSlugs))
      .map((s) => genreIdBySlug.get(s))
      .filter(Boolean)
      .map((genreId) => ({ movie_id: movieId, genre_id: genreId }));
    if (mgRows.length > 0) {
      const { error: mgErr } = await supabase.from("movie_genres").insert(mgRows);
      if (mgErr) throw new Error(`Insert movie_genres gagal: ${mgErr.message}`);
    }

    // Sinkronkan movie_cast
    await supabase.from("movie_cast").delete().eq("movie_id", movieId);
    if (item.cast.length > 0) {
      const { error: castErr } = await supabase
        .from("movie_cast")
        .insert(item.cast.map((c) => ({ ...c, movie_id: movieId })));
      if (castErr) throw new Error(`Insert movie_cast gagal: ${castErr.message}`);
      castInserted += item.cast.length;
    }
  }

  // 3. Arsipkan film seed lama (tmdb_id IS NULL) & nonaktifkan jadwal arsip tanpa booking
  let archivedSeedCount = 0;
  if (archiveSeed) {
    const { data: archived, error: archiveErr } = await supabase
      .from("movies")
      .update({ status: "archived" })
      .is("tmdb_id", null)
      .in("status", ["now_showing", "coming_soon"])
      .select("id");
    if (archiveErr) throw new Error(`Arsipkan seed gagal: ${archiveErr.message}`);
    archivedSeedCount = archived?.length ?? 0;

    const { data: seedMovies, error: seedMoviesErr } = await supabase
      .from("movies")
      .select("id")
      .is("tmdb_id", null)
      .eq("status", "archived");
    if (seedMoviesErr) throw new Error(`Baca film arsip gagal: ${seedMoviesErr.message}`);

    const seedIds = (seedMovies || []).map((m) => m.id);
    if (seedIds.length > 0) {
      const { data: archivedShowtimes, error: archStErr } = await supabase
        .from("showtimes")
        .select("id")
        .in("movie_id", seedIds)
        .eq("is_active", true)
        .gte("show_date", today);
      if (archStErr) throw new Error(`Baca jadwal arsip gagal: ${archStErr.message}`);

      const archStIds = (archivedShowtimes || []).map((s) => s.id);
      if (archStIds.length > 0) {
        const { data: bookedRows, error: bookedErr } = await supabase
          .from("bookings")
          .select("showtime_id")
          .in("showtime_id", archStIds);
        if (bookedErr) throw new Error(`Cek booking jadwal arsip gagal: ${bookedErr.message}`);

        const bookedSet = new Set((bookedRows || []).map((b) => b.showtime_id));
        const safeDeactivateIds = archStIds.filter((id) => !bookedSet.has(id));
        if (safeDeactivateIds.length > 0) {
          const { error: deactErr } = await supabase
            .from("showtimes")
            .update({ is_active: false })
            .in("id", safeDeactivateIds);
          if (deactErr) throw new Error(`Nonaktifkan jadwal arsip gagal: ${deactErr.message}`);
        }
      }
    }
  }

  // 4. Seed jadwal tayang awal untuk seluruh film now_showing TMDb yang belum punya jadwal aktif
  let showtimesAdded = 0;
  if (seedShowtimes) {
    const [
      { data: studios, error: studioErr },
      { data: existingShowtimes, error: stErr },
      { data: tmdbNowShowing, error: tmdbNowErr },
    ] = await Promise.all([
      supabase
        .from("studios")
        .select("id, screen_type, total_seats")
        .eq("is_active", true)
        .gt("total_seats", 0)
        .order("id"),
      supabase
        .from("showtimes")
        .select("movie_id, studio_id, show_date, start_time, end_time")
        .eq("is_active", true)
        .gte("show_date", today),
      supabase
        .from("movies")
        .select("id, duration_minutes")
        .not("tmdb_id", "is", null)
        .eq("status", "now_showing"),
    ]);

    if (studioErr) throw new Error(`Baca studios gagal: ${studioErr.message}`);
    if (stErr) throw new Error(`Baca showtimes gagal: ${stErr.message}`);
    if (tmdbNowErr) throw new Error(`Baca film now_showing gagal: ${tmdbNowErr.message}`);

    if (studios && studios.length > 0) {
      const moviesWithShowtimes = new Set((existingShowtimes || []).map((s) => s.movie_id));
      const busyByStudioDate = new Map();

      for (const s of existingShowtimes || []) {
        const key = `${s.studio_id}|${s.show_date}`;
        const list = busyByStudioDate.get(key) || [];
        list.push({
          start: toMinutes(s.start_time),
          end: toMinutes(s.end_time),
          startStr: s.start_time.slice(0, 5),
        });
        busyByStudioDate.set(key, list);
      }

      const nowShowingMovies = (tmdbNowShowing || []).filter(
        (m) => !moviesWithShowtimes.has(m.id),
      );

      const newShowtimes = [];
      let studioCursor = 0;

      for (const movie of nowShowingMovies) {
        for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
          const showDate = addDaysISO(today, dayOffset);
          let scheduledForDay = 0;
          for (let sIdx = 0; sIdx < studios.length && scheduledForDay < 2; sIdx += 1) {
            const studio = studios[(studioCursor + sIdx) % studios.length];
            const key = `${studio.id}|${showDate}`;
            const intervals = busyByStudioDate.get(key) || [];

            for (const slot of CANDIDATE_SLOTS) {
              const startMin = toMinutes(slot);
              const endMin = startMin + movie.duration_minutes;
              if (endMin > 23 * 60 + 55) continue;

              const conflicts = intervals.some(
                (iv) =>
                  iv.startStr === slot ||
                  (startMin < iv.end + 15 && endMin + 15 > iv.start),
              );
              if (conflicts) continue;

              intervals.push({ start: startMin, end: endMin, startStr: slot });
              busyByStudioDate.set(key, intervals);

              newShowtimes.push({
                movie_id: movie.id,
                studio_id: studio.id,
                show_date: showDate,
                start_time: `${slot}:00`,
                end_time: toTimeString(endMin),
                price: priceFor(studio.screen_type, showDate),
                format: studio.screen_type,
                language: "IDN",
                is_active: true,
              });
              scheduledForDay += 1;
              break;
            }
          }
        }
        studioCursor += 1;
      }

      if (newShowtimes.length > 0) {
        const { data: insertedSt, error: insertStErr } = await supabase
          .from("showtimes")
          .upsert(newShowtimes, {
            onConflict: "studio_id,show_date,start_time",
            ignoreDuplicates: true,
          })
          .select("id");
        if (insertStErr) throw new Error(`Insert showtimes gagal: ${insertStErr.message}`);
        showtimesAdded = insertedSt?.length ?? 0;
      }
    }
  }

  return {
    totalSynced: upsertedMovies?.length ?? 0,
    nowShowing: detailedMovies.filter((m) => m.row.status === "now_showing").length,
    comingSoon: detailedMovies.filter((m) => m.row.status === "coming_soon").length,
    withTrailer: detailedMovies.filter((m) => Boolean(m.row.trailer_url)).length,
    castSynced: castInserted,
    archivedSeedCount,
    showtimesAdded,
  };
}
