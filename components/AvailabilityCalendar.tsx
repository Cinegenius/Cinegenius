"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { calculateCommission } from "@/lib/commission";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toKey(d: Date) {
  return d.toISOString().split("T")[0];
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
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000) + 1;
}

// Mock belegte Daten — in Produktion von API
function getMockedBookedKeys(baseYear: number, baseMonth: number): Set<string> {
  const booked = new Set<string>();
  const ranges = [
    { start: new Date(baseYear, baseMonth, 7),  len: 2 },
    { start: new Date(baseYear, baseMonth, 14), len: 3 },
    { start: new Date(baseYear, baseMonth, 22), len: 1 },
    { start: new Date(baseYear, baseMonth + 1, 4),  len: 4 },
    { start: new Date(baseYear, baseMonth + 1, 19), len: 2 },
  ];
  for (const { start, len } of ranges) {
    for (let i = 0; i < len; i++) {
      booked.add(toKey(addDays(start, i)));
    }
  }
  return booked;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dailyRate: number;
  currency?: string;
  onSelect: (start: Date, end: Date, days: number) => void;
  blockedDates?: string[]; // ISO date strings "YYYY-MM-DD"
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AvailabilityCalendar({ dailyRate, currency = "€", onSelect, blockedDates }: Props) {
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
    if (blockedDates && blockedDates.length > 0) return new Set(blockedDates);
    return getMockedBookedKeys(today.getFullYear(), today.getMonth());
  }, [blockedDates, today]);

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
      return;
    }

    // Setting end
    if (d.getTime() <= start.getTime()) {
      setStart(d);
      return;
    }

    if (rangeHasBooked(start, d)) {
      // Can't select range crossing booked dates — restart from clicked day
      setStart(d);
      setEnd(null);
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
  const commission = selectedDays > 0 ? calculateCommission(subtotal) : null;

  const monthNames = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const dayHeaders = ["Mo","Di","Mi","Do","Fr","Sa","So"];

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
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
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
            <div
              key={toKey(d)}
              className={`relative flex items-center justify-center h-9 text-sm transition-all select-none ${cell}`}
              onClick={() => handleClick(d)}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            >
              <span className={text}>{d.getDate()}</span>
              {dot && <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${dot}`} />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gold" />
          <span className="text-[10px] text-text-muted">Ausgewählt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-crimson/30" />
          <span className="text-[10px] text-text-muted">Belegt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-bg-elevated border border-border" />
          <span className="text-[10px] text-text-muted">Verfügbar</span>
        </div>
      </div>

      {/* Selection state hint */}
      {!start && (
        <p className="text-xs text-text-muted text-center py-2">
          Startdatum auswählen
        </p>
      )}
      {start && !end && (
        <p className="text-xs text-gold text-center py-2">
          {start.toLocaleDateString("de-DE", { day: "numeric", month: "short" })} gewählt — jetzt Enddatum wählen
        </p>
      )}

      {/* Summary */}
      {start && end && commission && (
        <div className="bg-bg-elevated border border-gold/20 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">
              {start.toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
              {" – "}
              {end.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="text-text-primary font-medium">{selectedDays} {selectedDays === 1 ? "Tag" : "Tage"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">{dailyRate.toLocaleString()} {currency} × {selectedDays} Tage</span>
            <span className="text-text-primary">{subtotal.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted flex items-center gap-1">
              <Info size={11} /> Plattformgebühr ({commission.rate} %)
            </span>
            <span className="text-text-primary">{commission.commission.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
            <span className="text-text-primary">Gesamt</span>
            <span className="text-gold font-display">{(subtotal + commission.commission).toLocaleString()} {currency}</span>
          </div>
          <button
            onClick={() => {
              const reset = () => { setStart(null); setEnd(null); };
              reset();
            }}
            className="text-xs text-text-muted hover:text-gold transition-colors w-full text-center pt-1"
          >
            Auswahl zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
