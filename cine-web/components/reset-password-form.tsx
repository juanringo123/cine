"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

type SessionState = "checking" | "ready" | "invalid";

/** Form buat kata sandi baru setelah mengklik tautan reset dari email. */
export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const errorParam = searchParams.get("error");
  const codeParam = searchParams.get("code");

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    if (errorParam === "expired") {
      setSessionState("invalid");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionState("ready");
      }
    });

    async function verifySession() {
      if (codeParam) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(codeParam);
        if (!active) return;
        if (exErr) {
          setSessionState("invalid");
          return;
        }
        setSessionState("ready");
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        setSessionState("ready");
        return;
      }

      const hasHashToken =
        typeof window !== "undefined" &&
        (window.location.hash.includes("access_token") ||
          window.location.hash.includes("type=recovery"));

      if (hasHashToken) {
        timer = window.setTimeout(() => {
          if (active) setSessionState((prev) => (prev === "checking" ? "invalid" : prev));
        }, 1500);
      } else {
        setSessionState("invalid");
      }
    }

    void verifySession();

    return () => {
      active = false;
      subscription.unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [supabase, errorParam, codeParam]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi baru tidak sama.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui kata sandi.");
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
          <Link href="/login" className="text-sm font-semibold text-cine-maroon hover:underline">
            Masuk
          </Link>
        </div>

        {done ? (
          <div className="cine-card space-y-4 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-cine-ink">Kata Sandi Diperbarui</h1>
              <p className="text-sm text-cine-muted">
                Kata sandi akun CINÉ kamu sudah berhasil diganti. Silakan masuk kembali.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-5 py-3 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
            >
              Masuk dengan Kata Sandi Baru
            </Link>
          </div>
        ) : sessionState === "checking" ? (
          <div className="cine-card p-6 text-center text-sm text-cine-muted">
            Memverifikasi tautan pemulihan kata sandi...
          </div>
        ) : sessionState === "invalid" ? (
          <div className="cine-card space-y-4 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-cine-ink">Tautan Tidak Valid atau Kedaluwarsa</h1>
              <p className="text-sm text-cine-muted">
                Tautan reset kata sandi sudah tidak berlaku atau telah digunakan. Minta tautan baru untuk melanjutkan.
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="inline-flex w-full items-center justify-center rounded-xl bg-cine-gold px-5 py-3 text-sm font-bold text-cine-ink transition-colors hover:bg-cine-gold-dark"
            >
              Minta Tautan Reset Baru
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-cine-cream px-3 py-1 text-xs font-semibold text-cine-maroon">
                <Lock className="size-3.5" />
                <span>Buat Kata Sandi Baru</span>
              </div>
              <h1 className="text-[26px] font-bold leading-tight text-cine-ink sm:text-[32px]">
                Atur Ulang Kata Sandi
              </h1>
              <p className="text-sm text-cine-muted">
                Masukkan kata sandi baru minimal 6 karakter untuk akun CINÉ kamu.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="cine-label block">Kata Sandi Baru</span>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-cine-muted hover:text-cine-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            <label className="block space-y-2">
              <span className="cine-label block">Konfirmasi Kata Sandi Baru</span>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                required
                minLength={6}
              />
            </label>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button type="submit" variant="gold" disabled={loading} className="w-full">
              {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
