"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Sparkles, Star, X } from "lucide-react";

type RecommendedMovie = {
  id: string;
  slug: string;
  title: string;
  status: string;
  rating: number | null;
  duration_minutes: number;
  age_rating: string;
  poster_url: string;
  genres: string[];
  has_showtimes: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  movies?: RecommendedMovie[];
  isError?: boolean;
};

const QUICK_PROMPTS = [
  "Film Indonesia yang bagus hari ini?",
  "Rekomendasi film horor / menegangkan",
  "Film seru buat nonton bareng pasangan",
  "Film apa saja yang segera tayang?",
];

export default function CineAiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, open]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory
            .filter((m) => !m.isError)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        movies?: RecommendedMovie[];
        error?: string;
      };

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: data.error ?? "Gagal mendapatkan rekomendasi dari AI.",
            isError: true,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply ?? "Ini rekomendasi film untukmu:",
          movies: data.movies ?? [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error ? err.message : "Koneksi ke asisten AI gagal.",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 ${open ? "z-50" : "z-40"}`}>
      {open && (
        <section
          aria-label="CINÉ AI Rekomendasi Film"
          className="cine-popover-enter cine-glass-surface mb-3 flex h-[min(460px,calc(100dvh-13.5rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] sm:h-[min(560px,calc(100dvh-7.5rem))] sm:w-[400px]"
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-2 bg-cine-maroon px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/15 text-cine-gold">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-tight">CINÉ AI</h2>
                <p className="text-[11px] text-cine-gold">
                  Rekomendasi Film · Gemini
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  title="Mulai chat baru"
                  aria-label="Reset chat"
                  className="cursor-pointer rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup asisten AI"
                className="cursor-pointer rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          {/* Isi Percakapan */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4 text-sm"
          >
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-cine-border/80 bg-white/90 p-3.5 text-cine-ink">
                  <p className="font-semibold text-cine-maroon">
                    Halo! Bingung mau nonton apa?
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-cine-muted">
                    Ceritakan mood atau genre favoritmu — saya akan pilih film
                    yang sedang tayang atau segera tayang di CINÉ.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cine-muted">
                    Coba tanyakan
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void ask(prompt)}
                        className="cursor-pointer rounded-full border border-cine-border bg-white/90 px-3 py-1.5 text-left text-xs font-medium text-cine-ink transition-all duration-200 hover:border-cine-maroon hover:bg-cine-cream"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-2 ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={
                      msg.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-cine-maroon px-3.5 py-2.5 text-xs leading-relaxed text-white"
                        : msg.isError
                          ? "max-w-[92%] rounded-2xl rounded-bl-sm border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-700"
                          : "max-w-[92%] rounded-2xl rounded-bl-sm border border-cine-border/80 bg-white/95 px-3.5 py-2.5 text-xs leading-relaxed text-cine-ink"
                    }
                  >
                    <p className="whitespace-pre-line">{msg.content}</p>
                  </div>

                  {msg.movies && msg.movies.length > 0 && (
                    <div className="w-full space-y-2">
                      {msg.movies.map((m) => (
                        <Link
                          key={m.id}
                          href={`/movies/${m.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 rounded-xl border border-cine-border bg-white/95 p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-cine-maroon hover:shadow-sm"
                        >
                          <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-cine-cream">
                            <Image
                              src={m.poster_url}
                              alt={m.title}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-xs font-bold text-cine-ink">
                              {m.title}
                            </p>
                            <p className="truncate text-[11px] text-cine-muted">
                              {m.genres.slice(0, 2).join(", ") || m.age_rating} ·{" "}
                              {m.duration_minutes}m
                            </p>
                            <div className="flex items-center gap-2 text-[10px]">
                              {m.rating && (
                                <span className="inline-flex items-center gap-0.5 font-semibold text-cine-maroon">
                                  <Star className="size-3 fill-cine-gold text-cine-gold" />
                                  {m.rating.toFixed(1)}
                                </span>
                              )}
                              <span
                                className={`rounded px-1.5 py-0.5 font-semibold ${
                                  m.status === "now_showing"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-cine-cream text-cine-ink"
                                }`}
                              >
                                {m.status === "now_showing"
                                  ? m.has_showtimes
                                    ? "Sedang Tayang"
                                    : "Tayang"
                                  : "Segera"}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="inline-flex items-center gap-1.5 rounded-2xl border border-cine-border/80 bg-white/90 px-3.5 py-2.5 text-xs text-cine-muted">
                <span className="size-1.5 animate-bounce rounded-full bg-cine-maroon [animation-delay:-0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-cine-maroon [animation-delay:-0.1s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-cine-maroon" />
                <span className="ml-1">Mencari film yang pas...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-cine-border/80 bg-white/85 p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya rekomendasi film..."
              disabled={loading}
              className="flex-1 rounded-xl border border-cine-border bg-white px-3 py-2 text-xs text-cine-ink placeholder:text-cine-placeholder focus:border-cine-maroon focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Kirim pertanyaan"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-cine-maroon text-white transition-all duration-200 hover:bg-cine-maroon-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      )}

      {/* Tombol Floating */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Tutup CINÉ AI" : "Buka CINÉ AI"}
        title={open ? "Tutup CINÉ AI" : "CINÉ AI"}
        className="ml-auto flex size-12 cursor-pointer items-center justify-center rounded-full border border-cine-gold/70 bg-cine-maroon text-white shadow-lg transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-cine-maroon-dark active:scale-95 sm:size-14"
      >
        {open ? (
          <X className="size-5 text-cine-gold sm:size-6" />
        ) : (
          <Sparkles className="size-5 text-cine-gold sm:size-6" />
        )}
      </button>
    </div>
  );
}
