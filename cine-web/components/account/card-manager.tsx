"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Tables } from "@/../supabase/types/database";
import Button from "@/components/ui/button";

type CardRow = Pick<
  Tables<"saved_cards">,
  "id" | "brand" | "last4" | "expiry_month" | "expiry_year" | "holder_name" | "is_default" | "created_at"
>;

const brands: Enums<"card_brand">[] = ["visa", "mastercard", "amex", "other"];
const empty = {
  brand: "visa" as Enums<"card_brand">,
  last4: "",
  expiry_month: "",
  expiry_year: "",
  holder_name: "",
  gateway_token: "",
  is_default: false,
};

export default function CardManager({ cards, userId }: { cards: CardRow[]; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(form.last4)) {
      setError("4 digit terakhir harus angka.");
      return;
    }
    const month = Number(form.expiry_month);
    const year = Number(form.expiry_year);
    if (month < 1 || month > 12 || year < 2000) {
      setError("Masa berlaku tidak valid.");
      return;
    }

    const { error } = await supabase.from("saved_cards").insert({
      user_id: userId,
      brand: form.brand,
      last4: form.last4,
      expiry_month: month,
      expiry_year: year,
      holder_name: form.holder_name.trim() || null,
      gateway_token: form.gateway_token.trim(),
      is_default: form.is_default,
    });
    if (error) setError(error.message);
    else {
      setForm(empty);
      router.refresh();
    }
  }

  async function makeDefault(id: string) {
    const { error } = await supabase.from("saved_cards").update({ is_default: true }).eq("id", id);
    if (error) setError(error.message);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus kartu ini?")) return;
    const { error } = await supabase.from("saved_cards").delete().eq("id", id);
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="cine-card p-4 text-xs text-cine-muted">
        Nomor kartu lengkap <strong>tidak disimpan</strong>. Simpan hanya 4 digit terakhir & token dari gateway pembayaran.
        Token bisa diperoleh dari Snap.js / JS gateway setelah kartu ditokenisasi.
      </div>

      <form onSubmit={add} className="cine-card grid gap-3 p-5 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="cine-label">Brand</span>
          <select className="cine-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value as Enums<"card_brand"> })}>
            {brands.map((b) => <option key={b} value={b}>{b.toUpperCase()}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="cine-label">4 digit terakhir</span>
          <input className="cine-input" inputMode="numeric" maxLength={4} value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "") })} placeholder="4242" required />
        </label>
        <label className="space-y-1">
          <span className="cine-label">Bulan kedaluwarsa</span>
          <input className="cine-input" type="number" min={1} max={12} value={form.expiry_month} onChange={(e) => setForm({ ...form, expiry_month: e.target.value })} placeholder="12" required />
        </label>
        <label className="space-y-1">
          <span className="cine-label">Tahun kedaluwarsa</span>
          <input className="cine-input" type="number" min={2000} value={form.expiry_year} onChange={(e) => setForm({ ...form, expiry_year: e.target.value })} placeholder="2030" required />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="cine-label">Nama pemegang kartu</span>
          <input className="cine-input" value={form.holder_name} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="cine-label">Gateway token</span>
          <input className="cine-input" value={form.gateway_token} onChange={(e) => setForm({ ...form, gateway_token: e.target.value })} placeholder="token dari Snap.js" required />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-cine-maroon" />
          Jadikan kartu utama
        </label>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2"><Button type="submit" variant="gold">Simpan Kartu</Button></div>
      </form>

      <div className="space-y-2">
        {cards.map((card) => (
          <div key={card.id} className="cine-card flex flex-wrap items-center gap-3 p-4 text-sm">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{card.brand.toUpperCase()} •••• {card.last4}</p>
                {card.is_default && <span className="rounded-full bg-cine-gold px-2 py-0.5 text-[10px]">Utama</span>}
              </div>
              <p className="text-xs text-cine-muted">
                {card.holder_name ?? "-"} · {String(card.expiry_month).padStart(2, "0")}/{card.expiry_year}
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              {!card.is_default && (
                <button type="button" onClick={() => makeDefault(card.id)} className="text-cine-maroon underline">jadikan utama</button>
              )}
              <button type="button" onClick={() => remove(card.id)} className="text-red-700 underline">hapus</button>
            </div>
          </div>
        ))}
        {!cards.length && <p className="text-sm text-cine-muted">Belum ada kartu tersimpan.</p>}
      </div>
    </div>
  );
}
