-- ============================================================
-- CINÉ — Simulasi pembayaran untuk demo/tugas
-- Migration 0010
-- Prasyarat: 0001 - 0009
--
-- Tombol admin "Tandai Lunas" memanggil confirm_payment lewat RPC ini.
-- Tidak perlu gateway sungguhan. Webhook_mode=generic tetap tersedia
-- untuk simulasi via curl.
-- ============================================================

create or replace function public.admin_mark_paid(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Hanya admin yang dapat menandai pembayaran lunas.';
  end if;

  -- confirm_payment sendiri yang melakukan validasi status & efek samping
  -- (booking confirmed, kursi booked, F&B paid, notifikasi).
  v_result := public.confirm_payment(p_payment_id);
  return v_result;
end $$;

revoke all on function public.admin_mark_paid(uuid) from public;
grant execute on function public.admin_mark_paid(uuid) to authenticated, service_role;

-- ============================================================
-- Selesai. Urutan apply: 0001 ... 0009 -> 0010
-- ============================================================
