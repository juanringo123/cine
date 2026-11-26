-- ============================================================
-- CINÉ — WhatsApp OTP
-- Migration 0008
-- Prasyarat: 0001 - 0007
--
-- Tabel & RPC ini HANYA untuk service_role (Go API).
-- Tidak ada policy untuk anon/authenticated.
-- ============================================================

create table if not exists public.whatsapp_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_otps_phone_idx
  on public.whatsapp_otps (phone, created_at desc)
  where consumed_at is null;

alter table public.whatsapp_otps enable row level security;
revoke all on public.whatsapp_otps from anon, authenticated;

-- Membuat OTP baru sekaligus menonaktifkan kode lama untuk nomor tersebut.
create or replace function public.create_whatsapp_otp(
  p_phone text,
  p_user_id uuid,
  p_code_hash text,
  p_ttl_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.whatsapp_otps
  set consumed_at = now()
  where phone = p_phone and consumed_at is null;

  insert into public.whatsapp_otps (phone, user_id, code_hash, expires_at)
  values (
    p_phone,
    p_user_id,
    p_code_hash,
    now() + make_interval(secs => greatest(30, p_ttl_seconds))
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end $$;

revoke all on function public.create_whatsapp_otp(text, uuid, text, integer) from public;
grant execute on function public.create_whatsapp_otp(text, uuid, text, integer)
  to service_role;

-- Memverifikasi kode. Max 5 salah, kedaluwarsa ditolak, sekali pakai.
create or replace function public.verify_whatsapp_otp(
  p_phone text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.whatsapp_otps%rowtype;
  v_email text;
begin
  select * into r
  from public.whatsapp_otps
  where phone = p_phone and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('valid', false, 'message', 'Kode OTP tidak ditemukan.');
  end if;

  if r.expires_at < now() then
    return jsonb_build_object('valid', false, 'message', 'Kode OTP kedaluwarsa.');
  end if;

  if r.attempts >= 5 then
    return jsonb_build_object('valid', false, 'message', 'Terlalu banyak percobaan. Minta kode baru.');
  end if;

  update public.whatsapp_otps
  set attempts = attempts + 1
  where id = r.id;

  if r.code_hash is distinct from p_code_hash then
    return jsonb_build_object('valid', false, 'message', 'Kode OTP salah.');
  end if;

  update public.whatsapp_otps
  set consumed_at = now(), verified_at = now()
  where id = r.id;

  select email into v_email from public.profiles where id = r.user_id;

  return jsonb_build_object(
    'valid', true,
    'user_id', r.user_id,
    'email', v_email
  );
end $$;

revoke all on function public.verify_whatsapp_otp(text, text) from public;
grant execute on function public.verify_whatsapp_otp(text, text) to service_role;

-- ============================================================
-- Selesai. Urutan apply: 0001 ... 0007 -> 0008
-- ============================================================
