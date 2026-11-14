const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "k"]] as const;

/** Consistent magnitudes from 1,000, with the active locale's decimal separator. */
export function compactCount(value: number, locale: string): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const count = Math.floor(value);
  const unit = units.find(([scale]) => count >= scale || (scale > 1e3 && count >= scale * 0.99995));
  return new Intl.NumberFormat(locale, { maximumFractionDigits: unit ? 1 : 0, useGrouping: false })
    .format(unit ? count / unit[0] : count) + (unit?.[1] ?? "");
}
