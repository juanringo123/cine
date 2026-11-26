"use client";

import Button from "@/components/ui/button";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="cine-container py-16">
      <div className="cine-card mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-cine-maroon">Gagal memuat halaman</h1>
        <p className="text-sm text-cine-muted">
          {error.message || "Terjadi kesalahan saat mengambil data dari server."}
        </p>
        <Button type="button" variant="gold" onClick={reset}>
          Coba lagi
        </Button>
      </div>
    </main>
  );
}
