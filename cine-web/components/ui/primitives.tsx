import Link from "next/link";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("cine-input", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("cine-input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("cine-input min-h-24", className)} {...props} />;
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-[13px] text-cine-ink", className)}>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          checked
            ? "border-cine-maroon bg-cine-maroon"
            : "border-cine-border bg-white",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        {checked && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/assets/figma/4afec.svg" alt="" width={14} height={14} className="size-3.5" />
        )}
      </span>
      {label}
    </label>
  );
}

export function Card({
  children,
  className,
  bordered = false,
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div className={cn(bordered ? "cine-card-bordered" : "cine-card", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  variant = "cream",
  className,
}: {
  children: ReactNode;
  variant?: "cream" | "maroon" | "gold" | "white";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
        variant === "cream" && "bg-cine-cream text-cine-ink",
        variant === "maroon" && "bg-cine-maroon text-white",
        variant === "gold" && "bg-cine-gold text-cine-ink",
        variant === "white" && "border border-cine-border bg-white text-cine-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  title,
  href,
  actionLabel = "Lihat Semua",
}: {
  title: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-2xl font-bold text-cine-ink">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-cine-maroon transition-colors duration-200 hover:underline">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function BackHeader({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <div className="flex items-center gap-6">
      <Link
        href={href}
        aria-label="Kembali"
        className="inline-flex size-9 items-center justify-center rounded-xl text-[32px] font-bold leading-none text-black transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-x-0.5 hover:bg-cine-cream active:scale-95"
      >
        &lt;
      </Link>
      <h1 className="text-[32px] font-bold leading-tight text-cine-ink">{title}</h1>
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = "sm",
}: {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "size-[60px]" : "size-9";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-cine-border bg-cine-cream",
        dim,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? "User"} className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/assets/figma/a4b92.svg"
          alt={name ?? "User"}
          className={size === "lg" ? "size-[30px]" : "size-[18px]"}
        />
      )}
    </span>
  );
}
