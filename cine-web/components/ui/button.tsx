import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "gold" | "cream" | "ghost";

export default function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold leading-none transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variant === "primary" && "bg-cine-maroon text-white hover:bg-cine-maroon-dark",
        variant === "outline" &&
          "border border-cine-maroon bg-white text-cine-maroon hover:bg-cine-maroon/5",
        variant === "gold" && "bg-cine-gold text-cine-ink hover:bg-cine-gold-dark",
        variant === "cream" &&
          "border border-cine-border bg-cine-cream text-cine-ink hover:bg-cine-border/40",
        variant === "ghost" && "bg-transparent text-cine-ink hover:bg-cine-cream",
        className,
      )}
      {...props}
    />
  );
}
