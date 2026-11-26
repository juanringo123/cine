"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

function friendlyResetError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("for security purposes")) {
    return "Terlalu banyak permintaan. Tunggu beberapa saat sebelum mencoba lagi.";
  }
  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return "Format alamat email tidak valid.";
  }
  return msg;
}

/** Form permintaan tautan reset kata sandi lewat email Supabase Auth. */
export default function ForgotPasswordForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Masukkan alamat email akun CINÉ kamu.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo },
      );
      if (resetError) {
        setError(friendlyResetError(resetError.message));
        return;
      }
      setSentTo(trimmed);
    } catch (err) {
      setError(
        err instanceof Error ? friendlyResetError(err.message) : "Gagal mengirim tautan reset.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[440px] space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="CINÉ — Beranda" className="inline-flex items-center">
            <Image
              src="/assets/cine-logo.png"
              alt="CINÉ"
              width={551}
              height={314}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-cine-maroon hover:underline"
          >
            <ArrowLeft className="size-4" />
            Masuk
          </Link>
        </div>

        {sentTo ? (
          <div className="cine-card space-y-4 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-cine-ink">Tautan Reset Terkirim</h1>
              <p className="text-sm leading-relaxed text-cine-muted">
                Kami telah mengirimkan tautan untuk mengatur ulang kata sandi ke{" "}
                <span className="font-semibold text-cine-ink">{sentTo}</span>.
              </p>
              <p className="text-xs text-cine-muted">
                Periksa folder kotak masuk atau spam jika email belum terlihat.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-5 py-3 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
              >
                Kembali ke Halaman Masuk
              </Link>
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="cursor-pointer text-xs font-semibold text-cine-maroon hover:underline"
              >
                Kirim ke email lain
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-cine-cream px-3 py-1 text-xs font-semibold text-cine-maroon">
                <Mail className="size-3.5" />
                <span>Pemulihan Akun</span>
              </div>
              <h1 className="text-[26px] font-bold leading-tight text-cine-ink sm:text-[32px]">
                Lupa Kata Sandi?
              </h1>
              <p className="text-sm leading-relaxed text-cine-muted">
                Masukkan email yang terdaftar di CINÉ. Kami akan mengirimkan tautan
                untuk membuat kata sandi baru.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="cine-label block">Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="asepkopling@email.com"
                required
              />
            </label>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button type="submit" variant="gold" disabled={loading} className="w-full">
              {loading ? "Mengirim..." : "Kirim Tautan Reset"}
            </Button>

            <p className="text-center text-sm text-cine-muted">
              Ingat kata sandi kamu?{" "}
              <Link href="/login" className="font-bold text-cine-maroon hover:underline">
                Masuk di sini
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
