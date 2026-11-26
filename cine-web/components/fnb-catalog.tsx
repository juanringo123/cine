"use client";

import { useMemo, useState } from "react";
import type { FnbItem, FnbVariant, Tables } from "@/../supabase/types/database";
import FnbItemCard from "@/components/fnb-item-card";
import CartPanel from "@/components/cart-panel";
import GlassTabs from "@/components/ui/glass-tabs";

type FnbCategory = Tables<"fnb_categories">;

export default function FnbCatalog({
  categories,
  items,
  variants,
  cinemas,
}: {
  categories: FnbCategory[];
  items: FnbItem[];
  variants: FnbVariant[];
  cinemas: { id: string; name: string; city: string }[];
}) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    categories[0]?.id ?? "all",
  );

  const variantsByItem = useMemo(() => {
    const map = new Map<string, FnbVariant[]>();
    variants.forEach((v) => {
      const list = map.get(v.item_id) ?? [];
      list.push(v);
      map.set(v.item_id, list);
    });
    return map;
  }, [variants]);

  const visibleItems = useMemo(() => {
    if (activeCategoryId === "all") return items;
    return items.filter((item) => item.category_id === activeCategoryId);
  }, [items, activeCategoryId]);

  return (
    <main className="cine-container flex flex-col gap-7 pb-20 pt-8">
      <div className="space-y-4">
        <h1 className="text-[28px] font-bold leading-tight text-cine-ink sm:text-[36px]">F&amp;B</h1>

        <GlassTabs
          scrollable
          items={[
            ...categories.map((cat) => ({ key: cat.id, label: cat.name })),
            { key: "all", label: "Semua" },
          ]}
          activeKey={activeCategoryId}
          onChange={setActiveCategoryId}
        />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_328px]">
        <div>
          {visibleItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <FnbItemCard
                  key={item.id}
                  item={item}
                  variants={variantsByItem.get(item.id) ?? []}
                />
              ))}
            </div>
          ) : (
            <div className="cine-card p-8 text-center text-sm text-cine-muted">
              Belum ada menu pada kategori ini.
            </div>
          )}
        </div>

        <CartPanel cinemas={cinemas} />
      </div>
    </main>
  );
}
