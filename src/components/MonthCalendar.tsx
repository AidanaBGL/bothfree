"use client";

import { useMemo, useState } from "react";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MAX_MONTHS_AHEAD = 3;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
/** Monday-based column index (0 = Mon … 6 = Sun). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export interface MonthCalendarProps {
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * Airline-style month picker: navigate month to month, select arbitrary days,
 * or flip on "range" to fill several consecutive days with two taps. Past days
 * and days beyond the booking horizon are disabled.
 */
export function MonthCalendar({ selected, onChange }: MonthCalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);

  const horizon = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD + 1, 0);
    return d;
  }, [today]);

  const canGoPrev = cursor > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = cursor < new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD, 1);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = mondayIndex(first);
    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      out.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    return out;
  }, [cursor]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleDay(key: string) {
    if (selectedSet.has(key)) onChange(selected.filter((k) => k !== key));
    else onChange([...selected, key].sort());
  }

  function fillRange(startKey: string, endKey: string) {
    const [a, b] = startKey <= endKey ? [startKey, endKey] : [endKey, startKey];
    const next = new Set(selected);
    const cur = new Date(`${a}T00:00:00`);
    const end = new Date(`${b}T00:00:00`);
    while (cur <= end) {
      const key = ymd(cur);
      const d = new Date(`${key}T00:00:00`);
      if (d >= today && d <= horizon) next.add(key);
      cur.setDate(cur.getDate() + 1);
    }
    onChange(Array.from(next).sort());
  }

  function onDayClick(d: Date) {
    const key = ymd(d);
    if (!rangeMode) {
      toggleDay(key);
      return;
    }
    if (rangeStart === null) {
      setRangeStart(key);
    } else {
      fillRange(rangeStart, key);
      setRangeStart(null);
    }
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className="cal-nav"
          onClick={() => canGoPrev && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          disabled={!canGoPrev}
          aria-label="Previous month"
        >
          ‹
        </button>
        <strong>
          {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
        </strong>
        <button
          type="button"
          className="cal-nav"
          onClick={() => canGoNext && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          disabled={!canGoNext}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="cal-weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`blank-${i}`} className="cal-cell blank" />;
          const key = ymd(d);
          const disabled = d < today || d > horizon;
          const isSelected = selectedSet.has(key);
          const isRangeStart = rangeStart === key;
          return (
            <button
              type="button"
              key={key}
              className={`cal-cell${isSelected ? " sel" : ""}${isRangeStart ? " rangestart" : ""}`}
              disabled={disabled}
              onClick={() => onDayClick(d)}
              aria-pressed={isSelected}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="cal-foot">
        <button
          type="button"
          className={`rangebtn${rangeMode ? " on" : ""}`}
          onClick={() => {
            setRangeMode(!rangeMode);
            setRangeStart(null);
          }}
        >
          {rangeMode ? "Range: tap start then end" : "Pick a range of days"}
        </button>
        <span className="cal-count">{selected.length} day{selected.length === 1 ? "" : "s"} selected</span>
      </div>
    </div>
  );
}
