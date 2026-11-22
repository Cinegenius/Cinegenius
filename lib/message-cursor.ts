/** Timestamps interpolated into a PostgREST cursor must have a closed grammar.
 * Keep the original PostgreSQL offset and up to six fractional digits: JS Date
 * normalization discards microseconds and can skip rows at a page boundary. */
export function isMessageCursorTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 32) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || match[0] !== value) return false;
  const [, y, m, d, h, min, s, , zone, zoneHour, zoneMinute] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (year < 1 || month < 1 || month > 12 || Number(h) > 23 || Number(min) > 59 || Number(s) > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return false;
  if (zone !== "Z") {
    const hours = Number(zoneHour), minutes = Number(zoneMinute);
    if (hours > 14 || minutes > 59 || hours === 14 && minutes !== 0) return false;
  }
  return true;
}
