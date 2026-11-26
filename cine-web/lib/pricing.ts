const WEEKDAY_BASE_PRICES: Record<string, number> = {
  regular_2d: 40000,
  "3d": 50000,
  imax: 75000,
  premiere: 95000,
};

/** Mengembalikan true untuk akhir pekan (Sabtu dan Minggu). */
export function isWeekendDate(dateIso: string): boolean {
  if (!dateIso) return false;
  const parsed = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const dow = parsed.getUTCDay(); // 0 = Minggu, 6 = Sabtu
  return dow === 0 || dow === 6;
}

/** Tarif dasar weekday (Senin–Jumat) per format studio. */
export function getWeekdayBasePrice(format: string): number {
  return WEEKDAY_BASE_PRICES[format] ?? 40000;
}

/** Tambahan biaya akhir pekan (Sabtu–Minggu) per format studio. */
export function getWeekendSurcharge(format: string): number {
  return format === "premiere" ? 20000 : 15000;
}

/** Tarif standar tiket berdasarkan format studio dan tanggal tayang. */
export function getDefaultShowtimePrice(format: string, dateIso: string): number {
  const base = getWeekdayBasePrice(format);
  return isWeekendDate(dateIso) ? base + getWeekendSurcharge(format) : base;
}
