import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const profile = await requireRole(["admin", "staff"]);
  const supabase = await createClient();

  const [{ count: movieCount }, { count: showCount }, { count: orderCount }, { count: bookingCount }] =
    await Promise.all([
      supabase.from("movies").select("id", { count: "exact", head: true }),
      supabase.from("showtimes").select("id", { count: "exact", head: true }),
      supabase.from("fnb_orders").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
    ]);

  const cards = [
    { label: "Film", value: movieCount ?? 0, href: "/admin/movies" },
    { label: "Jadwal", value: showCount ?? 0, href: "/admin/showtimes" },
    { label: "Pesanan F&B", value: orderCount ?? 0, href: "/admin/fnb-orders" },
    { label: "Booking", value: bookingCount ?? 0, href: "/admin/bookings" },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-cine-muted">
        Halo {profile.full_name ?? profile.role}, kelola konten dan pesanan dari sini.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="cine-card-bordered p-6 transition-colors hover:border-cine-maroon"
          >
            <p className="cine-caption">{card.label}</p>
            <p className="mt-1 text-3xl font-bold text-cine-maroon">{card.value}</p>
          </Link>
        ))}
      </div>
      {profile.role === "staff" && (
        <p className="text-xs text-cine-muted">
          Role staff: bisa mengelola pesanan &amp; booking serta scan QR. Untuk mengubah film/jadwal/promo, gunakan akun admin.
        </p>
      )}
    </div>
  );
}
