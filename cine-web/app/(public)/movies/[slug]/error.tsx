"use client";

import Link from "next/link";
import Button from "@/components/ui/button";

export default function MovieDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="cine-container py-16">
      <div className="cine-card mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-cine-maroon">Detail film tidak tersedia</h1>
        <p className="text-sm text-cine-muted">
          {error.message || "Terjadi kendala saat mengambil data film."}
        </p>
        <div className="flex justify-center gap-3">
          <Button type="button" variant="gold" onClick={reset}>
            Coba lagi
          </Button>
          <Link
            href="/movies"
            className="inline-flex items-center justify-center rounded-xl border border-cine-maroon bg-white px-6 py-3 text-sm font-bold text-cine-maroon hover:bg-cine-maroon/5"
          >
            Kembali ke Film
          </Link>
        </div>
      </div>
    </main>
  );
}
