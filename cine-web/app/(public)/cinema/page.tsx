import CinemaListClient from "@/components/cinema-list-client";
import { getCachedCinemasCatalog } from "@/lib/public-catalog";

export const revalidate = 60;

export default async function CinemaListPage() {
  const cinemas = await getCachedCinemasCatalog();
  return <CinemaListClient cinemas={cinemas} />;
}
