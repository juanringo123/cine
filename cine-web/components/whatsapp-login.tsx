"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

export default function WhatsappLogin() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/whatsapp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as {
        sent?: boolean; dev_code?: string; note?: string; error?: string; to?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Gagal mengirim kode.");
      setDevCode(data.dev_code ?? null);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await response.json()) as {
        verified?: boolean; token_hash?: string; error?: string;
      };
      if (!response.ok || !data.verified || !data.token_hash) {
        throw new Error(data.error ?? "Kode tidak valid.");
      }
      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={step === 1 ? requestOtp : verify}
      className="cine-card mx-auto w-full max-w-md space-y-5 p-8"
    >
      <div className="space-y-1">
        <p className="cine-caption">Masuk dengan nomor terdaftar</p>
        <h1 className="text-2xl font-bold text-cine-ink">Login WhatsApp</h1>
      </div>

      {step === 1 ? (
        <>
          <label className="block space-y-2">
            <span className="cine-label block">No. WhatsApp</span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08123456789"
              required
            />
          </label>
          <p className="text-xs text-cine-muted">
            Kode OTP akan dikirim ke nomor yang terdaftar saat daftar.
          </p>
        </>
      ) : (
        <>
          <label className="block space-y-2">
            <span className="cine-label block">Kode OTP (6 digit)</span>
            <Input
              className="text-center text-lg font-bold tracking-[0.35em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              required
            />
          </label>
          {devCode && (
            <div className="rounded-xl border border-cine-border bg-white p-3.5 text-sm text-cine-ink">
              <strong className="text-cine-maroon">MODE DEV</strong> — kode OTP kamu:{" "}
              <span className="font-mono font-bold">{devCode}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="cursor-pointer text-xs font-semibold text-cine-maroon underline"
          >
            Ganti nomor
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit" variant="gold" disabled={loading} className="w-full">
        {loading ? "Tunggu..." : step === 1 ? "Kirim Kode" : "Verifikasi & Masuk"}
      </Button>

      <p className="text-center text-xs text-cine-muted">
        <Link href="/login" className="font-semibold text-cine-maroon hover:underline">
          ← Kembali ke login email
        </Link>
      </p>
    </form>
  );
}
