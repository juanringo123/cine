import QrScanner from "@/components/staff/qr-scanner";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  await requireRole(["admin", "staff"]);

  return (
    <main className="cine-container flex max-w-3xl flex-col gap-6 pb-20 pt-8">
      <div className="space-y-1">
        <p className="cine-caption uppercase tracking-wide">Petugas CINÉ</p>
        <h1 className="text-[32px] font-bold leading-tight text-cine-maroon">
          Scan QR Tiket
        </h1>
      </div>
      <QrScanner />
    </main>
  );
}
