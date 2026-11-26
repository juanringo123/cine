-- ============================================================
-- CINÉ — Perbaikan release_promo_on_status_change
-- Migration 0011
--
-- Bug: perbandingan enum fnb_order_status dengan literal 'expired'
-- menyebabkan error 22P02 saat confirm_payment pada pesanan F&B.
-- Fixed dengan cast ke text.
-- ============================================================

create or replace function public.release_promo_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Cast ke text: enum booking_status punya 'expired', enum
  -- fnb_order_status tidak punya. Tanpa cast, literal 'expired'
  -- gagal di-cast ke fnb_order_status (SQLSTATE 22P02).
  if new.status is distinct from old.status
     and new.status::text in ('canceled', 'expired', 'refunded')
     and old.status::text not in ('canceled', 'expired', 'refunded') then
    if tg_table_name = 'bookings' then
      perform public.release_promo_usage(new.id, null);
    else
      perform public.release_promo_usage(null, new.id);
    end if;
  end if;

  return new;
end $$;

revoke all on function public.release_promo_on_status_change() from public;

-- ============================================================
-- Selesai. Urutan apply: 0001 ... 0010 -> 0011
-- ============================================================
