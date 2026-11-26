import Link from "next/link";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Ringkasan", adminOnly: false },
  { href: "/admin/movies", label: "Film", adminOnly: true },
  { href: "/admin/showtimes", label: "Jadwal", adminOnly: true },
  { href: "/admin/promos", label: "Promo", adminOnly: true },
  { href: "/admin/fnb-orders", label: "Pesanan F&B", adminOnly: false },
  { href: "/admin/bookings", label: "Booking", adminOnly: false },
  { href: "/admin/studios", label: "Studio", adminOnly: true },
  { href: "/staff/scan", label: "Scan QR", adminOnly: false },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["admin", "staff"]);
  const visibleNav = nav.filter(
    (item) => !item.adminOnly || profile.role === "admin",
  );

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="cine-caption uppercase tracking-wide">Panel CINÉ</p>
          <h1 className="text-[32px] font-bold leading-tight text-cine-maroon">Admin</h1>
        </div>
        <p className="rounded-xl border border-cine-border bg-cine-cream px-4 py-2 text-sm font-medium text-cine-ink">
          {profile.full_name} · {profile.role}
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {visibleNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[10px] border border-cine-border bg-white px-4 py-2 text-[13px] font-bold text-cine-ink transition-colors hover:border-cine-maroon hover:bg-cine-cream"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </main>
  );
}
