"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Movie, Studio, Showtime } from "@/../supabase/types/database";
import Button from "@/components/ui/button";
import { getDefaultShowtimePrice, getWeekendSurcharge, isWeekendDate } from "@/lib/pricing";
import { formatRupiah } from "@/lib/utils";

type ShowtimeRow = Pick<Showtime, "id" | "show_date" | "start_time" | "end_time" | "price" | "format"> & {
  movie_title: string;
  studio_name: string;
};

function computeEndTime(time: string, minutes: number): { value: string; overflows: boolean } {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) {
    return { value: "23:59 (melewati tengah malam)", overflows: true };
  }
  return {
    value: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
    overflows: false,
  };
}

export default function ShowtimeManager({
  movies,
  studios,
  showtimes,
}: {
  movies: Pick<Movie, "id" | "title" | "duration_minutes">[];
  studios: Pick<Studio, "id" | "name" | "screen_type">[];
  showtimes: ShowtimeRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const initialDate = new Date().toISOString().slice(0, 10);
  const [movieId, setMovieId] = useState(movies[0]?.id ?? "");
  const [studioId, setStudioId] = useState(studios[0]?.id ?? "");
  const [showDate, setShowDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("10:00");
  const [price, setPrice] = useState(() =>
    String(getDefaultShowtimePrice(studios[0]?.screen_type ?? "regular_2d", initialDate)),
  );
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const movie = movies.find((m) => m.id === movieId);
  const studio = studios.find((s) => s.id === studioId);
  const recommendedPrice = getDefaultShowtimePrice(
    studio?.screen_type ?? "regular_2d",
    showDate,
  );
  const weekendSelected = isWeekendDate(showDate);
  const surchargeAmount = getWeekendSurcharge(studio?.screen_type ?? "regular_2d");
  const endCalc = movie
    ? computeEndTime(startTime, movie.duration_minutes)
    : { value: startTime, overflows: false };
  const endTime = endCalc.value;

  function handleStudioChange(nextStudioId: string) {
    setStudioId(nextStudioId);
    if (!priceManuallyEdited) {
      const nextStudio = studios.find((s) => s.id === nextStudioId);
      setPrice(
        String(getDefaultShowtimePrice(nextStudio?.screen_type ?? "regular_2d", showDate)),
      );
    }
  }

  function handleDateChange(nextDate: string) {
    setShowDate(nextDate);
    if (!priceManuallyEdited) {
      setPrice(
        String(getDefaultShowtimePrice(studio?.screen_type ?? "regular_2d", nextDate)),
      );
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (endCalc.overflows) {
      setError("Jadwal melewati pukul 23:59, pilih jam mulai lebih awal.");
      return;
    }
    const { error } = await supabase.from("showtimes").insert({
      movie_id: movieId,
      studio_id: studioId,
      show_date: showDate,
      start_time: startTime,
      end_time: endTime,
      price: Number(price),
      format: (studio?.screen_type ?? "regular_2d") as Enums<"showtime_format">,
      language: "IDN",
    });
    if (error) setError(error.message);
    else router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus jadwal ini? Kursi terkait ikut terhapus.")) return;
    const { error } = await supabase.from("showtimes").delete().eq("id", id);
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="cine-card grid gap-3 p-5 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="cine-label">Film</span>
          <select className="cine-input" value={movieId} onChange={(e) => setMovieId(e.target.value)}>
            {movies.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.duration_minutes} mnt)</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="cine-label">Studio</span>
          <select className="cine-input" value={studioId} onChange={(e) => handleStudioChange(e.target.value)}>
            {studios.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.screen_type}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="cine-label">Tanggal</span>
          <input type="date" className="cine-input" value={showDate} onChange={(e) => handleDateChange(e.target.value)} required />
        </label>
        <label className="space-y-1">
          <span className="cine-label">Jam mulai</span>
          <input type="time" className="cine-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </label>
        <label className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="cine-label">Harga</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                weekendSelected
                  ? "bg-cine-maroon/10 text-cine-maroon"
                  : "bg-white text-cine-muted"
              }`}
            >
              {weekendSelected
                ? `Tarif Weekend (+${formatRupiah(surchargeAmount)})`
                : "Tarif Weekday"}
            </span>
          </div>
          <input
            type="number"
            min={0}
            className="cine-input"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setPriceManuallyEdited(true);
            }}
            required
          />
          {priceManuallyEdited && Number(price) !== recommendedPrice && (
            <button
              type="button"
              onClick={() => {
                setPrice(String(recommendedPrice));
                setPriceManuallyEdited(false);
              }}
              className="cursor-pointer text-[11px] font-semibold text-cine-maroon hover:underline"
            >
              Gunakan tarif standar ({formatRupiah(recommendedPrice)})
            </button>
          )}
        </label>
        <div className="flex items-end gap-2">
          <span className="text-xs text-cine-muted">Selesai otomatis: {endTime}</span>
        </div>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2"><Button type="submit">Tambah Jadwal</Button></div>
      </form>

      <div className="space-y-2">
        {showtimes.map((st) => (
          <div key={st.id} className="cine-card flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="min-w-40 flex-1 font-semibold">{st.movie_title}</span>
            <span className="text-cine-muted">{st.studio_name}</span>
            <span>{st.show_date} {st.start_time}–{st.end_time}</span>
            {isWeekendDate(st.show_date) && (
              <span className="rounded-full bg-cine-maroon/10 px-2 py-0.5 text-[11px] font-semibold text-cine-maroon">
                Weekend
              </span>
            )}
            <span className="font-semibold text-cine-maroon">{formatRupiah(st.price)}</span>
            <button type="button" onClick={() => remove(st.id)} className="text-xs text-red-700 underline">hapus</button>
          </div>
        ))}
        {!showtimes.length && <p className="text-sm text-cine-muted">Belum ada jadwal.</p>}
      </div>
    </div>
  );
}
