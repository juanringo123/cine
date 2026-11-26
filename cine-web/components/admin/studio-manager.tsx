"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Studio } from "@/../supabase/types/database";
import Button from "@/components/ui/button";

const screenTypes: Enums<"screen_type">[] = ["regular_2d", "3d", "imax", "premiere"];

type CinemaOption = { id: string; name: string };
type StudioRow = Pick<Studio, "id" | "cinema_id" | "name" | "screen_type" | "total_rows" | "total_seats" | "is_active">;

export default function StudioManager({
  cinemas,
  studios,
}: {
  cinemas: CinemaOption[];
  studios: StudioRow[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [cinemaId, setCinemaId] = useState(cinemas[0]?.id ?? "");
  const [name, setName] = useState("Studio 1");
  const [screenType, setScreenType] = useState<Enums<"screen_type">>("regular_2d");
  const [rows, setRows] = useState("8");
  const [cols, setCols] = useState("12");
  const [couple, setCouple] = useState("4");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("studios").insert({
      cinema_id: cinemaId,
      name: name.trim(),
      screen_type: screenType,
    });
    if (error) setError(error.message);
    else {
      setName("Studio 1");
      router.refresh();
    }
  }

  async function save(studio: StudioRow, values: {
    name: string; screen_type: Enums<"screen_type">; is_active: boolean;
  }) {
    setError(null);
    const { error } = await supabase.from("studios").update(values).eq("id", studio.id);
    if (error) setError(error.message);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus studio? Kursi & jadwal terkait ikut terhapus.")) return;
    const { error } = await supabase.from("studios").delete().eq("id", id);
    if (error) setError(error.message);
    router.refresh();
  }

  async function generateSeats(studio: StudioRow) {
    setError(null);
    setNotice(null);
    const { data, error } = await supabase.rpc("generate_studio_seats", {
      p_studio_id: studio.id,
      p_rows: Number(rows),
      p_cols: Number(cols),
      p_couple_seats: Number(couple),
    });
    if (error) setError(error.message);
    else setNotice(`Kursi diproses: ${JSON.stringify(data)}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={add} className="cine-card grid gap-3 p-5 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="cine-label">Cinema</span>
          <select className="cine-input" value={cinemaId} onChange={(e) => setCinemaId(e.target.value)}>
            {cinemas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="cine-label">Nama studio</span>
          <input className="cine-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="space-y-1">
          <span className="cine-label">Tipe layar</span>
          <select className="cine-input" value={screenType} onChange={(e) => setScreenType(e.target.value as Enums<"screen_type">)}>
            {screenTypes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        {notice && <p className="text-sm text-green-700 sm:col-span-2">{notice}</p>}
        <div className="sm:col-span-2"><Button type="submit">Tambah Studio</Button></div>
      </form>

      <div className="cine-card grid gap-3 p-5 sm:grid-cols-4">
        <p className="sm:col-span-4 text-sm font-bold">Generate kursi (untuk studio yang dipilih di bawah)</p>
        <label className="space-y-1">
          <span className="cine-label">Baris</span>
          <input className="cine-input" type="number" min={1} max={26} value={rows} onChange={(e) => setRows(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="cine-label">Kolom</span>
          <input className="cine-input" type="number" min={1} max={30} value={cols} onChange={(e) => setCols(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="cine-label">Kursi couple (baris terakhir)</span>
          <input className="cine-input" type="number" min={0} value={couple} onChange={(e) => setCouple(e.target.value)} />
        </label>
      </div>

      <div className="space-y-3">
        {studios.map((studio) => (
          <StudioRowItem
            key={studio.id}
            studio={studio}
            cinemas={cinemas}
            onSave={save}
            onDelete={remove}
            onGenerate={generateSeats}
          />
        ))}
        {!studios.length && <p className="text-sm text-cine-muted">Belum ada studio.</p>}
      </div>
    </div>
  );
}

function StudioRowItem({
  studio,
  cinemas,
  onSave,
  onDelete,
  onGenerate,
}: {
  studio: StudioRow;
  cinemas: CinemaOption[];
  onSave: (studio: StudioRow, values: { name: string; screen_type: Enums<"screen_type">; is_active: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGenerate: (studio: StudioRow) => Promise<void>;
}) {
  const [name, setName] = useState(studio.name);
  const [screenType, setScreenType] = useState<Enums<"screen_type">>(studio.screen_type);
  const [isActive, setIsActive] = useState(studio.is_active);

  return (
    <div className="cine-card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-cine-muted">{cinemas.find((c) => c.id === studio.cinema_id)?.name}</span>
        <span className="text-xs">Kursi: {studio.total_seats} · Baris: {studio.total_rows}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="cine-input" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="cine-input" value={screenType} onChange={(e) => setScreenType(e.target.value as Enums<"screen_type">)}>
          {screenTypes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-cine-maroon" />
          Aktif
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => onSave(studio, { name, screen_type: screenType, is_active: isActive })}>
          Simpan
        </Button>
        <Button variant="gold" className="px-3 py-1 text-xs" onClick={() => onGenerate(studio)}>
          Generate Kursi
        </Button>
        <button type="button" onClick={() => onDelete(studio.id)} className="text-xs text-red-700 underline">
          hapus
        </button>
      </div>
    </div>
  );
}
