import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/../supabase/types/database";
import { resolveMoviePoster } from "@/lib/assets";
import { cn } from "@/lib/utils";

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function MovieCard({
  movie,
  genreLabel,
  variant = "carousel",
}: {
  movie: Movie;
  genreLabel?: string;
  variant?: "carousel" | "grid";
}) {
  const poster = resolveMoviePoster(movie.poster_url, movie.slug || movie.id, movie.status);
  const subtitle = [
    genreLabel || (movie.age_rating ?? "Movie"),
    movie.status === "coming_soon" ? "Segera Tayang" : formatDuration(movie.duration_minutes),
  ].join(" · ");

  if (variant === "grid") {
    return (
      <Link
        href={`/movies/${movie.slug}`}
        className="cine-card-hover group flex flex-col gap-2 rounded-[20px] bg-cine-cream px-2.5 pb-3.5 pt-2.5"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[14px] bg-cine-border/40">
          <Image
            src={poster}
            alt={movie.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 224px"
            className="cine-img-zoom object-cover group-hover:scale-[1.06]"
          />
          {movie.age_rating && (
            <span className="absolute right-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {movie.age_rating}
            </span>
          )}
        </div>
        <h3 className="truncate text-sm font-semibold text-cine-ink transition-colors duration-200 group-hover:text-cine-maroon">
          {movie.title}
        </h3>
        <p className="truncate text-xs text-cine-muted">{subtitle}</p>
      </Link>
    );
  }

  return (
    <Link
      href={`/movies/${movie.slug}`}
      className={cn("group flex w-[148px] shrink-0 flex-col gap-2 sm:w-[173px]")}
    >
      <div className="relative h-[218px] w-full overflow-hidden rounded-[16px] bg-cine-cream transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-card-hover)] sm:h-[256px]">
        <Image
          src={poster}
          alt={movie.title}
          fill
          sizes="173px"
          className="cine-img-zoom object-cover group-hover:scale-[1.06]"
        />
        {movie.age_rating && (
          <span className="absolute right-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {movie.age_rating}
          </span>
        )}
      </div>
      <h3 className="truncate text-sm font-semibold text-cine-ink transition-colors duration-200 group-hover:text-cine-maroon">
        {movie.title}
      </h3>
      <p className="truncate text-xs text-cine-muted">{subtitle}</p>
    </Link>
  );
}
