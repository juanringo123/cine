-- ============================================================
-- CINÉ — Generate kursi studio oleh admin
-- Migration 0009
-- Prasyarat: 0001 - 0008
-- ============================================================

-- Membuat kursi untuk sebuah studio. Idempoten: kursi yang sudah ada
-- tidak diganti. total_rows/total_seats dijaga trigger 0006.
create or replace function public.generate_studio_seats(
  p_studio_id uuid,
  p_rows integer,
  p_cols integer,
  p_couple_seats integer default 4
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text;
  r integer;
  n integer;
  v_max integer;
  v_type public.seat_type;
  v_inserted integer := 0;
begin
  -- Service role / SQL (auth.uid() null) diizinkan. Untuk user, admin saja.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Hanya admin yang dapat membuat kursi.';
  end if;

  if not exists (select 1 from public.studios where id = p_studio_id) then
    raise exception 'Studio tidak ditemukan.';
  end if;
  if p_rows is null or p_rows < 1 or p_rows > 26 then
    raise exception 'Jumlah baris harus 1-26.';
  end if;
  if p_cols is null or p_cols < 1 or p_cols > 30 then
    raise exception 'Jumlah kolom harus 1-30.';
  end if;
  if p_couple_seats is null or p_couple_seats < 0 or p_couple_seats > p_cols then
    raise exception 'Jumlah kursi couple tidak valid.';
  end if;

  for r in 1..p_rows loop
    v_label := chr(64 + r);
    v_max := p_cols;

    if r = p_rows then
      v_type := 'couple';
      v_max := greatest(0, p_couple_seats);
    elsif r >= p_rows - 2 then
      v_type := 'premium';
    else
      v_type := 'regular';
    end if;

    for n in 1..v_max loop
      insert into public.seats
        (studio_id, row_label, seat_number, seat_type, x_position, y_position)
      values
        (p_studio_id, v_label, n, v_type, n, r)
      on conflict (studio_id, row_label, seat_number) do nothing;

      v_inserted := v_inserted + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'studio_id', p_studio_id,
    'rows', p_rows,
    'columns', p_cols,
    'processed', v_inserted
  );
end $$;

revoke all on function public.generate_studio_seats(uuid, integer, integer, integer) from public;
grant execute on function public.generate_studio_seats(uuid, integer, integer, integer)
  to authenticated, service_role;

-- ============================================================
-- Selesai. Urutan apply: 0001 ... 0008 -> 0009
-- ============================================================
