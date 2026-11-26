"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import { Avatar, Input } from "@/components/ui/primitives";

const KEY_NOTIF_TICKET = "cine_pref_notif_ticket";
const KEY_NOTIF_PROMO = "cine_pref_notif_promo";

export default function SettingsClient({
  fullName,
  email,
  city,
  cinemaName,
  avatarUrl,
}: {
  fullName: string;
  email: string;
  city: string;
  cinemaName?: string | null;
  avatarUrl?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [notifTicket, setNotifTicket] = useState(true);
  const [notifPromo, setNotifPromo] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  useEffect(() => {
    const savedTicket = window.localStorage.getItem(KEY_NOTIF_TICKET);
    const savedPromo = window.localStorage.getItem(KEY_NOTIF_PROMO);
    if (savedTicket !== null) setNotifTicket(savedTicket === "true");
    if (savedPromo !== null) setNotifPromo(savedPromo === "true");
  }, []);

  function updateNotifTicket(next: boolean) {
    setNotifTicket(next);
    window.localStorage.setItem(KEY_NOTIF_TICKET, String(next));
  }

  function updateNotifPromo(next: boolean) {
    setNotifPromo(next);
    window.localStorage.setItem(KEY_NOTIF_PROMO, String(next));
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (email && !currentPassword) {
      setPwError("Masukkan kata sandi saat ini.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Konfirmasi kata sandi baru tidak sama.");
      return;
    }
    if (currentPassword && newPassword === currentPassword) {
      setPwError("Kata sandi baru harus berbeda dari kata sandi saat ini.");
      return;
    }

    setPwLoading(true);
    try {
      if (email) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyErr) {
          setPwError("Kata sandi saat ini tidak sesuai.");
          return;
        }
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateErr) {
        setPwError(updateErr.message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess("Kata sandi berhasil diperbarui.");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Gagal mengubah kata sandi.");
    } finally {
      setPwLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="space-y-4">
      <div className="cine-card flex items-center gap-4 p-5">
        <Avatar name={fullName} src={avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-cine-ink">{fullName}</p>
          <p className="truncate text-xs text-cine-muted">
            {email} · {cinemaName ?? city}
          </p>
        </div>
      </div>

      <div className="cine-card divide-y divide-cine-border px-5">
        <LinkRow href="/account" label="Edit Profil" right="›" />
        <LinkRow href="/account/addresses" label="Daftar Alamat" right="›" />
        <LinkRow href="/account/cards" label="Kartu Tersimpan" right="›" />
      </div>

      <form onSubmit={handlePasswordChange} className="cine-card space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-cine-maroon" />
            <h2 className="text-base font-bold text-cine-ink">Ubah Kata Sandi</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswords((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-cine-muted hover:text-cine-ink"
          >
            {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            <span>{showPasswords ? "Sembunyikan" : "Lihat"}</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {email && (
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="cine-label block">Kata Sandi Saat Ini</span>
              <Input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="cine-label block">Kata Sandi Baru</span>
            <Input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
              minLength={6}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="cine-label block">Konfirmasi Kata Sandi Baru</span>
            <Input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              required
              minLength={6}
            />
          </label>
        </div>

        {pwError && <p className="text-sm text-red-700">{pwError}</p>}
        {pwSuccess && <p className="text-sm font-semibold text-green-700">{pwSuccess}</p>}

        <div>
          <Button type="submit" variant="gold" disabled={pwLoading}>
            {pwLoading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
          </Button>
        </div>
      </form>

      <div className="cine-card divide-y divide-cine-border px-5">
        <ToggleRow
          label="Notifikasi tiket"
          checked={notifTicket}
          onChange={updateNotifTicket}
        />
        <ToggleRow
          label="Promo dan info film"
          checked={notifPromo}
          onChange={updateNotifPromo}
        />
      </div>

      <div className="cine-card divide-y divide-cine-border px-5 text-sm">
        <div className="flex items-center justify-between py-4">
          <span className="text-cine-ink">Bahasa</span>
          <span className="text-cine-muted">Indonesia</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-cine-ink">Lokasi</span>
          <span className="text-cine-muted">{city}</span>
        </div>
        <div className="flex items-center justify-between py-4">
          <span className="text-cine-ink">Versi aplikasi</span>
          <span className="text-cine-muted">1.0.0</span>
        </div>
      </div>

      <Button type="button" variant="outline" onClick={logout}>
        Keluar
      </Button>
    </div>
  );
}

function LinkRow({ href, label, right }: { href: string; label: string; right: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-4 text-sm text-cine-ink transition-colors duration-200 hover:text-cine-maroon"
    >
      <span>{label}</span>
      <span className="text-base text-cine-muted">{right}</span>
    </Link>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 text-sm">
      <span className="text-cine-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[26px] w-11 cursor-pointer rounded-full transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          checked ? "bg-cine-maroon" : "bg-cine-seat-booked"
        }`}
      >
        <span
          className={`block size-5 rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            checked ? "translate-x-[21px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
