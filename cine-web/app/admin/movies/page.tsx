import MovieManager from "@/components/admin/movie-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminMovies() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: movies } = await supabase.from("movies").select("*").order("title");

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Kelola Film</h2>
      <MovieManager movies={movies ?? []} />
    </div>
  );
}
