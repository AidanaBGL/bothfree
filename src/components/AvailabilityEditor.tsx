"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchMyAvailability,
  addAvailability,
  deleteAvailability,
  type AvailabilitySlot,
} from "@/lib/data/store";

/**
 * "When are you free?" editor. Pick a day on a horizontal week strip, add a
 * preset band (morning/afternoon/evening) or a custom interval, review the list,
 * delete, and save to Supabase. Local wall-clock times are converted to UTC via
 * Date.toISOString() (the browser is in the user's timezone). Persists per user.
 */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BANDS: { id: string; label: string; from: number; to: number }[] = [
  { id: "morning", label: "Morning · 9–12", from: 9, to: 12 },
  { id: "afternoon", label: "Afternoon · 12–17", from: 12, to: 17 },
  { id: "evening", label: "Evening · 17–22", from: 17, to: 22 },
];

function mondayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}
function startOfWeek(base: Date, offset: number) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - mondayIndex(d) + offset * 7);
  return d;
}
function localIso(day: Date, hour: number): string {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function AvailabilityEditor({ onToast }: { onToast?: (msg: string) => void }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customFrom, setCustomFrom] = useState(18);
  const [customTo, setCustomTo] = useState(20);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetchMyAvailability().then((s) => {
      setSlots(s);
      setLoading(false);
    });
  }, []);

  const weekDays = useMemo(() => {
    const start = startOfWeek(today, weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [today, weekOffset]);

  const daysWithSlots = useMemo(
    () => new Set(slots.map((s) => new Date(s.startsAt).toDateString())),
    [slots],
  );

  const selDate = selectedDay ? new Date(selectedDay) : null;

  async function addBand(from: number, to: number) {
    if (!selDate) return;
    if (to <= from) return;
    setSaving(true);
    const res = await addAvailability(localIso(selDate, from), localIso(selDate, to));
    setSaving(false);
    if (res.error) return onToast?.(res.error);
    if (res.slot) {
      setSlots((prev) => [...prev, res.slot!].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      onToast?.("Time saved 💚");
    }
  }

  async function remove(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
    await deleteAvailability(id);
  }

  function fmtDay(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="availwrap">
      <div className="availhead">
        <button className="cal-nav" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0} aria-label="Previous week">‹</button>
        <button className="rangebtn" onClick={() => setWeekOffset(0)}>Today</button>
        <button className="cal-nav" onClick={() => setWeekOffset((w) => Math.min(1, w + 1))} disabled={weekOffset >= 1} aria-label="Next week">›</button>
      </div>

      <div className="weekstrip">
        {weekDays.map((d) => {
          const key = d.toDateString();
          const past = d < today;
          const isToday = key === today.toDateString();
          const sel = selectedDay === key;
          return (
            <button
              key={key}
              className={`weekday${sel ? " sel" : ""}${isToday ? " today" : ""}`}
              disabled={past}
              onClick={() => { setSelectedDay(key); setShowCustom(false); }}
            >
              <span>{WEEKDAYS[mondayIndex(d)]}</span>
              <b>{d.getDate()}</b>
              {daysWithSlots.has(key) && <i className="dot" />}
            </button>
          );
        })}
      </div>

      {selDate ? (
        <>
          <div className="sectionlabel">Add free time for {fmtDay(selDate.toISOString())}</div>
          <div className="pickrow">
            {BANDS.map((b) => (
              <button key={b.id} className="chip" disabled={saving} onClick={() => addBand(b.from, b.to)}>
                {b.label}
              </button>
            ))}
            <button className={`chip${showCustom ? " sel" : ""}`} onClick={() => setShowCustom((v) => !v)}>
              Custom time
            </button>
          </div>
          {showCustom && (
            <div className="customtime">
              <label className="field">
                <span>From</span>
                <select className="custominput" value={customFrom} onChange={(e) => setCustomFrom(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => h).map((h) => <option key={h} value={h}>{h}:00</option>)}
                </select>
              </label>
              <label className="field">
                <span>To</span>
                <select className="custominput" value={customTo} onChange={(e) => setCustomTo(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{h}:00</option>)}
                </select>
              </label>
              <button className="matchbtn" disabled={saving || customTo <= customFrom} onClick={() => addBand(customFrom, customTo)}>
                Add
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="note">Pick a day above to add your free time.</div>
      )}

      <div className="sectionlabel">Your free time</div>
      {loading ? (
        <div className="availskeleton">
          <div className="skelrow" /><div className="skelrow" />
        </div>
      ) : slots.length === 0 ? (
        <div className="note">No free time saved yet. Add a slot above.</div>
      ) : (
        <div className="frlist">
          {slots.map((s) => (
            <div className="frow" key={s.id}>
              <div className="frow-id">
                <strong>{fmtDay(s.startsAt)}</strong>
                <span className="frow-blurb">{fmtTime(s.startsAt)} – {fmtTime(s.endsAt)}</span>
              </div>
              <div className="frow-actions">
                <button className="passbtn" onClick={() => remove(s.id)} aria-label="Delete slot">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
