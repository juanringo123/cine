"use client";

import Image from "next/image";
import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import type { FnbVariant } from "@/../supabase/types/database";
import { resolveFnbImage } from "@/lib/assets";
import { formatRupiah } from "@/lib/utils";
import Button from "@/components/ui/button";

export default function FnbItemCard({
  item,
  variants,
}: {
  item: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    base_price: number;
    is_combo: boolean;
  };
  variants: FnbVariant[];
}) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);

  const active = variants.find((v) => v.id === variantId);
  const price = active?.price ?? item.base_price;
  const imgSrc = resolveFnbImage(item.image_url, item.name);

  return (
    <div className="cine-card-hover group flex flex-col gap-2.5 rounded-[20px] bg-cine-cream p-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-white">
        <Image
          src={imgSrc}
          alt={item.name}
          fill
          sizes="(max-width: 640px) 50vw, 246px"
          className="cine-img-zoom object-cover object-center group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <p className="truncate text-[15px] font-bold text-cine-ink">{item.name}</p>
        {item.description && (
          <p className="line-clamp-1 text-xs text-cine-muted">{item.description}</p>
        )}
        <p className="text-sm font-semibold text-cine-ink">{formatRupiah(price)}</p>

        {variants.length > 0 && (
          <select
            className="mt-1 rounded-[10px] border border-cine-border bg-white px-2.5 py-1.5 text-xs text-cine-ink focus:border-cine-maroon focus:outline-none"
            value={variantId ?? ""}
            onChange={(e) => setVariantId(e.target.value || null)}
          >
            <option value="">Reguler — {formatRupiah(item.base_price)}</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {formatRupiah(v.price)}
              </option>
            ))}
          </select>
        )}
      </div>

      <Button
        variant="gold"
        className="mt-auto w-full rounded-[10px] py-2.5 text-sm"
        onClick={() =>
          add({
            item_id: item.id,
            variant_id: variantId,
            name: item.name,
            variant_name: active?.name ?? null,
            price,
          })
        }
      >
        Tambah
      </Button>
    </div>
  );
}
