"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/../supabase/types/database";
import Button from "@/components/ui/button";

type Address = Tables<"addresses">;

const empty = {
  label: "Rumah",
  recipient_name: "",
  phone: "",
  address_line: "",
  rt: "",
  rw: "",
  district: "",
  city: "",
  province: "",
  postal_code: "",
  courier_note: "",
  is_primary: false,
};

export default function AddressManager({ addresses, userId }: { addresses: Address[]; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof empty, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("addresses").insert({
      ...form,
      user_id: userId,
      phone: form.phone || null,
      rt: form.rt || null,
      rw: form.rw || null,
      district: form.district || null,
      city: form.city || null,
      province: form.province || null,
      postal_code: form.postal_code || null,
      courier_note: form.courier_note || null,
    });
    if (error) setError(error.message);
    else {
      setForm(empty);
      router.refresh();
    }
  }

  async function makePrimary(id: string) {
    const { error } = await supabase.from("addresses").update({ is_primary: true }).eq("id", id);
    if (error) setError(error.message);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus alamat ini?")) return;
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="cine-card grid gap-3 p-5 sm:grid-cols-2">
        <Field label="Label" value={form.label} onChange={(v) => set("label", v)} placeholder="Rumah / Kantor" />
        <Field label="Nama penerima" value={form.recipient_name} onChange={(v) => set("recipient_name", v)} required />
        <Field label="No. HP" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Alamat lengkap" value={form.address_line} onChange={(v) => set("address_line", v)} required />
        <Field label="RT" value={form.rt} onChange={(v) => set("rt", v)} />
        <Field label="RW" value={form.rw} onChange={(v) => set("rw", v)} />
        <Field label="Kecamatan" value={form.district} onChange={(v) => set("district", v)} />
        <Field label="Kota" value={form.city} onChange={(v) => set("city", v)} />
        <Field label="Provinsi" value={form.province} onChange={(v) => set("province", v)} />
        <Field label="Kode pos" value={form.postal_code} onChange={(v) => set("postal_code", v)} />
        <Field label="Catatan kurir" value={form.courier_note} onChange={(v) => set("courier_note", v)} />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={form.is_primary} onChange={(e) => set("is_primary", e.target.checked)} className="accent-cine-maroon" />
          Jadikan alamat utama
        </label>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2"><Button type="submit" variant="gold">Tambah Alamat</Button></div>
      </form>

      <div className="space-y-2">
        {addresses.map((address) => (
          <div key={address.id} className="cine-card flex flex-wrap items-start gap-3 p-4 text-sm">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{address.label}</p>
                {address.is_primary && <span className="rounded-full bg-cine-gold px-2 py-0.5 text-[10px]">Utama</span>}
              </div>
              <p>{address.recipient_name} {address.phone && `· ${address.phone}`}</p>
              <p className="text-cine-muted">
                {address.address_line}
                {address.rt && ` RT ${address.rt}`}
                {address.rw && ` RW ${address.rw}`}
                {address.district && `, ${address.district}`}
                {address.city && `, ${address.city}`}
                {address.province && `, ${address.province}`}
                {address.postal_code && ` ${address.postal_code}`}
              </p>
              {address.courier_note && <p className="text-xs text-cine-muted">Catatan: {address.courier_note}</p>}
            </div>
            <div className="flex gap-2 text-xs">
              {!address.is_primary && (
                <button type="button" onClick={() => makePrimary(address.id)} className="text-cine-maroon underline">jadikan utama</button>
              )}
              <button type="button" onClick={() => remove(address.id)} className="text-red-700 underline">hapus</button>
            </div>
          </div>
        ))}
        {!addresses.length && <p className="text-sm text-cine-muted">Belum ada alamat.</p>}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="cine-label">{label}</span>
      <input className="cine-input" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </label>
  );
}
