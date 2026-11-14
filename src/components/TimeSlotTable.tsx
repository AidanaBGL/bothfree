"use client";

/**
 * Time-slot grid: rows are the days the user picked, columns are hour slots.
 * Tapping a cell toggles availability for that day/hour — like the time grid
 * in a calendar app. Value is a map of `YYYY-MM-DD` → sorted list of hours.
 */

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

function hourLabel(h: number): string {
  const period = h < 12 ? "a" : "p";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base}${period}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export interface TimeSlotTableProps {
  days: string[];
  value: Record<string, number[]>;
  onChange: (next: Record<string, number[]>) => void;
}

export function TimeSlotTable({ days, value, onChange }: TimeSlotTableProps) {
  if (days.length === 0) {
    return <div className="slothint">Pick one or more days above, then choose times for each.</div>;
  }

  function toggle(day: string, hour: number) {
    const current = value[day] ?? [];
    const next = current.includes(hour)
      ? current.filter((h) => h !== hour)
      : [...current, hour].sort((a, b) => a - b);
    onChange({ ...value, [day]: next });
  }

  function toggleRow(day: string) {
    const current = value[day] ?? [];
    onChange({ ...value, [day]: current.length === HOURS.length ? [] : [...HOURS] });
  }

  return (
    <div className="slottable" role="grid" aria-label="Availability time slots">
      <div className="slotrow slothead">
        <span className="slotday" />
        {HOURS.map((h) => (
          <span key={h} className="slotcol">
            {hourLabel(h)}
          </span>
        ))}
      </div>
      {days.map((day) => {
        const sel = value[day] ?? [];
        return (
          <div className="slotrow" key={day}>
            <button type="button" className="slotday" onClick={() => toggleRow(day)} title="Toggle whole day">
              {dayLabel(day)}
            </button>
            {HOURS.map((h) => (
              <button
                type="button"
                key={h}
                className={`slotcell${sel.includes(h) ? " on" : ""}`}
                onClick={() => toggle(day, h)}
                aria-pressed={sel.includes(h)}
                aria-label={`${dayLabel(day)} ${hourLabel(h)}`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
