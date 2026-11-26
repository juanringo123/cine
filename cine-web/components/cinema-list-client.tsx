"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Cinema } from "@/../supabase/types/database";
import GlassTabs from "@/components/ui/glass-tabs";
import { FIGMA_ICONS, resolveCinemaImage } from "@/lib/assets";

export default function CinemaListClient({ cinemas }: { cinemas: Cinema[] }) {
  const [query, setQuery] = useState("");
  const cities = useMemo(
    () => ["Semua", ...Array.from(new Set(cinemas.map((c) => c.city)))],
    [cinemas],
  );
  const [selectedCity, setSelectedCity] = useState("Semua");

  useEffect(() => {
    const applyCity = (val: string | null) => {
      if (!val || val === "Semua") {
        setSelectedCity("Semua");
        return;
      }
      setSelectedCity(cities.includes(val) ? val : "Semua");
    };

    applyCity(window.localStorage.getItem("cine_city"));

    const onCityChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail ?? null;
      applyCity(next);
    };
    window.addEventListener("cine:city-change", onCityChange);
    return () => window.removeEventListener("cine:city-change", onCityChange);
  }, [cities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cinemas.filter((c) => {
      if (selectedCity !== "Semua" && c.city !== selectedCity) return false;
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !(c.address ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [cinemas, query, selectedCity]);

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <h1 className="text-[28px] font-bold leading-tight text-cine-ink sm:text-[36px]">Cinema</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="cine-search w-full sm:w-[366px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FIGMA_ICONS.search} alt="" width={18} height={18} className="size-[18px] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari bioskop"
            className="w-full bg-transparent text-sm text-cine-ink placeholder:text-cine-placeholder focus:outline-none"
          />
        </div>

        <GlassTabs
          scrollable
          items={cities.map((c) => ({ key: c, label: c }))}
          activeKey={selectedCity}
          onChange={setSelectedCity}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {filtered.map((cinema) => (
          <div
            key={cinema.id}
            className="cine-card-hover group flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-cine-cream p-4 sm:flex-nowrap"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative size-[76px] shrink-0 overflow-hidden rounded-[14px] bg-white sm:size-[98px]">
                <Image
                  src={resolveCinemaImage(cinema.image_url, cinema.slug)}
                  alt={cinema.name}
                  fill
                  sizes="(max-width: 640px) 76px, 98px"
                  className="cine-img-zoom object-cover group-hover:scale-105"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="truncate text-lg font-bold text-cine-ink transition-colors duration-200 group-hover:text-cine-maroon">
                  {cinema.name}
                </h2>
                <p className="truncate text-[13px] text-cine-muted">
                  {cinema.address ?? cinema.city}
                </p>
                <p className="truncate text-xs text-cine-muted">
                  {cinema.facilities.length > 0
                    ? cinema.facilities.join(" · ")
                    : "Reguler · Premiere"}
                </p>
              </div>
            </div>

            <Link
              href={`/cinemas/${cinema.slug}`}
              className="w-full shrink-0 rounded-xl bg-cine-gold px-5 py-2.5 text-center text-sm font-bold text-cine-ink transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-cine-gold-dark hover:shadow-sm active:scale-[0.98] sm:w-auto"
            >
              Lihat Jadwal
            </Link>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-cine-muted">Tidak ada bioskop ditemukan.</p>
        )}
      </div>
    </main>
  );
}
