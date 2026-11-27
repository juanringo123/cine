"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Promo } from "@/../supabase/types/database";
import Button from "@/components/ui/button";
import { getJakartaDateISO } from "@/lib/utils";

export default function PromoManager({ promos }: { promos: Promo[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Enums<"promo_discount_type">>("percent");
  const [value, setValue] = useState("10");
  const [minPurchase, setMinPurchase] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [validUntil, setValidUntil] = useState(() => getJakartaDateISO(30));
  const [quota, setQuota] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("promos").insert({
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discount_type: type,
      discount_value: Number(value),
      min_purchase: Number(minPurchase),
      max_discount: maxDiscount ? Number(maxDiscount) : null,
      valid_until: new Date(`${validUntil}T23:59:59+07:00`).toISOString(),
      quota: quota ? Number(quota) : null,
      per_user_limit: Number(perUserLimit),
    });
    if (error) setError(error.message);
    else {
      setCode(""); setDescription("");
      router.refresh();
    }
  }

  async function toggle(promo: Promo) {
    const { error } = await supabase.from("promos").update({ is_active: !promo.is_active }).eq("id", promo.id);
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="cine-card grid gap-3 p-5 sm:grid-cols-2">
        <Field label="Kode" value={code} onChange={setCode} placeholder="PROMOBARU" required />
        <Field label="Deskripsi" value={description} onChange={setDescription} />
        <label className="space-y-1">
          <span className="cine-label">Tipe diskon</span>
          <select className="cine-input" value={type} onChange={(e) => setType(e.target.value as Enums<"promo_discount_type">)}>
            <option value="percent">Persen (%)</option>
            <option value="fixed">Nominal tetap</option>
          </select>
        </label>
        <Field label="Nilai diskon" value={value} onChange={setValue} type="number" required />
        <Field label="Min. pembelian" value={minPurchase} onChange={setMinPurchase} type="number" />
        <Field label="Maks. diskon" value={maxDiscount} onChange={setMaxDiscount} type="number" />
        <Field label="Berlaku sampai" value={validUntil} onChange={setValidUntil} type="date" required />
        <Field label="Kuota (kosong = unlimited)" value={quota} onChange={setQuota} type="number" />
        <Field label="Batas per user" value={perUserLimit} onChange={setPerUserLimit} type="number" required />
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2"><Button type="submit">Tambah Promo</Button></div>
      </form>

      <div className="space-y-2">
        {promos.map((promo) => (
          <div key={promo.id} className="cine-card flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="font-bold text-cine-maroon">{promo.code}</span>
            <span className="flex-1 text-cine-muted">{promo.description}</span>
            <span>{promo.discount_type === "percent" ? `${promo.discount_value}%` : `Rp ${promo.discount_value}`}</span>
            <button type="button" onClick={() => toggle(promo)} className={`rounded-full px-3 py-1 text-xs ${promo.is_active ? "bg-cine-gold" : "bg-white"}`}>
              {promo.is_active ? "Aktif" : "Nonaktif"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="cine-label">{label}</span>
      <input className="cine-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </label>
  );
}
