"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SeatMapRow } from "@/../supabase/types/database";
import { isWeekendDate } from "@/lib/pricing";
import { cn, formatRupiah } from "@/lib/utils";
import Button from "@/components/ui/button";

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
  }).format(d);
}

export default function SeatMap({
  showtimeId,
  price,
  movieTitle,
  posterUrl,
  cinemaName,
  studioName,
  showDate,
  startTime,
}: {
  showtimeId: string;
  price: number;
  movieTitle: string;
  posterUrl: string;
  cinemaName: string;
  studioName: string;
  showDate: string;
  startTime: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [seats, setSeats] = useState<SeatMapRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await supabase.rpc("get_seat_map", {
        p_showtime_id: showtimeId,
      });
      if (!active) return;
      if (error) setError(error.message);
      else setSeats(data ?? []);
      setLoading(false);
    }

    load();
    const channel = supabase
      .channel(`showtime-${showtimeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "showtime_seats",
          filter: `showtime_id=eq.${showtimeId}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [showtimeId, supabase]);

  const rows = useMemo(() => {
    const grouped = new Map<string, SeatMapRow[]>();
    seats.forEach((seat) => {
      const list = grouped.get(seat.row_label) ?? [];
      list.push(seat);
      grouped.set(seat.row_label, list);
    });
    return Array.from(grouped.entries()).map(([label, list]) => ({
      label,
      seats: list.sort((a, b) => a.seat_number - b.seat_number),
    }));
  }, [seats]);

  const selectedLabels = useMemo(() => {
    return seats
      .filter((s) => selected.has(s.seat_id))
      .map((s) => `${s.row_label}${s.seat_number}`)
      .join(", ");
  }, [seats, selected]);

  function toggle(seat: SeatMapRow) {
    if (seat.status !== "available") return;
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.seat_id)) next.delete(seat.seat_id);
      else {
        if (next.size >= 8) {
          setError("Maksimal 8 kursi per transaksi.");
          return prev;
        }
        next.add(seat.seat_id);
      }
      return next;
    });
  }

  async function checkout() {
    if (selected.size === 0) {
      setError("Pilih minimal satu kursi.");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("create_booking", {
      p_showtime_id: showtimeId,
      p_seat_ids: Array.from(selected),
    });
    setLoading(false);
    if (error) {
      if (error.message.includes("login")) router.push("/login");
      else setError(error.message);
      return;
    }
    const result = data as { booking_id?: string } | null;
    if (result?.booking_id) router.push(`/booking/${result.booking_id}`);
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_380px]">
      {/* Kiri: Layar + Grid Kursi + Legend (Figma 1:862) */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="mx-auto flex w-fit flex-col items-center gap-5 px-2 py-2 sm:gap-6">
          {/* Bar Screen */}
          <div className="w-full max-w-[520px]">
            <div className="h-1 w-full rounded-[2px] bg-cine-gold" />
            <div className="bg-cine-cream py-1.5 text-center text-xs text-cine-muted">
              Screen
            </div>
          </div>

          {/* Grid Kursi */}
          <div className="flex flex-col gap-2.5 sm:gap-3">
            {rows.map((row) => {
              const half = Math.floor(row.seats.length / 2);
              return (
                <div key={row.label} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-5 text-xs text-cine-muted sm:w-6 sm:text-sm">{row.label}</span>
                  <div className="flex items-center gap-1.5 sm:gap-3">
                    {row.seats.map((seat, idx) => {
                      const isSelected = selected.has(seat.seat_id);
                      const isBooked =
                        seat.status === "booked" ||
                        seat.status === "blocked" ||
                        seat.status === "held";
                      const disabled = isBooked;
                      const isCouple = seat.seat_type === "couple";
                      const seatTitle =
                        seat.status === "held" && seat.is_mine
                          ? `${row.label}${seat.seat_number} — Sedang kamu tahan di booking pending (cek My Booking)`
                          : `${row.label}${seat.seat_number} (${seat.seat_type}) — ${seat.status}`;

                      return (
                        <div key={seat.seat_id} className="flex items-center">
                          {idx === half && row.seats.length >= 8 && (
                            <div className="w-4 shrink-0 sm:w-8" aria-hidden />
                          )}
                          <button
                            type="button"
                            onClick={() => toggle(seat)}
                            disabled={disabled}
                            title={seatTitle}
                            aria-label={`Kursi ${row.label}${seat.seat_number}`}
                            className={cn(
                              "group flex cursor-pointer flex-col items-center gap-px transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform disabled:cursor-not-allowed",
                              !disabled && "hover:scale-110 active:scale-95",
                            )}
                          >
                            <span
                              className={cn(
                                "block h-4 rounded-[6px] transition-colors duration-200",
                                isCouple ? "w-7" : "w-5",
                                isSelected
                                  ? "bg-cine-maroon"
                                  : isBooked
                                    ? "bg-cine-seat-booked"
                                    : seat.seat_type === "premium"
                                      ? "border border-cine-gold-dark bg-cine-gold/40 group-hover:bg-cine-gold/70"
                                      : "border border-cine-seat-border bg-cine-cream group-hover:bg-cine-gold/40",
                              )}
                            />
                            <span
                              className={cn(
                                "block h-2 rounded-[4px] transition-colors duration-200",
                                isCouple ? "w-9" : "w-7",
                                isSelected
                                  ? "bg-cine-maroon"
                                  : isBooked
                                    ? "bg-cine-seat-booked"
                                    : seat.seat_type === "premium"
                                      ? "border border-cine-gold-dark bg-cine-gold/40 group-hover:bg-cine-gold/70"
                                      : "border border-cine-seat-border bg-cine-cream group-hover:bg-cine-gold/40",
                              )}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!loading && rows.length === 0 && (
              <p className="text-sm text-cine-muted">Belum ada denah kursi untuk jadwal ini.</p>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-[13px] text-cine-muted sm:gap-6">
            <LegendBox className="bg-cine-seat-booked" label="Booked" />
            <LegendBox className="border border-cine-seat-border bg-cine-cream" label="Available" />
            <LegendBox className="bg-cine-maroon" label="Selected" />
          </div>
        </div>
      </div>

      {/* Kanan: Panel Ringkasan (Figma 1:862) */}
      <aside className="cine-card flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-3.5">
          <div className="relative h-[92px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-white">
            <Image src={posterUrl} alt={movieTitle} fill sizes="64px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-base font-bold leading-snug text-cine-ink">{movieTitle}</h2>
            <p className="text-[13px] text-cine-muted">
              {cinemaName} · {studioName}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-1 rounded-[10px] border border-cine-border bg-white px-3.5 py-3 text-sm text-cine-ink">
            <span>{formatShortDate(showDate)}</span>
            {isWeekendDate(showDate) && (
              <span className="rounded-full bg-cine-maroon/10 px-2 py-0.5 text-[10px] font-bold text-cine-maroon">
                Weekend
              </span>
            )}
          </div>
          <div className="rounded-[10px] border border-cine-border bg-white px-3.5 py-3 text-sm text-cine-ink">
            {startTime.slice(0, 5)}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-cine-muted">Seat</span>
          <span className="font-medium text-cine-ink">{selectedLabels || "-"}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-cine-muted">
            Ticket {selected.size} x {formatRupiah(price)}
            {isWeekendDate(showDate) ? " (Tarif Weekend)" : ""}
          </span>
          <span className="text-cine-ink">{formatRupiah(price * selected.size)}</span>
        </div>

        <div className="cine-divider" />

        <div className="flex items-center justify-between text-base font-bold text-cine-ink">
          <span>Total</span>
          <span>{formatRupiah(price * selected.size)}</span>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button
          onClick={checkout}
          disabled={loading || selected.size === 0}
          variant="gold"
          className="w-full"
        >
          {loading ? "Memproses..." : "Buy Ticket"}
        </Button>
      </aside>
    </div>
  );
}

function LegendBox({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("size-[18px] rounded-[5px]", className)} />
      {label}
    </span>
  );
}
