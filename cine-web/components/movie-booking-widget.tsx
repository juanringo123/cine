"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { FIGMA_ICONS } from "@/lib/assets";
import { getWeekendSurcharge, isWeekendDate } from "@/lib/pricing";
import { cn, formatRupiah } from "@/lib/utils";

export type MovieShowtimeOption = {
  id: string;
  show_date: string;
  start_time: string;
  end_time: string;
  price: number;
  format: string;
  studio_name: string;
  cinema_id: string;
  cinema_name: string;
};

function parseDateBadge(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const dayNum = String(d.getDate());
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  return { dayNum, weekday };
}

export default function MovieBookingWidget({
  showtimes,
}: {
  showtimes: MovieShowtimeOption[];
}) {
  const router = useRouter();

  const cinemas = useMemo(() => {
    const map = new Map<string, string>();
    showtimes.forEach((st) => map.set(st.cinema_id, st.cinema_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [showtimes]);

  const [selectedCinemaId, setSelectedCinemaId] = useState(cinemas[0]?.id ?? "");

  const dates = useMemo(() => {
    const set = new Set<string>();
    showtimes
      .filter((st) => !selectedCinemaId || st.cinema_id === selectedCinemaId)
      .forEach((st) => set.add(st.show_date));
    return Array.from(set).sort();
  }, [showtimes, selectedCinemaId]);

  const [selectedDate, setSelectedDate] = useState(dates[0] ?? "");
  const effectiveDate = dates.includes(selectedDate) ? selectedDate : (dates[0] ?? "");

  const slots = useMemo(
    () =>
      showtimes.filter(
        (st) =>
          (!selectedCinemaId || st.cinema_id === selectedCinemaId) &&
          (!effectiveDate || st.show_date === effectiveDate),
      ),
    [showtimes, selectedCinemaId, effectiveDate],
  );

  const [selectedShowtimeId, setSelectedShowtimeId] = useState(slots[0]?.id ?? "");
  const activeSlot = slots.find((s) => s.id === selectedShowtimeId) ?? slots[0];

  if (showtimes.length === 0) {
    return (
      <div className="cine-card p-6 text-sm text-cine-muted">
        Belum ada jadwal tayang tersedia untuk film ini.
      </div>
    );
  }

  return (
    <div className="cine-card flex flex-col gap-4 p-6">
      {/* Pemilih Cinema */}
      <div className="relative inline-flex w-fit items-center gap-2 rounded-xl border border-cine-border bg-white px-3.5 py-[9px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FIGMA_ICONS.clap} alt="" width={20} height={20} className="size-5 shrink-0" />
        <select
          value={selectedCinemaId}
          onChange={(e) => {
            setSelectedCinemaId(e.target.value);
            setSelectedDate("");
            setSelectedShowtimeId("");
          }}
          aria-label="Pilih cinema"
          className="cursor-pointer appearance-none bg-transparent pr-5 text-sm text-cine-ink focus:outline-none"
        >
          {cinemas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FIGMA_ICONS.chevron}
          alt=""
          width={16}
          height={16}
          className="pointer-events-none absolute right-3 size-4"
        />
      </div>

      {/* Pemilih Tanggal */}
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto scroll-smooth">
        {dates.map((d) => {
          const { dayNum, weekday } = parseDateBadge(d);
          const active = d === effectiveDate;
          const weekend = isWeekendDate(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setSelectedDate(d);
                setSelectedShowtimeId("");
              }}
              className={cn(
                "flex min-w-[64px] cursor-pointer flex-col items-center rounded-xl px-4 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:scale-[0.97]",
                active
                  ? "bg-cine-maroon text-white"
                  : weekend
                    ? "border border-cine-gold bg-white text-cine-ink hover:border-cine-maroon/60"
                    : "border border-cine-border bg-white text-cine-ink hover:border-cine-maroon/50",
              )}
            >
              <span className="text-sm font-bold">{dayNum}</span>
              <span className="text-[13px] font-normal">{weekday}</span>
              {weekend && (
                <span
                  className={cn(
                    "mt-0.5 text-[9px] font-bold uppercase tracking-wider",
                    active ? "text-cine-gold" : "text-cine-maroon",
                  )}
                >
                  WKD
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Format & Harga */}
      {activeSlot && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold uppercase text-cine-ink">
              {activeSlot.format.replace("_", " ")} · {formatRupiah(activeSlot.price)}
            </p>
            {isWeekendDate(activeSlot.show_date) && (
              <span className="rounded-full bg-cine-maroon/10 px-2.5 py-0.5 text-[11px] font-semibold text-cine-maroon">
                Tarif Weekend (+{formatRupiah(getWeekendSurcharge(activeSlot.format))})
              </span>
            )}
          </div>
          <p className="text-[11px] text-cine-muted">
            Tarif akhir pekan (Sabtu–Minggu) naik +Rp 15.000 (Premiere +Rp 20.000).
          </p>
        </div>
      )}

      {/* Jam Tayang */}
      <div className="flex flex-wrap gap-2.5">
        {slots.map((slot) => {
          const active = activeSlot?.id === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setSelectedShowtimeId(slot.id)}
              className={cn(
                "cursor-pointer rounded-[10px] px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:scale-[0.97]",
                active
                  ? "border border-cine-maroon bg-cine-maroon text-white"
                  : "border border-cine-border bg-white text-cine-ink hover:border-cine-maroon",
              )}
            >
              {slot.start_time.slice(0, 5)}
            </button>
          );
        })}
      </div>

      <Button
        variant="gold"
        className="w-full"
        disabled={!activeSlot}
        onClick={() => {
          if (activeSlot) router.push(`/showtimes/${activeSlot.id}`);
        }}
      >
        Book Now
      </Button>
    </div>
  );
}
