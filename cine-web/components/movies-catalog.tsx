"use client";

import { useMemo, useState } from "react";
import type { Movie, Tables } from "@/../supabase/types/database";
import MovieCard from "@/components/movie-card";
import GlassTabs from "@/components/ui/glass-tabs";
import { FIGMA_ICONS } from "@/lib/assets";

type Genre = Tables<"genres">;

export default function MoviesCatalog({
  movies,
  genres,
  movieGenreIds,
  movieGenreLabel,
  initialStatus = "now_showing",
  initialQuery = "",
}: {
  movies: Movie[];
  genres: Genre[];
  movieGenreIds: Record<string, string[]>;
  movieGenreLabel: Record<string, string>;
  initialStatus?: "now_showing" | "coming_soon";
  initialQuery?: string;
}) {
  const [status, setStatus] = useState<"now_showing" | "coming_soon">(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const [genreId, setGenreId] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movies.filter((m) => {
      if (m.status !== status) return false;
      if (q && !m.title.toLowerCase().includes(q)) return false;
      if (genreId !== "all") {
        const gIds = movieGenreIds[m.id] ?? [];
        if (!gIds.includes(genreId)) return false;
      }
      return true;
    });
  }, [movies, status, query, genreId, movieGenreIds]);

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-[28px] font-bold leading-tight text-cine-ink sm:text-[36px]">Movie</h1>

        <div className="cine-search w-full sm:w-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FIGMA_ICONS.search} alt="" width={18} height={18} className="size-[18px] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari film"
            className="w-full bg-transparent text-sm text-cine-ink placeholder:text-cine-placeholder focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs + Filter Genre */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GlassTabs
          items={[
            { key: "now_showing", label: "Sedang Tayang" },
            { key: "coming_soon", label: "Segera" },
          ]}
          activeKey={status}
          onChange={(k) => setStatus(k as "now_showing" | "coming_soon")}
        />

        <select
          value={genreId}
          onChange={(e) => setGenreId(e.target.value)}
          aria-label="Filter genre"
          className="rounded-[10px] border border-cine-border bg-white px-3.5 py-2 text-[13px] font-medium text-cine-ink focus:border-cine-maroon focus:outline-none"
        >
          <option value="all">Semua Genre</option>
          {genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid Film 5 kolom (Figma 1:464) */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              genreLabel={movieGenreLabel[movie.id]}
              variant="grid"
            />
          ))}
        </div>
      ) : (
        <div className="cine-card p-10 text-center text-sm text-cine-muted">
          Tidak ada film yang sesuai filter saat ini.
        </div>
      )}
    </main>
  );
}
