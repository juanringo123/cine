"use client";

import { useMemo, useState } from "react";
import AccountSidebar from "@/components/account/account-sidebar";
import Button from "@/components/ui/button";
import { FIGMA_ICONS } from "@/lib/assets";

type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

export default function HelpClient({ faqs }: { faqs: FaqItem[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q),
    );
  }, [faqs, query]);

  return (
    <main className="cine-container flex flex-col gap-6 pb-20 pt-8">
      <h1 className="text-[36px] font-bold leading-tight text-cine-ink">Bantuan</h1>

      <div className="flex flex-col gap-10 md:flex-row md:items-start">
        <AccountSidebar />

        <div className="min-w-0 flex-1 space-y-6">
          <div className="cine-search w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FIGMA_ICONS.search} alt="" width={18} height={18} className="size-[18px] shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari bantuan"
              className="w-full bg-transparent text-sm text-cine-ink placeholder:text-cine-placeholder focus:outline-none"
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-cine-ink">Pertanyaan umum</h2>

            <div className="cine-card divide-y divide-cine-border px-5">
              {filtered.map((item) => {
                const open = openId === item.id;
                return (
                  <div key={item.id} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : item.id)}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 text-left text-sm font-semibold text-cine-ink"
                    >
                      <span>{item.question}</span>
                      <span className="text-lg text-cine-muted">{open ? "−" : "+"}</span>
                    </button>
                    {open && (
                      <p className="mt-2 text-sm leading-relaxed text-cine-muted">
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-6 text-sm text-cine-muted">
                  Tidak ada pertanyaan yang cocok.
                </p>
              )}
            </div>
          </div>

          <div className="cine-card max-w-[380px] space-y-4 p-6">
            <h3 className="text-lg font-bold text-cine-ink">Hubungi kami</h3>
            <div className="space-y-0.5 text-sm">
              <p className="text-xs text-cine-muted">Email</p>
              <p className="font-medium text-cine-ink">bantuan@cine.id</p>
            </div>
            <div className="space-y-0.5 text-sm">
              <p className="text-xs text-cine-muted">Telepon</p>
              <p className="font-medium text-cine-ink">021-5555-0199</p>
            </div>
            <a href="mailto:bantuan@cine.id" className="block">
              <Button variant="gold" className="w-full">
                Chat Customer Service
              </Button>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
