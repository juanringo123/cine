"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Profile } from "@/../supabase/types/database";
import Button from "@/components/ui/button";
import { Avatar, Input, Select } from "@/components/ui/primitives";

export default function ProfileForm({
  profile,
  email,
  cinemaName,
}: {
  profile: Profile | null;
  email: string;
  cinemaName?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [gender, setGender] = useState<Enums<"gender"> | "">(profile?.gender ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        nickname: nickname.trim() || null,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        gender: gender || null,
        city: city.trim() || null,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) setError(error.message);
    else {
      setMessage("Profil tersimpan.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Banner Profil (Figma 1:2072 / 1:2150) */}
      <div className="cine-card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={profile?.full_name ?? email} src={profile?.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-cine-ink">
            {profile?.full_name ?? nickname ?? "Pengguna CINÉ"}
          </p>
          <p className="truncate text-xs text-cine-muted">
            {email}
            {cinemaName ? ` · ${cinemaName}` : profile?.city ? ` · ${profile.city}` : ""}
          </p>
        </div>
      </div>

      {/* Form Informasi Pribadi */}
      <form onSubmit={save} className="cine-card space-y-6 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-cine-ink">Informasi pribadi</h2>
          <p className="text-xs text-cine-muted">
            Perbarui data diri dan preferensi menontonmu.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nama Lengkap">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Nama Panggilan">
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={email} disabled className="opacity-65" />
          </Field>
          <Field label="Nomor Telepon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812..." />
          </Field>
          <Field label="Tanggal Lahir">
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="Jenis Kelamin">
            <Select
              value={gender}
              onChange={(e) => setGender(e.target.value as Enums<"gender"> | "")}
            >
              <option value="">Pilih Jenis Kelamin</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </Select>
          </Field>
          <Field label="Kota / Lokasi">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Depok" />
          </Field>
        </div>

        <p className="text-xs text-cine-muted">
          Email dan nomor telepon digunakan untuk informasi pemesanan tiket.
        </p>

        {error && <p className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="gold" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan perubahan"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="cine-label block">{label}</span>
      {children}
    </label>
  );
}
