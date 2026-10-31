"use client";

import { useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { bookingDateKey, bookingDays } from "@/lib/booking-request";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toKey(d: Date) {
  return bookingDateKey(d);
}

function sameDay(a: Date, b: Date) {
  return toKey(a) === toKey(b);
}

function inRange(d: Date, start: Date, end: Date) {
  const t = d.getTime();
  return t > start.getTime() && t < end.getTime();
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date) {
  return bookingDays(toKey(a), toKey(b));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dailyRate: number;
  currency?: string;
  onSelect: (start: Date, end: Date, days: number) => void;
  onReset?: () => void;
  blockedDates?: string[]; // ISO date strings "YYYY-MM-DD"
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AvailabilityCalendar({ dailyRate, currency = "€", onSelect, onReset, blockedDates }: Props) {
  const locale = useLocale();
  const t = useTranslations("AvailabilityCalendar");
  const formatDate = (date: Date) => date.toLocaleDateString(locale, {day: "numeric", month: "short", year: "numeric"});
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd]     = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);

  const bookedKeys = useMemo(() => {
    return new Set(blockedDates ?? []);
  }, [blockedDates]);

  const isBooked = (d: Date) => bookedKeys.has(toKey(d));
  const isPast   = (d: Date) => d.getTime() < today.getTime();

  // Check if a range crosses any booked date
  const rangeHasBooked = (s: Date, e: Date) => {
    let cur = addDays(s, 1);
    while (cur.getTime() < e.getTime()) {
      if (isBooked(cur)) return true;
      cur = addDays(cur, 1);
    }
    return false;
  };

  // Calendar grid
  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Monday-first: 0=Mon … 6=Sun
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = Array(startOffset).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(new Date(viewYear, viewMonth, i));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleClick = (d: Date) => {
    if (isPast(d) || isBooked(d)) return;

    if (!start || (start && end)) {
      // Start fresh
      setStart(d);
      setEnd(null);
      onReset?.();
      return;
    }

    // Setting end
    if (d.getTime() < start.getTime()) {
      setStart(d);
      return;
    }

    if (rangeHasBooked(start, d)) {
      // Can't select range crossing booked dates — restart from clicked day
      setStart(d);
      setEnd(null);
      onReset?.();
      return;
    }

    setEnd(d);
    const numDays = diffDays(start, d);
    onSelect(start, d, numDays);
  };

  const previewEnd = (start && !end && hover && hover > start && !rangeHasBooked(start, hover))
    ? hover : null;

  const selectedDays = start && end ? diffDays(start, end) : 0;
  const subtotal = selectedDays * dailyRate;

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {month: "long", year: "numeric"});
  const dayHeaders = Array.from({length: 7}, (_, i) => new Date(2026, 9, 26 + i).toLocaleDateString(locale, {weekday: "short"}));

  const getCellStyle = (d: Date) => {
    const past    = isPast(d);
    const booked  = isBooked(d);
    const isStart = start && sameDay(d, start);
    const isEnd   = end && sameDay(d, end);
    const inSel   = start && end && inRange(d, start, end);
    const inPrev  = start && !end && previewEnd && inRange(d, start, previewEnd);
    const isHov   = hover && sameDay(d, hover);
    const isPrevEnd = previewEnd && sameDay(d, previewEnd);

    if (past || booked) {
      return {
        cell: `cursor-not-allowed ${booked ? "bg-crimson/10" : "opacity-30"}`,
        text: booked ? "text-crimson-light line-through" : "text-text-muted",
        dot:  booked ? "bg-crimson/60" : "",
      };
    }
    if (isStart || isEnd) {
      return {
        cell: "bg-gold rounded-full cursor-pointer",
        text: "text-bg-primary font-bold",
        dot:  "",
      };
    }
    if (inSel) {
      return {
        cell: "bg-gold/20 cursor-pointer",
        text: "text-text-primary",
        dot:  "",
      };
    }
    if (inPrev || isPrevEnd) {
      return {
        cell: `bg-gold/10 cursor-pointer ${isPrevEnd ? "rounded-full" : ""}`,
        text: "text-text-primary",
        dot:  "",
      };
    }
    return {
      cell: `cursor-pointer hover:bg-bg-elevated rounded-full ${isHov ? "ring-1 ring-gold/40" : ""}`,
      text: "text-text-primary",
      dot:  "",
    };
  };

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label={t("prevMonth")}
          onClick={prevMonth}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
        >
          <ChevronLeft size={15} />
        </button>
        <span aria-live="polite" className="text-sm font-semibold text-text-primary">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={nextMonth}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map(h => (
          <div key={h} className="text-center text-[10px] uppercase tracking-widest text-text-muted font-semibold py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const { cell, text, dot } = getCellStyle(d);
          return (
            <button
              type="button"
              disabled={isPast(d) || isBooked(d)}
              aria-label={t(isBooked(d) ? "bookedDate" : isPast(d) ? "pastDate" : "date", {date: d.toLocaleDateString(locale, {dateStyle: "full"})})}
              aria-pressed={Boolean(start && (sameDay(d, start) || (end && (sameDay(d, end) || inRange(d, start, end)))))}
              key={toKey(d)}
              className={`relative flex items-center justify-center min-h-11 text-sm transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:z-10 ${cell}`}
              onClick={() => handleClick(d)}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            >
              <span className={text}>{d.getDate()}</span>
              {dot && <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${dot}`} />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gold" />
          <span className="text-[10px] text-text-muted">{t("selected")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-crimson/30" />
          <span className="text-[10px] text-text-muted">{t("booked")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-bg-elevated border border-border" />
          <span className="text-[10px] text-text-muted">{t("available")}</span>
        </div>
      </div>

      {/* Selection state hint */}
      {!start && (
        <p role="status" className="text-xs text-text-muted text-center py-2">
          {t("chooseStart")}
        </p>
      )}
      {start && !end && (
        <p role="status" className="text-xs text-gold text-center py-2">
          {t("chooseEnd", {date: formatDate(start)})}
        </p>
      )}

      {/* Summary */}
      {start && end && selectedDays > 0 && (
        <div className="bg-bg-elevated border border-gold/20 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">
              {formatDate(start)}
              {" – "}
              {formatDate(end)}
            </span>
            <span className="text-text-primary font-medium">{t("days", {count: selectedDays})}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">{dailyRate.toLocaleString(locale)} {currency} × {t("days", {count: selectedDays})}</span>
            <span className="text-text-primary">{subtotal.toLocaleString(locale)} {currency}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
            <span className="text-text-primary">{t("total")}</span>
            <span className="text-gold font-display">{subtotal.toLocaleString(locale)} {currency}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const reset = () => { setStart(null); setEnd(null); setHover(null); onReset?.(); };
              reset();
            }}
            className="text-xs text-text-muted hover:text-gold transition-colors w-full text-center pt-1"
          >
            {t("reset")}
          </button>
        </div>
      )}
    </div>
  );
}
