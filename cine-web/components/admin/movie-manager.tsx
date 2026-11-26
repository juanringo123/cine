"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Movie } from "@/../supabase/types/database";
import { extractYouTubeId } from "@/lib/youtube";
import Button from "@/components/ui/button";

const statuses: Enums<"movie_status">[] = ["coming_soon", "now_showing", "archived"];
const ratings: Enums<"movie_age_rating">[] = ["SU", "13+", "17+", "21+"];

export default function MovieManager({ movies }: { movies: Movie[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("120");
  const [status, setStatus] = useState<Enums<"movie_status">>("coming_soon");
  const [ageRating, setAgeRating] = useState<Enums<"movie_age_rating">>("SU");
  const [posterUrl, setPosterUrl] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const previewYtId = extractYouTubeId(trailerUrl);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const { error } = await supabase.from("movies").insert({
      slug: slug.trim(),
      title: title.trim(),
      duration_minutes: Number(duration),
      status,
      age_rating: ageRating,
      poster_url: posterUrl.trim() || null,
      trailer_url: trailerUrl.trim() || null,
      synopsis: synopsis.trim() || null,
    });
    if (error) setError(error.message);
    else {
      setSlug("");
      setTitle("");
      setPosterUrl("");
      setTrailerUrl("");
      setSynopsis("");
      setNotice("Film berhasil ditambahkan.");
      router.refresh();
    }
  }

  async function updateMovie(
    id: string,
    patch: Partial<Pick<Movie, "status" | "trailer_url">>,
  ) {
    setError(null);
    setNotice(null);
    const { error } = await supabase.from("movies").update(patch).eq("id", id);
    if (error) setError(error.message);
    else {
      setNotice("Perubahan film tersimpan.");
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Hapus film ini? Jadwal terkait akan ikut terhapus.")) return;
    setError(null);
    const { error } = await supabase.from("movies").delete().eq("id", id);
    if (error) setError(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="cine-card grid gap-4 p-6 sm:grid-cols-2">
        <Input label="Slug" value={slug} onChange={setSlug} placeholder="judul-film" required />
        <Input label="Judul" value={title} onChange={setTitle} required />
        <Input label="Durasi (menit)" value={duration} onChange={setDuration} type="number" required />
        <label className="space-y-2">
          <span className="cine-label block">Status</span>
          <select
            className="cine-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as Enums<"movie_status">)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="cine-label block">Rating usia</span>
          <select
            className="cine-input"
            value={ageRating}
            onChange={(e) => setAgeRating(e.target.value as Enums<"movie_age_rating">)}
          >
            {ratings.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <Input label="Poster URL" value={posterUrl} onChange={setPosterUrl} placeholder="https://..." />
        <div className="space-y-2 sm:col-span-2">
          <Input
            label="Trailer URL (YouTube)"
            value={trailerUrl}
            onChange={setTrailerUrl}
            placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
          />
          {trailerUrl.trim() && (
            <p className={`text-xs ${previewYtId ? "text-green-700" : "text-cine-muted"}`}>
              {previewYtId
                ? `✓ ID YouTube terdeteksi: ${previewYtId}`
                : "Format link tidak dikenali sebagai YouTube video ID — akan dibuka sebagai link biasa."}
            </p>
          )}
        </div>
        <label className="space-y-2 sm:col-span-2">
          <span className="cine-label block">Sinopsis</span>
          <textarea
            className="cine-input"
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            rows={2}
          />
        </label>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        {notice && <p className="text-sm text-green-700 sm:col-span-2">{notice}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" variant="gold">
            Tambah Film
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {movies.map((movie) => (
          <MovieRowItem
            key={movie.id}
            movie={movie}
            onSave={updateMovie}
            onDelete={remove}
          />
        ))}
      </div>
    </div>
  );
}

function MovieRowItem({
  movie,
  onSave,
  onDelete,
}: {
  movie: Movie;
  onSave: (id: string, patch: Partial<Pick<Movie, "status" | "trailer_url">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [trailer, setTrailer] = useState(movie.trailer_url ?? "");
  const ytId = extractYouTubeId(trailer);

  return (
    <div className="cine-card space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-40 flex-1 font-bold text-cine-ink">{movie.title}</span>
        <select
          className="cine-input w-auto py-2"
          value={movie.status}
          onChange={(e) => onSave(movie.id, { status: e.target.value as Enums<"movie_status"> })}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onDelete(movie.id)}
          className="cursor-pointer text-xs font-semibold text-red-700 underline"
        >
          hapus
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="cine-input flex-1 py-2 text-xs"
          value={trailer}
          onChange={(e) => setTrailer(e.target.value)}
          placeholder="Tempel link YouTube trailer (watch?v=... / youtu.be/...)"
        />
        <Button
          type="button"
          variant="outline"
          className="px-4 py-2 text-xs"
          onClick={() => onSave(movie.id, { trailer_url: trailer.trim() || null })}
        >
          Simpan Trailer
        </Button>
      </div>
      {trailer.trim() && (
        <p className={`text-[11px] ${ytId ? "text-green-700" : "text-cine-muted"}`}>
          {ytId ? `✓ YouTube embed siap (${ytId})` : "Link non-YouTube atau format belum cocok."}
        </p>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="cine-label block">{label}</span>
      <input
        className="cine-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}
