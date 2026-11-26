"use client";

import { useEffect, useState } from "react";
import { FIGMA_ICONS } from "@/lib/assets";
import { toYouTubeEmbedUrl } from "@/lib/youtube";

export default function TrailerPlayer({
  title,
  trailerUrl,
}: {
  title: string;
  trailerUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const embedUrl = toYouTubeEmbedUrl(trailerUrl);
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer`)}`;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Putar trailer ${title}`}
        className="absolute left-1/2 top-1/2 z-10 flex size-[72px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-cine-cream shadow-lg transition-transform hover:scale-105"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FIGMA_ICONS.play} alt="" width={28} height={28} className="size-7" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Trailer ${title}`}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-[20px] bg-cine-maroon-deep shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 text-white">
              <p className="truncate text-sm font-bold">Trailer — {title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Tutup ✕
              </button>
            </div>

            {embedUrl ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={embedUrl}
                  title={`Trailer ${title}`}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : trailerUrl ? (
              <div className="space-y-4 p-8 text-center text-white">
                <p className="text-sm text-white/80">
                  Link trailer tidak berbentuk embed YouTube. Buka langsung di tab baru:
                </p>
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-xl bg-cine-gold px-6 py-3 text-sm font-bold text-cine-ink hover:bg-cine-gold-dark"
                >
                  Buka Trailer
                </a>
              </div>
            ) : (
              <div className="space-y-4 p-8 text-center text-white">
                <p className="text-sm text-white/80">
                  URL trailer YouTube untuk <strong>{title}</strong> belum diisi di database.
                  Tambahkan link YouTube melalui <strong>Admin → Film</strong>, atau cari langsung di YouTube:
                </p>
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-xl bg-cine-gold px-6 py-3 text-sm font-bold text-cine-ink hover:bg-cine-gold-dark"
                >
                  Cari Trailer di YouTube
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
