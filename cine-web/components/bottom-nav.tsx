"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, HelpCircle, MapPin, Ticket, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/#promo", label: "Promo", icon: Ticket, match: (p: string) => p === "/" },
  { href: "/cinema", label: "Bioskop", icon: MapPin, match: (p: string) => p.startsWith("/cinema") },
  { href: "/movies", label: "Film", icon: Film, match: (p: string) => p.startsWith("/movies") },
  { href: "/account", label: "Akun", icon: User, match: (p: string) => p.startsWith("/account") },
  { href: "/help", label: "Bantuan", icon: HelpCircle, match: (p: string) => p.startsWith("/help") },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi bawah"
      className="cine-glass-nav fixed inset-x-0 bottom-0 z-30 border-t border-cine-border/80 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="grid grid-cols-5 px-1.5 py-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-full py-2 text-[11px] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95",
                active ? "cine-glass-pill font-semibold text-cine-maroon" : "text-cine-muted hover:text-cine-ink",
              )}
            >
              <Icon className="size-4" strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
