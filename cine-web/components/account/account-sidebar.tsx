"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/account", label: "Akun Saya", exact: true },
  { href: "/account/addresses", label: "Daftar Alamat" },
  { href: "/account/cards", label: "Kartu Tersimpan" },
  { href: "/help", label: "Bantuan" },
  { href: "/account/settings", label: "Pengaturan" },
];

export default function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-row flex-wrap gap-2 md:w-[220px] md:shrink-0 md:flex-col md:gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-xl px-4 py-3 text-sm transition-colors",
              active
                ? "bg-cine-maroon font-semibold text-white"
                : "bg-cine-cream/60 font-normal text-cine-ink hover:bg-cine-cream",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
