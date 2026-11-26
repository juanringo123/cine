"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { FIGMA_ICONS } from "@/lib/assets";

export default function TicketActions({
  code,
  qrUrl,
}: {
  code: string;
  qrUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Tiket CINÉ ${code}`, url });
        return;
      } catch {
        // user membatalkan share
      }
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <a
        href={qrUrl}
        download={`${code}-qr.png`}
        className="inline-flex items-center gap-2 rounded-xl bg-cine-gold px-7 py-3.5 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FIGMA_ICONS.download} alt="" width={18} height={18} className="size-[18px]" />
        <span>Download</span>
      </a>
      <Button type="button" variant="outline" onClick={share}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FIGMA_ICONS.share} alt="" width={18} height={18} className="size-[18px]" />
        <span>{copied ? "Link Disalin" : "Share"}</span>
      </Button>
    </div>
  );
}
