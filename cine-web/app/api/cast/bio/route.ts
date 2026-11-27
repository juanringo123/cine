import { NextResponse } from "next/server";

type WikipediaSummary = {
  type?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

type TmdbPersonSearchResult = {
  results?: Array<{ id?: number }>;
};

async function findWikipediaBio(
  lang: "id" | "en",
  name: string,
): Promise<string | null> {
  const slug = encodeURIComponent(name.replace(/\s+/g, "_"));
  try {
    const response = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      {
        headers: { "User-Agent": "CINE-Web/1.0" },
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 86400 },
      },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as WikipediaSummary;
    const pageUrl = data?.content_urls?.desktop?.page;
    if (
      data?.type === "standard" &&
      typeof pageUrl === "string" &&
      pageUrl.startsWith(`https://${lang}.wikipedia.org/`)
    ) {
      return pageUrl;
    }
    return null;
  } catch {
    return null;
  }
}

async function findTmdbPersonUrl(name: string): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/person?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(name)}&include_adult=false&language=id-ID`,
      {
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 86400 },
      },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as TmdbPersonSearchResult;
    const id = data?.results?.[0]?.id;
    if (typeof id === "number" && Number.isInteger(id) && id > 0) {
      return `https://www.themoviedb.org/person/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

/** GET: Arahkan klik pemeran langsung ke halaman biografi eksternal (Wikipedia ID/EN -> TMDb). */
export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("name") ?? "").trim();
  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "Nama pemeran wajib diisi." },
      { status: 400 },
    );
  }

  const target =
    (await findWikipediaBio("id", name)) ??
    (await findWikipediaBio("en", name)) ??
    (await findTmdbPersonUrl(name)) ??
    `https://www.themoviedb.org/search/person?query=${encodeURIComponent(name)}`;

  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
