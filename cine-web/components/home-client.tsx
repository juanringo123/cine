"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Cinema, Movie, Promo } from "@/../supabase/types/database";
import MovieCard from "@/components/movie-card";
import { SectionHeading } from "@/components/ui/primitives";
import { FIGMA_ICONS, resolveCinemaImage } from "@/lib/assets";

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function HomeClient({
  firstName,
  todayLabel,
  nowShowing,
  comingSoon,
  promos,
  cinemas,
  movieGenreMap,
}: {
  firstName: string;
  todayLabel: string;
  nowShowing: Movie[];
  comingSoon: Movie[];
  promos: Promo[];
  cinemas: Cinema[];
  movieGenreMap: Record<string, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const filteredNow = useMemo(
    () =>
      needle
        ? nowShowing.filter((m) => m.title.toLowerCase().includes(needle))
        : nowShowing,
    [nowShowing, needle],
  );

  const filteredSoon = useMemo(
    () =>
      needle
        ? comingSoon.filter((m) => m.title.toLowerCase().includes(needle))
        : comingSoon,
    [comingSoon, needle],
  );

  const filteredCinemas = useMemo(
    () =>
      needle
        ? cinemas.filter(
            (c) =>
              c.name.toLowerCase().includes(needle) ||
              c.city.toLowerCase().includes(needle),
          )
        : cinemas,
    [cinemas, needle],
  );

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/movies?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <main className="cine-container flex flex-col gap-8 pb-20 pt-8">
      {/* Greeting + Search Bar */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold leading-tight text-cine-ink sm:text-[32px]">
            Hello, {firstName}
          </h1>
          <p className="text-[15px] text-cine-muted">
            Kamu mau nonton apa hari ini? · {todayLabel}
          </p>
        </div>

        <form onSubmit={onSearchSubmit} className="cine-search w-full md:w-[440px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FIGMA_ICONS.search} alt="" width={18} height={18} className="size-[18px] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari film atau bioskop"
            className="w-full bg-transparent text-sm text-cine-ink placeholder:text-cine-placeholder focus:outline-none"
          />
        </form>
      </section>

      {/* Sedang Tayang */}
      <section className="flex flex-col gap-4">
        <SectionHeading title="Sedang Tayang" href="/movies?status=now_showing" />
        {filteredNow.length > 0 ? (
          <div className="no-scrollbar flex gap-5 overflow-x-auto scroll-smooth pb-2">
            {filteredNow.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                genreLabel={movieGenreMap[movie.id]}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-cine-muted">Tidak ada film sedang tayang yang cocok.</p>
        )}
      </section>

      {/* Segera */}
      <section className="flex flex-col gap-4">
        <SectionHeading title="Segera" href="/movies?status=coming_soon" />
        {filteredSoon.length > 0 ? (
          <div className="no-scrollbar flex gap-5 overflow-x-auto scroll-smooth pb-2">
            {filteredSoon.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                genreLabel={movieGenreMap[movie.id]}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-cine-muted">Belum ada film akan tayang yang cocok.</p>
        )}
      </section>

      {/* Promo */}
      <section id="promo" className="flex flex-col gap-4">
        <SectionHeading title="Promo" />
        {promos.length > 0 ? (
          <div className="no-scrollbar flex gap-5 overflow-x-auto scroll-smooth pb-2">
            {promos.map((promo) => (
              <div
                key={promo.id}
                className="cine-card-hover flex min-w-[270px] max-w-[85vw] shrink-0 items-center gap-4 rounded-[20px] bg-cine-cream p-3 sm:min-w-[380px] sm:max-w-none lg:min-w-[430px]"
              >
                <div className="relative size-[88px] shrink-0 overflow-hidden rounded-[14px] bg-white">
                  <Image
                    src={FIGMA_ICONS.promoTicket}
                    alt={promo.code}
                    fill
                    sizes="88px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-base font-bold text-cine-ink">
                    {promo.description || promo.code}
                  </p>
                  <p className="text-xs font-semibold text-cine-maroon">
                    Kode: {promo.code}
                  </p>
                  <p className="text-xs text-cine-muted">
                    Berlaku hingga {formatShortDate(promo.valid_from)} - {formatShortDate(promo.valid_until)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cine-muted">Belum ada promo aktif.</p>
        )}
      </section>

      {/* Bioskop */}
      <section className="flex flex-col gap-4">
        <SectionHeading title="Bioskop" href="/cinema" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCinemas.map((cinema) => (
            <Link
              key={cinema.id}
              href={`/cinemas/${cinema.slug}`}
              className="cine-card-hover group flex items-center gap-4 rounded-[20px] bg-cine-cream p-4 hover:bg-cine-border/35"
            >
              <div className="relative size-[76px] shrink-0 overflow-hidden rounded-[14px] bg-white">
                <Image
                  src={resolveCinemaImage(cinema.image_url, cinema.slug)}
                  alt={cinema.name}
                  fill
                  sizes="76px"
                  className="cine-img-zoom object-cover group-hover:scale-105"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-base font-bold text-cine-ink transition-colors duration-200 group-hover:text-cine-maroon">
                  {cinema.name}
                </p>
                <p className="truncate text-xs text-cine-muted">{cinema.address ?? cinema.city}</p>
                <p className="truncate text-[11px] text-cine-muted">
                  {cinema.facilities.slice(0, 3).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
