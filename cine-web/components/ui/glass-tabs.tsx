"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type GlassTabItem = {
  key: string;
  label: string;
  href?: string;
};

type PillBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
  ready: boolean;
};

export default function GlassTabs({
  items,
  activeKey,
  onChange,
  className,
  variant = "track",
  scrollable = false,
}: {
  items: GlassTabItem[];
  activeKey: string;
  onChange?: (key: string) => void;
  className?: string;
  variant?: "track" | "plain";
  scrollable?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pill, setPill] = useState<PillBox>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
    ready: false,
  });

  const targetKey = hoveredKey ?? activeKey;

  const measure = useCallback(() => {
    const el = targetKey ? itemRefs.current[targetKey] : null;
    if (!el) {
      setPill((prev) => (prev.visible ? { ...prev, visible: false, ready: true } : prev));
      return;
    }
    setPill({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      visible: true,
      ready: true,
    });
  }, [targetKey]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure, items]);

  const track = (
    <div
      ref={containerRef}
      onMouseLeave={() => setHoveredKey(null)}
      className={cn(
        "relative inline-flex items-center gap-1 p-1",
        scrollable ? "flex-nowrap" : "flex-wrap",
        variant === "track" && "cine-glass-track",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "cine-glass-pill pointer-events-none absolute left-0 top-0",
          !pill.ready && "transition-none!",
        )}
        style={{
          width: pill.width,
          height: pill.height,
          transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
          opacity: pill.visible ? 1 : 0,
        }}
      />

      {items.map((item) => {
        const isCurrent = item.key === activeKey;
        const isLit = item.key === targetKey;
        const itemClass = cn(
          "relative z-10 cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-[13px] transition-colors duration-200 active:scale-[0.97]",
          variant === "plain" && "px-3.5 py-2 text-[15px]",
          isCurrent ? "font-semibold text-cine-maroon" : "font-medium text-cine-ink",
          isLit && !isCurrent && "text-cine-maroon",
        );

        const setRef = (node: HTMLElement | null) => {
          itemRefs.current[item.key] = node;
        };

        if (item.href) {
          return (
            <Link
              key={item.key}
              ref={setRef}
              href={item.href}
              onMouseEnter={() => setHoveredKey(item.key)}
              onFocus={() => setHoveredKey(item.key)}
              onBlur={() => setHoveredKey(null)}
              className={itemClass}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.key}
            ref={setRef}
            type="button"
            onClick={() => onChange?.(item.key)}
            onMouseEnter={() => setHoveredKey(item.key)}
            onFocus={() => setHoveredKey(item.key)}
            onBlur={() => setHoveredKey(null)}
            className={itemClass}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  if (scrollable) {
    return (
      <div className="no-scrollbar max-w-full overflow-x-auto pb-0.5">
        {track}
      </div>
    );
  }

  return track;
}
