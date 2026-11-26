/**
 * Asset lokal yang diekspor dari Figma CINÉ (/public/assets/figma).
 * Menggantikan URL picsum.photos dari seed database jika belum ada gambar asli di Storage.
 */

export const FIGMA_ICONS = {
  pin: "/assets/figma/7e4ef.svg",
  chevron: "/assets/figma/d11fb.svg",
  bell: "/assets/figma/70817.svg",
  user: "/assets/figma/a4b92.svg",
  search: "/assets/figma/459ff.svg",
  play: "/assets/figma/8ab9e.svg",
  clap: "/assets/figma/342b4.svg",
  clock: "/assets/figma/cf01d.svg",
  calendar: "/assets/figma/fdfa3.svg",
  download: "/assets/figma/df230.svg",
  share: "/assets/figma/5a0f5.svg",
  check: "/assets/figma/4afec.svg",
  promoTicket: "/assets/figma/aa247.png",
} as const;

export const PAYMENT_METHOD_ICONS: Record<string, string> = {
  qris: "/assets/figma/b063b.png",
  gopay: "/assets/figma/03107.png",
  ovo: "/assets/figma/91e39.png",
  bank_transfer: "/assets/figma/845c1.png",
  card: "/assets/figma/d2270.png",
};

const NOW_SHOWING_POSTERS = [
  "/assets/figma/8dfc3.png",
  "/assets/figma/1ea92.png",
  "/assets/figma/24b2c.png",
  "/assets/figma/53ddf.png",
  "/assets/figma/72c54.png",
  "/assets/figma/676b8.png",
  "/assets/figma/3e24c.png",
  "/assets/figma/a8363.png",
  "/assets/figma/2077d.png",
  "/assets/figma/b1d35.png",
  "/assets/figma/abd4f.png",
];

const COMING_SOON_POSTERS = [
  "/assets/figma/d2dd6.png",
  "/assets/figma/bf4c8.png",
  "/assets/figma/bc02c.png",
  "/assets/figma/b270f.png",
  "/assets/figma/5399a.png",
  "/assets/figma/7ed98.png",
  "/assets/figma/e959e.png",
  "/assets/figma/6ec86.png",
  "/assets/figma/7fdab.png",
];

const CAST_PHOTOS = [
  "/assets/figma/d2ecb.png",
  "/assets/figma/32c08.png",
  "/assets/figma/25bd5.png",
  "/assets/figma/86b4c.png",
  "/assets/figma/1c20b.png",
  "/assets/figma/ade6b.png",
  "/assets/figma/db847.png",
  "/assets/figma/20e12.png",
  "/assets/figma/9decb.png",
  "/assets/figma/bdcc9.png",
  "/assets/figma/d3e44.png",
  "/assets/figma/3c4f1.png",
  "/assets/figma/1348f.png",
  "/assets/figma/90c91.png",
];

const DEFAULT_BACKDROP = "/assets/figma/cc1dc.png";

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function isUsableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes("picsum.photos")) return false;
  return true;
}

export function resolveMoviePoster(
  url: string | null | undefined,
  seed: string,
  status?: string,
): string {
  if (isUsableImageUrl(url)) return url;
  const pool = status === "coming_soon" ? COMING_SOON_POSTERS : NOW_SHOWING_POSTERS;
  return pool[hashSeed(seed) % pool.length];
}

export function resolveMovieBackdrop(url: string | null | undefined): string {
  if (isUsableImageUrl(url)) return url;
  return DEFAULT_BACKDROP;
}

export function resolveCastPhoto(url: string | null | undefined, seed: string): string {
  if (isUsableImageUrl(url)) return url;
  return CAST_PHOTOS[hashSeed(seed) % CAST_PHOTOS.length];
}

const CINEMA_IMAGES = [
  "/assets/cinema/cinema-1.svg",
  "/assets/cinema/cinema-2.svg",
  "/assets/cinema/cinema-3.svg",
];

const FNB_IMAGES = {
  popcorn: "/assets/fnb/popcorn-caramel.jpg",
  drink: "/assets/fnb/cola.jpg",
  snack: "/assets/fnb/nachos-keju.jpg",
  combo: "/assets/fnb/combo-solo.jpg",
};

export function resolveCinemaImage(url: string | null | undefined, seed: string): string {
  if (isUsableImageUrl(url)) return url;
  return CINEMA_IMAGES[hashSeed(seed) % CINEMA_IMAGES.length];
}

export function resolveFnbImage(url: string | null | undefined, seed: string): string {
  if (isUsableImageUrl(url)) return url;
  const s = seed.toLowerCase();
  if (s.includes("combo") || s.includes("paket")) return FNB_IMAGES.combo;
  if (s.includes("popcorn")) return FNB_IMAGES.popcorn;
  if (
    s.includes("cola") ||
    s.includes("teh") ||
    s.includes("mineral") ||
    s.includes("minum") ||
    s.includes("drink") ||
    s.includes("tea") ||
    s.includes("juice") ||
    s.includes("water")
  ) {
    return FNB_IMAGES.drink;
  }
  return FNB_IMAGES.snack;
}
