import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcVerifyResult = {
  valid?: boolean;
  kind?: "ticket" | "fnb";
  code?: string;
  status?: string;
  message?: string;
  booking_id?: string;
  order_id?: string;
};

/**
 * Verifikasi QR petugas langsung via Supabase RPC verify_ticket_qr — hanya admin/staff.
 * Saat valid dan belum pernah dipakai, status langsung diubah ke `completed` (USED) secara atomik.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return NextResponse.json({ error: "Hanya admin/staff" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    token?: string;
  };
  const cleanCode = String(body.code ?? "").trim().toUpperCase();
  let cleanToken = String(body.token ?? "").trim();

  if (!cleanCode) {
    return NextResponse.json(
      { valid: false, message: "Kode tiket atau pesanan wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();

    // Jika petugas memasukkan kode manual atau memindai QR lama tanpa token,
    // cari qr_token resmi dari database (aman karena role admin/staff sudah diverifikasi).
    if (!cleanToken) {
      const { data: bk } = await admin
        .from("bookings")
        .select("qr_token")
        .eq("booking_code", cleanCode)
        .maybeSingle();

      if (bk?.qr_token) {
        cleanToken = bk.qr_token;
      } else {
        const { data: ord } = await admin
          .from("fnb_orders")
          .select("qr_token")
          .eq("order_code", cleanCode)
          .maybeSingle();
        if (ord?.qr_token) cleanToken = ord.qr_token;
      }
    }

    if (!cleanToken || !UUID_RE.test(cleanToken)) {
      return NextResponse.json(
        { valid: false, message: "Kode tidak ditemukan atau format token QR tidak valid." },
        { status: 200 },
      );
    }

    const { data, error } = await admin.rpc("verify_ticket_qr", {
      p_code: cleanCode,
      p_token: cleanToken,
    });

    if (error) {
      return NextResponse.json(
        { valid: false, message: error.message },
        { status: 500 },
      );
    }

    const res = (data ?? {}) as RpcVerifyResult;
    if (!res.valid) {
      return NextResponse.json(res, { status: 200 });
    }

    // Cek apakah tiket / pesanan sudah pernah digunakan (status sudah `completed`)
    const wasAlreadyUsed = res.status === "completed";
    let markedUsedNow = false;
    const nowIso = new Date().toISOString();

    if (res.kind === "ticket" && res.booking_id) {
      if (!wasAlreadyUsed) {
        const { data: updatedRow, error: updErr } = await admin
          .from("bookings")
          .update({ status: "completed", updated_at: nowIso })
          .eq("id", res.booking_id)
          .eq("status", "confirmed")
          .select("id, user_id")
          .maybeSingle();

        if (updErr) {
          return NextResponse.json(
            { valid: false, message: updErr.message },
            { status: 500 },
          );
        }

        markedUsedNow = Boolean(updatedRow);
        if (updatedRow?.user_id) {
          void admin.from("notifications").insert({
            user_id: updatedRow.user_id,
            title: "Tiket telah digunakan",
            body: `Tiket ${cleanCode} berhasil dipindai petugas. Selamat menonton!`,
            type: "booking",
            data: { booking_id: res.booking_id, booking_code: cleanCode },
          });
        }
      }

      const [{ data: booking }, { data: seats }] = await Promise.all([
        admin
          .from("bookings")
          .select("showtime_id, user_id")
          .eq("id", res.booking_id)
          .maybeSingle(),
        admin
          .from("booking_seats")
          .select("seat_label_snapshot")
          .eq("booking_id", res.booking_id),
      ]);

      const { data: showtime } = booking
        ? await admin
            .from("showtimes")
            .select("movie_id, studio_id, show_date, start_time")
            .eq("id", booking.showtime_id)
            .maybeSingle()
        : { data: null };

      const [{ data: movie }, { data: studio }] = await Promise.all([
        showtime
          ? admin.from("movies").select("title").eq("id", showtime.movie_id).maybeSingle()
          : Promise.resolve({ data: null }),
        showtime
          ? admin
              .from("studios")
              .select("name, cinema_id")
              .eq("id", showtime.studio_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const { data: cinema } = studio
        ? await admin.from("cinemas").select("name").eq("id", studio.cinema_id).maybeSingle()
        : { data: null };

      const details = {
        kind: "ticket" as const,
        code: cleanCode,
        title: movie?.title ?? cleanCode,
        cinema: cinema?.name ?? "CINÉ",
        studio: studio?.name ?? "-",
        schedule: showtime
          ? `${showtime.show_date} · ${showtime.start_time.slice(0, 5)}`
          : "-",
        seats: (seats ?? []).map((s) => s.seat_label_snapshot).join(", ") || "-",
      };

      if (wasAlreadyUsed || !markedUsedNow) {
        return NextResponse.json({
          ...details,
          valid: false,
          already_used: true,
          status: "used",
          message: "Tiket ini sudah pernah digunakan (USED).",
        });
      }

      return NextResponse.json({
        ...details,
        valid: true,
        already_used: false,
        status: "used",
        message: "Tiket valid — status langsung diubah menjadi USED.",
      });
    }

    if (res.kind === "fnb" && res.order_id) {
      if (!wasAlreadyUsed) {
        const { data: updatedRow, error: updErr } = await admin
          .from("fnb_orders")
          .update({ status: "completed", updated_at: nowIso })
          .eq("id", res.order_id)
          .in("status", ["paid", "preparing", "ready"])
          .select("id, user_id")
          .maybeSingle();

        if (updErr) {
          return NextResponse.json(
            { valid: false, message: updErr.message },
            { status: 500 },
          );
        }

        markedUsedNow = Boolean(updatedRow);
        if (updatedRow?.user_id) {
          void admin.from("notifications").insert({
            user_id: updatedRow.user_id,
            title: "Pesanan F&B telah diambil",
            body: `Pesanan ${cleanCode} berhasil dipindai petugas dan status berubah menjadi USED.`,
            type: "fnb",
            data: { fnb_order_id: res.order_id, order_code: cleanCode },
          });
        }
      }

      const [{ data: order }, { data: items }] = await Promise.all([
        admin
          .from("fnb_orders")
          .select("cinema_id, pickup_date, pickup_time")
          .eq("id", res.order_id)
          .maybeSingle(),
        admin
          .from("fnb_order_items")
          .select("item_name_snapshot, quantity")
          .eq("order_id", res.order_id),
      ]);

      const { data: cinema } = order
        ? await admin.from("cinemas").select("name").eq("id", order.cinema_id).maybeSingle()
        : { data: null };

      const details = {
        kind: "fnb" as const,
        code: cleanCode,
        title: `Pesanan F&B (${cleanCode})`,
        cinema: cinema?.name ?? "CINÉ",
        schedule: order
          ? `Ambil ${order.pickup_date} · ${order.pickup_time.slice(0, 5)}`
          : "-",
        items: (items ?? [])
          .map((i) => `${i.quantity}x ${i.item_name_snapshot}`)
          .join(", "),
      };

      if (wasAlreadyUsed || !markedUsedNow) {
        return NextResponse.json({
          ...details,
          valid: false,
          already_used: true,
          status: "used",
          message: "Pesanan F&B ini sudah pernah diambil (USED).",
        });
      }

      return NextResponse.json({
        ...details,
        valid: true,
        already_used: false,
        status: "used",
        message: "Pesanan F&B valid — status langsung diubah menjadi USED.",
      });
    }

    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal memverifikasi QR di server.",
      },
      { status: 500 },
    );
  }
}
