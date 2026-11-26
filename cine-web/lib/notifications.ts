import type { Json } from "@/../supabase/types/database";

type NotificationPayload = {
  booking_id?: unknown;
  booking_code?: unknown;
  fnb_order_id?: unknown;
  order_code?: unknown;
  status?: unknown;
};

export function resolveNotificationHref(item: {
  type: string;
  data?: Json | null;
}): string {
  if (!item.data || typeof item.data !== "object" || Array.isArray(item.data)) {
    return "/notifications";
  }

  const d = item.data as NotificationPayload;
  const bookingId = typeof d.booking_id === "string" ? d.booking_id : "";
  const bookingCode = typeof d.booking_code === "string" ? d.booking_code : "";
  const fnbOrderId = typeof d.fnb_order_id === "string" ? d.fnb_order_id : "";
  const orderCode = typeof d.order_code === "string" ? d.order_code : "";
  const status = typeof d.status === "string" ? d.status : "";

  if (bookingCode && ["paid", "confirmed", "completed"].includes(status)) {
    return `/ticket/${encodeURIComponent(bookingCode)}`;
  }
  if (orderCode && ["paid", "preparing", "ready", "completed"].includes(status)) {
    return `/ticket/${encodeURIComponent(orderCode)}`;
  }
  if (bookingId) {
    return `/booking/${encodeURIComponent(bookingId)}`;
  }
  if (fnbOrderId) {
    return `/order/${encodeURIComponent(fnbOrderId)}`;
  }
  return "/notifications";
}
