import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-cine-border bg-white pb-24 pt-8 sm:py-8">
      <div className="cine-container flex flex-col items-start justify-between gap-4 text-xs text-cine-muted sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-[2px] text-cine-maroon">CINÉ</span>
          <span>© {new Date().getFullYear()} CINÉ. Semua hak dilindungi.</span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/movies" className="hover:text-cine-maroon">
            Film
          </Link>
          <Link href="/cinema" className="hover:text-cine-maroon">
            Bioskop
          </Link>
          <Link href="/fnb" className="hover:text-cine-maroon">
            F&amp;B
          </Link>
          <Link href="/help" className="hover:text-cine-maroon">
            Bantuan
          </Link>
          <Link href="/account/settings" className="hover:text-cine-maroon">
            Pengaturan
          </Link>
        </div>
      </div>
    </footer>
  );
}
