import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveMoviePoster } from "@/lib/assets";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; status?: string };
};

function readGeminiConfig(): { apiKey: string; model: string } {
  let apiKey = (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    ""
  ).trim();
  let model = (process.env.GEMINI_MODEL ?? "").trim();

  if (!apiKey || !model) {
    const candidates = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "..", ".env"),
    ];
    for (const file of candidates) {
      try {
        if (!fs.existsSync(/*turbopackIgnore: true*/ file)) continue;
        const lines = fs
          .readFileSync(/*turbopackIgnore: true*/ file, "utf8")
          .split(/\r?\n/);
        for (const line of lines) {
          if (!line || line.startsWith("#") || !line.includes("=")) continue;
          const idx = line.indexOf("=");
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (!apiKey && (k === "GEMINI_API_KEY" || k === "GOOGLE_API_KEY") && v) {
            apiKey = v;
          }
          if (!model && k === "GEMINI_MODEL" && v) {
            model = v;
          }
        }
      } catch {
        // Abaikan error baca file
      }
    }
  }

  return { apiKey, model: model || "gemini-3.8-flash" };
}

function safeParseJson(text: string): { reply?: string; recommended_slugs?: unknown } | null {
  const trimmed = text.trim();
  const unwrapped = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(unwrapped) as { reply?: string; recommended_slugs?: unknown };
  } catch {
    return null;
  }
}

/** Endpoint rekomendasi film menggunakan katalog Supabase + Google Gemini API. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    messages?: ChatMessage[];
  };

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages
    .filter(
      (m): m is ChatMessage =>
        Boolean(m) &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-8)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 600),
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Pertanyaan wajib diisi." },
      { status: 400 },
    );
  }

  const { apiKey, model } = readGeminiConfig();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY belum diisi. Tambahkan GEMINI_API_KEY=... di file cine-web/.env.local (atau .env root), lalu restart server Next.js.",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const todayJakarta = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const [moviesRes, genresRes, movieGenresRes, showtimesRes] = await Promise.all([
      supabase
        .from("movies")
        .select(
          "id, slug, title, status, duration_minutes, age_rating, rating, release_date, poster_url, synopsis, country, director",
        )
        .in("status", ["now_showing", "coming_soon"])
        .order("release_date", { ascending: false }),
      supabase.from("genres").select("id, name"),
      supabase.from("movie_genres").select("movie_id, genre_id"),
      supabase
        .from("showtimes")
        .select("movie_id")
        .eq("is_active", true)
        .gte("show_date", todayJakarta),
    ]);

    if (moviesRes.error) {
      return NextResponse.json(
        { error: `Gagal memuat katalog film: ${moviesRes.error.message}` },
        { status: 500 },
      );
    }

    const genreNameById = new Map((genresRes.data ?? []).map((g) => [g.id, g.name]));
    const genresByMovie = new Map<string, string[]>();
    for (const mg of movieGenresRes.data ?? []) {
      const name = genreNameById.get(mg.genre_id);
      if (!name) continue;
      const list = genresByMovie.get(mg.movie_id) ?? [];
      list.push(name);
      genresByMovie.set(mg.movie_id, list);
    }

    const moviesWithShowtimes = new Set(
      (showtimesRes.data ?? []).map((s) => s.movie_id),
    );

    const catalog = (moviesRes.data ?? []).map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      status: m.status,
      genres: genresByMovie.get(m.id) ?? [],
      duration_minutes: m.duration_minutes,
      age_rating: m.age_rating ?? "SU",
      rating: m.rating,
      release_date: m.release_date,
      country: m.country,
      director: m.director,
      has_showtimes: moviesWithShowtimes.has(m.id),
      poster_url: resolveMoviePoster(m.poster_url, m.slug || m.id, m.status),
      synopsis: m.synopsis ? m.synopsis.slice(0, 160) : "",
    }));

    const catalogBySlug = new Map(catalog.map((m) => [m.slug, m]));

    const systemPrompt = [
      "Kamu adalah CINÉ AI, asisten rekomendasi film bioskop CINÉ yang ramah, ringkas, dan membantu dalam Bahasa Indonesia.",
      "ATURAN KETAT:",
      "1. HANYA rekomendasikan film yang ada di KATALOG FILM CINÉ di bawah ini. Jangan pernah mengarang film di luar katalog.",
      "2. Utamakan film berstatus `now_showing` dengan `has_showtimes: true` jika pengguna ingin menonton sekarang/hari ini; rekomendasikan `coming_soon` jika ditanya film yang akan datang.",
      "3. Selalu balas dalam format JSON valid persis seperti skema:",
      '   {"reply": "jawaban ringkas dan natural dalam bahasa Indonesia", "recommended_slugs": ["slug-1", "slug-2"]}',
      "4. `recommended_slugs` berisi 0 sampai 4 slug persis seperti di katalog.",
      "",
      "KATALOG FILM CINÉ:",
      JSON.stringify(
        catalog.map((m) => ({
          slug: m.slug,
          title: m.title,
          status: m.status,
          genres: m.genres,
          duration_minutes: m.duration_minutes,
          age_rating: m.age_rating,
          rating: m.rating,
          release_date: m.release_date,
          country: m.country,
          has_showtimes: m.has_showtimes,
          synopsis: m.synopsis,
        })),
      ),
    ].join("\n");

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const fallbackModels = [
      model,
      "gemini-3.7-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ].filter((name, index, arr) => Boolean(name) && arr.indexOf(name) === index);

    const retryableStatuses = new Set([404, 429, 500, 502, 503, 504]);
    let geminiData: GeminiResponse = {};
    let succeeded = false;
    let lastError = "Gemini API tidak merespons.";
    let lastRetryable = false;

    for (let i = 0; i < fallbackModels.length; i++) {
      const candidateModel = fallbackModels[i];
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        candidateModel,
      )}:generateContent`;

      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        }),
        cache: "no-store",
      });

      const parsed = (await geminiRes.json().catch(() => ({}))) as GeminiResponse;
      if (geminiRes.ok) {
        geminiData = parsed;
        succeeded = true;
        break;
      }

      lastError =
        parsed.error?.message ??
        `Gemini API mengembalikan status ${geminiRes.status}.`;
      lastRetryable = retryableStatuses.has(geminiRes.status);

      if (!lastRetryable) {
        return NextResponse.json({ error: lastError }, { status: 502 });
      }

      if (i < fallbackModels.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (!succeeded) {
      return NextResponse.json(
        {
          error: lastRetryable
            ? "Server AI Gemini sedang padat sementara. Silakan coba kirim ulang beberapa detik lagi."
            : lastError,
        },
        { status: lastRetryable ? 503 : 502 },
      );
    }

    const rawText =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() ?? "";

    const parsed = safeParseJson(rawText);
    const reply =
      (parsed?.reply && typeof parsed.reply === "string"
        ? parsed.reply.trim()
        : rawText) || "Berikut beberapa film yang mungkin cocok untukmu di CINÉ:";

    const slugList = Array.isArray(parsed?.recommended_slugs)
      ? parsed.recommended_slugs.filter((s): s is string => typeof s === "string")
      : [];

    const recommendedMovies = Array.from(new Set(slugList))
      .map((slug) => catalogBySlug.get(slug))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .slice(0, 4)
      .map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        status: m.status,
        rating: m.rating,
        duration_minutes: m.duration_minutes,
        age_rating: m.age_rating,
        poster_url: m.poster_url,
        genres: m.genres,
        has_showtimes: m.has_showtimes,
      }));

    return NextResponse.json({
      reply,
      movies: recommendedMovies,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memanggil Gemini AI.",
      },
      { status: 500 },
    );
  }
}
