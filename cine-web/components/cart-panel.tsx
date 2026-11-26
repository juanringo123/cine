"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/../supabase/types/database";
import { cn, formatRupiah } from "@/lib/utils";
import Button from "@/components/ui/button";
import { Input, Select } from "@/components/ui/primitives";

type CinemaOption = { id: string; name: string; city: string };

export default function CartPanel({ cinemas }: { cinemas: CinemaOption[] }) {
  const router = useRouter();
  const supabase = createClient();
  const { items, total, setQuantity, remove, clear } = useCart();

  const [cinemaId, setCinemaId] = useState(cinemas[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10));
  const [pickupTime, setPickupTime] = useState("18:00");
  const [bookingId, setBookingId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    if (items.length === 0) {
      setError("Keranjang masih kosong.");
      return;
    }
    if (!cinemaId || !pickupDate || !pickupTime) {
      setError("Cinema, tanggal, dan jam pengambilan wajib diisi.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = items.map((item) => ({
      item_id: item.item_id,
      variant_id: item.variant_id ?? null,
      quantity: item.quantity,
      notes: null,
    }));

    const { data, error } = await supabase.rpc("create_fnb_order", {
      p_items: payload as Json,
      p_cinema_id: cinemaId,
      p_pickup_date: pickupDate,
      p_pickup_time: pickupTime,
      p_booking_id: bookingId.trim() || undefined,
      p_promo_code: promoCode.trim() || undefined,
      p_notes: notes.trim() || undefined,
    });

    setLoading(false);
    if (error) {
      if (error.message.includes("login")) router.push("/login");
      else setError(error.message);
      return;
    }

    const result = data as { fnb_order_id?: string } | null;
    clear();
    if (result?.fnb_order_id) router.push(`/order/${result.fnb_order_id}`);
  }

  return (
    <aside className="cine-card h-fit space-y-4 p-[22px]">
      <h2 className="text-lg font-bold text-cine-ink">Keranjang</h2>

      {items.length === 0 ? (
        <div className="space-y-2 py-2">
          <p className="text-sm font-medium text-cine-ink">Keranjangmu masih kosong</p>
          <p className="text-xs text-cine-muted">
            Pilih menu favoritmu, lalu klik Tambah.
          </p>
        </div>
      ) : (
        <>
          <ul className="max-h-60 space-y-2.5 overflow-y-auto text-sm">
            {items.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 border-b border-cine-border pb-2.5 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-cine-ink">{item.name}</p>
                  <p className="text-xs text-cine-muted">
                    {item.variant_name ?? "Reguler"} · {formatRupiah(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.key, item.quantity - 1)}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md border border-cine-border bg-white text-cine-ink"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.key, item.quantity + 1)}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md border border-cine-border bg-white text-cine-ink"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.key)}
                    className="ml-1 cursor-pointer text-[11px] text-cine-maroon underline"
                  >
                    hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="space-y-3 text-sm">
            <label className="block space-y-1.5">
              <span className="cine-label block">Cinema pengambilan</span>
              <Select value={cinemaId} onChange={(e) => setCinemaId(e.target.value)} className="py-2.5">
                {cinemas.map((cinema) => (
                  <option key={cinema.id} value={cinema.id}>
                    {cinema.name} — {cinema.city}
                  </option>
                ))}
              </Select>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1.5">
                <span className="cine-label block">Tanggal</span>
                <Input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="py-2.5"
                />
              </label>
              <label className="space-y-1.5">
                <span className="cine-label block">Jam</span>
                <Input
                  type="time"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="py-2.5"
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="cine-label block">Kode promo (opsional)</span>
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="WELCOME10"
                className="py-2.5"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="cine-label block">ID booking terkait (opsional)</span>
              <Input
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="uuid booking"
                className="py-2.5"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="cine-label block">Catatan (opsional)</span>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tanpa gula"
                className="py-2.5"
              />
            </label>
          </div>
        </>
      )}

      <div className="cine-divider" />

      <div className="flex items-center justify-between text-base font-bold text-cine-ink">
        <span>Total</span>
        <span>{formatRupiah(total)}</span>
      </div>

      {items.length > 0 && (
        <p className="text-[11px] text-cine-muted">
          Biaya layanan &amp; diskon dihitung server saat checkout.
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <Button
        onClick={checkout}
        disabled={loading || items.length === 0}
        variant={items.length === 0 ? "cream" : "gold"}
        className={cn(
          "w-full rounded-xl py-3",
          items.length === 0 && "bg-cine-seat-booked/60 text-cine-muted border-0",
        )}
      >
        {loading ? "Memproses..." : "Buy F&B"}
      </Button>
    </aside>
  );
}
