"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/primitives";
import { FIGMA_ICONS } from "@/lib/assets";

type Mode = "login" | "register";

export default function AuthForm({
  mode,
  cinemas = [],
}: {
  mode: Mode;
  cinemas?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("Depok");
  const [preferredCinema, setPreferredCinema] = useState(cinemas[0]?.id ?? "");
  const [agree, setAgree] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        if (!agree) throw new Error("Kamu harus menyetujui syarat & ketentuan.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!agree) throw new Error("Kamu harus menyetujui syarat & ketentuan.");
        if (password !== confirmPassword) {
          throw new Error("Konfirmasi kata sandi tidak sama.");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              nickname: nickname || fullName.split(" ")[0],
              phone,
              birth_date: birthDate || null,
              gender: gender || null,
              city,
              preferred_cinema_id: preferredCinema || null,
              terms_accepted: "true",
              terms_version: "2026-01",
            },
          },
        });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "login") {
    return (
      <div className="grid min-h-screen bg-white lg:grid-cols-2">
        {/* Panel kiri: Gradient Maroon khas Figma */}
        <div
          className="hidden flex-col justify-between p-14 text-white lg:flex"
          style={{
            backgroundImage:
              "linear-gradient(128.66deg, rgb(46, 42, 43) 0%, rgb(109, 31, 46) 100%)",
          }}
        >
          <Link
            href="/"
            aria-label="CINÉ — Beranda"
            className="inline-flex w-fit items-baseline font-serif text-[42px] font-normal leading-none tracking-[0.06em] text-cine-cream"
          >
            <span>CIN</span>
            <span className="relative inline-block">
              <span>É</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute -right-1.5 -top-2 size-4 text-cine-gold"
                fill="currentColor"
              >
                <path d="M12 1l2.3 8.7L23 12l-8.7 2.3L12 23l-2.3-8.7L1 12l8.7-2.3z" />
              </svg>
            </span>
          </Link>

          <div className="flex flex-col items-center gap-7">
            <div className="h-[110px] w-full max-w-[400px] rounded-[14px] bg-white/25" />
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-3">
                  {Array.from({ length: 9 }).map((_, col) => (
                    <div key={col} className="flex flex-col items-center gap-0.5">
                      <div className="h-3 w-[18px] rounded-[5px] bg-cine-cream" />
                      <div className="h-1.5 w-6 rounded-[3px] bg-cine-cream" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-serif text-[34px] font-normal italic leading-tight tracking-[0.01em] text-cine-gold">
              Every CINÉ Has a Story
            </h2>
            <p className="font-serif text-base leading-relaxed text-cine-cream/90">
              Pesan tiket, pilih kursi, dan masuk bioskop tanpa antre.
            </p>
          </div>
        </div>

        {/* Panel kanan: Form Login */}
        <div className="flex flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <form onSubmit={submit} className="w-full max-w-[440px] space-y-5">
            <div className="lg:hidden">
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
            </div>

            <div className="space-y-2">
              <h1 className="text-[26px] font-bold leading-tight text-cine-ink sm:text-[32px]">
                Hello, Movie Enthusiast
              </h1>
              <p className="text-[15px] text-cine-muted">
                Sudah siap merasakan pengalaman menonton yang tidak terlupakan?
              </p>
            </div>

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="asepkopling@email.com"
                required
              />
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="login-password" className="cine-label block">
                  Kata Sandi
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-cine-maroon hover:underline"
                >
                  Lupa kata sandi?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <Checkbox
              checked={agree}
              onChange={setAgree}
              label={
                <span>
                  Saya menyetujui{" "}
                  <span className="font-bold text-cine-maroon">Syarat dan Ketentuan</span>{" "}
                  yang berlaku
                </span>
              }
            />

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button type="submit" variant="gold" disabled={loading} className="w-full">
              {loading ? "Tunggu..." : "Masuk"}
            </Button>

            <div className="space-y-2 pt-1 text-center text-sm">
              <p className="text-cine-ink">
                Belum punya akun?{" "}
                <Link href="/register" className="font-bold text-cine-maroon hover:underline">
                  Daftar di sini
                </Link>
              </p>
              <p className="text-cine-muted">
                atau{" "}
                <Link href="/whatsapp" className="font-semibold text-cine-maroon underline">
                  masuk dengan WhatsApp OTP
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Register (Figma 1:418)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8 sm:px-6 sm:py-12">
      <form onSubmit={submit} className="w-full max-w-[720px] space-y-5">
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

        <div className="space-y-1.5">
          <h1 className="text-[26px] font-bold leading-tight text-cine-ink sm:text-[32px]">
            Hello, Selamat datang di CINÉ !
          </h1>
          <p className="text-[15px] text-cine-muted">
            Isi data kamu di bawah untuk membuat akun CINÉ
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nama Lengkap">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Asep Kopling"
              required
            />
          </Field>
          <Field label="Nama Panggilan">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Asep"
            />
          </Field>
          <Field label="Email ID">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="asepkopling@email.com"
              required
            />
          </Field>
          <Field label="WhatsApp Number">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081234567890"
            />
          </Field>
          <Field label="Kata Sandi">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </Field>
          <Field label="Confirm Password">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </Field>
          <Field label="Tanggal Lahir">
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
          <Field label="Jenis Kelamin">
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Pilih Jenis Kelamin</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </Select>
          </Field>
          <Field label="Kota">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Depok"
            />
          </Field>
          <Field label="Cinema">
            <div className="relative">
              <Select
                value={preferredCinema}
                onChange={(e) => setPreferredCinema(e.target.value)}
                className="appearance-none pr-10"
              >
                <option value="">Pilih Cinema Favorit</option>
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FIGMA_ICONS.chevron}
                alt=""
                width={18}
                height={18}
                className="pointer-events-none absolute right-4 top-1/2 size-[18px] -translate-y-1/2"
              />
            </div>
          </Field>
        </div>

        <Checkbox
          checked={agree}
          onChange={setAgree}
          label={
            <span>
              Saya menyetujui{" "}
              <span className="font-bold text-cine-maroon">Syarat dan Ketentuan</span>{" "}
              yang berlaku
            </span>
          }
        />

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button type="submit" variant="gold" disabled={loading} className="w-full">
          {loading ? "Tunggu..." : "Register"}
        </Button>

        <p className="text-center text-sm text-cine-ink">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-bold text-cine-maroon hover:underline">
            Masuk di sini
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="cine-label block">{label}</span>
      {children}
    </label>
  );
}
