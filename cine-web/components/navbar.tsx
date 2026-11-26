"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapPin, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/components/cart-provider";
import NotificationBell from "@/components/notification-bell";
import GlassTabs, { type GlassTabItem } from "@/components/ui/glass-tabs";
import { Avatar } from "@/components/ui/primitives";
import { FIGMA_ICONS } from "@/lib/assets";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  {
    href: "/movies",
    label: "Movie",
    match: (p: string) => p.startsWith("/movies") || p.startsWith("/showtimes"),
  },
  {
    href: "/cinema",
    label: "Cinema",
    match: (p: string) => p.startsWith("/cinema"),
  },
  { href: "/fnb", label: "F&B", match: (p: string) => p.startsWith("/fnb") || p.startsWith("/order") },
  {
    href: "/my-bookings",
    label: "My Booking",
    match: (p: string) =>
      p.startsWith("/my-bookings") ||
      p.startsWith("/booking") ||
      p.startsWith("/ticket") ||
      p.startsWith("/payment"),
  },
];

const CITIES = ["Semua", "Jakarta", "Depok", "Bandung", "Bogor", "Bekasi", "Tangerang"];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const supabase = useMemo(() => createClient(), []);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isStaffOrAdmin, setIsStaffOrAdmin] = useState(false);
  const [city, setCity] = useState("Depok");
  const [cityOpen, setCityOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [cityPill, setCityPill] = useState({ top: 0, height: 0, ready: false });
  const cityMenuRef = useRef<HTMLDivElement>(null);
  const cityBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("cine_city") : null;
    if (saved) setCity(saved);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    const mq = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (mq.matches) setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    mq.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      mq.removeEventListener("change", onResize);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!cityOpen) return;
    const onDown = (e: MouseEvent) => {
      if (cityMenuRef.current && !cityMenuRef.current.contains(e.target as Node)) {
        setCityOpen(false);
        setHoveredCity(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [cityOpen]);

  useLayoutEffect(() => {
    if (!cityOpen) {
      setCityPill((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    const target = hoveredCity ?? city;
    const el = cityBtnRefs.current[target];
    if (!el) return;
    setCityPill({ top: el.offsetTop, height: el.offsetHeight, ready: true });
  }, [cityOpen, hoveredCity, city]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!active) return;

      if (!user) {
        setDisplayName(null);
        setAvatarUrl(null);
        setIsStaffOrAdmin(false);
        return;
      }

      const fallback =
        (user.user_metadata?.nickname as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
        user.email?.split("@")[0] ||
        "User";

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, full_name, avatar_url, city, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      const label =
        profile?.nickname ||
        profile?.full_name?.split(" ")[0] ||
        fallback;
      setDisplayName(label);
      setAvatarUrl(profile?.avatar_url ?? null);
      setIsStaffOrAdmin(profile?.role === "admin" || profile?.role === "staff");
      if (profile?.city && !window.localStorage.getItem("cine_city")) {
        setCity(profile.city);
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => loadSession());
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  function selectCity(next: string) {
    setCity(next);
    setCityOpen(false);
    setMobileMenuOpen(false);
    setHoveredCity(null);
    window.localStorage.setItem("cine_city", next);
    window.dispatchEvent(new CustomEvent("cine:city-change", { detail: next }));
    router.refresh();
  }

  const navItems = useMemo<GlassTabItem[]>(() => {
    const base: GlassTabItem[] = NAV_LINKS.map((l) => ({
      key: l.href,
      label: l.label,
      href: l.href,
    }));
    if (isStaffOrAdmin) {
      base.push(
        { key: "/admin", label: "Admin", href: "/admin" },
        { key: "/staff/scan", label: "Scan QR", href: "/staff/scan" },
      );
    }
    return base;
  }, [isStaffOrAdmin]);

  const activeNavKey = useMemo(() => {
    const matched = NAV_LINKS.find((l) => l.match(pathname));
    if (matched) return matched.href;
    if (pathname.startsWith("/admin")) return "/admin";
    if (pathname.startsWith("/staff")) return "/staff/scan";
    return "";
  }, [pathname]);

  return (
    <>
      <header className="cine-glass-nav sticky top-0 z-40 h-[64px] border-b border-cine-border/80 sm:h-[72px]">
        <nav className="cine-container flex h-full items-center justify-between gap-2 sm:gap-4">
          <div className="flex h-full items-center gap-4 lg:gap-6">
            <Link
              href="/"
              aria-label="CINÉ — Beranda"
              className="-mt-[5px] flex shrink-0 items-center transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] active:scale-[0.98] sm:-mt-[7px]"
            >
              <Image
                src="/assets/cine-logo.png"
                alt="CINÉ"
                width={551}
                height={314}
                priority
                className="h-[36px] w-auto object-contain drop-shadow-[0_1px_1px_rgba(109,31,46,0.22)] sm:h-[46px]"
              />
            </Link>

            <GlassTabs
              items={navItems}
              activeKey={activeNavKey}
              variant="plain"
              className="hidden lg:inline-flex"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
            {/* Pill Lokasi (desktop & tablet; mobile di dalam drawer) */}
            <div ref={cityMenuRef} className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setCityOpen((v) => !v);
                }}
                aria-expanded={cityOpen}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full px-4 py-[9px] text-sm font-medium text-cine-ink active:scale-[0.98]",
                  cityOpen ? "cine-glass-pill text-cine-maroon" : "cine-glass-control",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FIGMA_ICONS.pin} alt="" width={16} height={16} className="size-4" />
                <span>{city}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={FIGMA_ICONS.chevron}
                  alt=""
                  width={16}
                  height={16}
                  className={cn("size-4 transition-transform duration-200", cityOpen && "rotate-180")}
                />
              </button>
              {cityOpen && (
                <div
                  onMouseLeave={() => setHoveredCity(null)}
                  className="cine-popover-enter cine-glass-surface absolute right-0 top-12 z-50 w-44 rounded-2xl p-1.5"
                >
                  <div className="relative flex flex-col gap-0.5">
                    <span
                      aria-hidden
                      className={cn(
                        "cine-glass-pill pointer-events-none absolute inset-x-0 top-0",
                        !cityPill.ready && "transition-none!",
                      )}
                      style={{
                        height: cityPill.height,
                        transform: `translate3d(0, ${cityPill.top}px, 0)`,
                        opacity: cityPill.ready ? 1 : 0,
                      }}
                    />
                    {CITIES.map((c) => {
                      const active = c === city;
                      const lit = c === (hoveredCity ?? city);
                      return (
                        <button
                          key={c}
                          ref={(el) => {
                            cityBtnRefs.current[c] = el;
                          }}
                          type="button"
                          onClick={() => selectCity(c)}
                          onMouseEnter={() => setHoveredCity(c)}
                          onFocus={() => setHoveredCity(c)}
                          onBlur={() => setHoveredCity(null)}
                          className={cn(
                            "relative z-10 block w-full cursor-pointer rounded-full px-3.5 py-2 text-left text-sm transition-colors duration-150",
                            active ? "font-semibold text-cine-maroon" : "font-medium text-cine-ink",
                            lit && !active && "text-cine-maroon",
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Keranjang F&B badge (tablet & desktop; di HP tampil di dalam drawer) */}
            {count > 0 && (
              <Link
                href="/fnb"
                className="relative hidden rounded-xl border border-cine-border bg-cine-cream px-2.5 py-1.5 text-xs font-semibold text-cine-ink transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-cine-maroon active:scale-95 sm:inline-flex"
                aria-label="Keranjang F&B"
              >
                F&B ({count})
              </Link>
            )}

            {/* Ikon Notifikasi */}
            <NotificationBell />

            {/* User Profile / Daftar-Masuk */}
            {displayName ? (
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-full transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:opacity-80 active:scale-[0.98]"
              >
                <Avatar name={displayName} src={avatarUrl} size="sm" />
                <span className="hidden max-w-28 truncate text-sm font-semibold text-cine-ink sm:inline">
                  {displayName}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-[10px] border border-cine-border bg-cine-cream px-3 text-xs font-medium text-black transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-cine-border/40 active:scale-[0.98] sm:px-4 sm:text-sm"
              >
                <span className="sm:hidden">Masuk</span>
                <span className="hidden sm:inline">Daftar/Masuk</span>
              </Link>
            )}

            {/* Tombol Hamburger untuk mobile & tablet (< lg) */}
            <button
              type="button"
              onClick={() => {
                setCityOpen(false);
                setMobileMenuOpen((v) => !v);
              }}
              aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              className="cine-glass-control relative flex size-9 cursor-pointer items-center justify-center rounded-xl text-cine-ink active:scale-95 sm:size-10 lg:hidden"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              {count > 0 && !mobileMenuOpen && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-cine-maroon text-[10px] font-bold text-white sm:hidden">
                  {count}
                </span>
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* Drawer Navigasi Mobile & Tablet — di luar <header> agar tidak terjebak backdrop-filter / z-index */}
      {mobileMenuOpen && (
        <>
          <div
            aria-hidden
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 top-[64px] z-[60] bg-black/30 backdrop-blur-[2px] sm:top-[72px] lg:hidden"
          />
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-label="Menu navigasi"
            className="cine-glass-surface cine-drawer-in fixed inset-x-3 top-[72px] z-[70] max-h-[calc(100dvh-88px)] overflow-y-auto rounded-[24px] p-4 sm:inset-x-auto sm:right-6 sm:top-[80px] sm:w-[360px] lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const active = item.key === activeNavKey;
                return (
                  <Link
                    key={item.key}
                    href={item.href ?? "/"}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex min-h-[44px] items-center justify-between rounded-2xl px-4 py-3 text-sm transition-colors duration-150",
                      active
                        ? "cine-glass-pill font-semibold text-cine-maroon"
                        : "font-medium text-cine-ink hover:bg-cine-cream/80",
                    )}
                  >
                    <span>{item.label}</span>
                    {item.key === "/fnb" && count > 0 && (
                      <span className="rounded-full bg-cine-maroon px-2 py-0.5 text-[11px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="my-3 h-px bg-cine-border/80" />

            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cine-muted">
                <MapPin className="size-3.5 text-cine-maroon" />
                <span>Pilih Kota</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CITIES.map((c) => {
                  const active = c === city;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => selectCity(c)}
                      className={cn(
                        "cursor-pointer rounded-full px-3 py-1.5 text-xs transition-colors duration-150",
                        active
                          ? "bg-cine-maroon font-semibold text-white"
                          : "border border-cine-border bg-white/80 font-medium text-cine-ink hover:border-cine-maroon",
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="my-3 h-px bg-cine-border/80" />

            {displayName ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 px-1">
                  <Avatar name={displayName} src={avatarUrl} size="sm" />
                  <span className="truncate text-sm font-semibold text-cine-ink">
                    {displayName}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl bg-cine-gold px-3 py-2.5 text-center text-xs font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
                  >
                    Akun Saya
                  </Link>
                  <Link
                    href="/notifications"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl border border-cine-border bg-white px-3 py-2.5 text-center text-xs font-semibold text-cine-ink transition-colors hover:border-cine-maroon"
                  >
                    Notifikasi
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-cine-gold px-3 py-2.5 text-center text-xs font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl border border-cine-border bg-white px-3 py-2.5 text-center text-xs font-semibold text-cine-ink transition-colors hover:border-cine-maroon"
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
