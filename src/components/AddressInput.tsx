"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Free-text area/address field with autocomplete from OpenStreetMap's Nominatim
 * search API (keyless, CORS-enabled). Debounced; if the network is unavailable
 * the user can still just type their own area — the typed text is always kept.
 */
export function AddressInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
          { headers: { Accept: "application/json" }, signal: ctrl.signal },
        );
        const data: unknown = await res.json();
        const list = Array.isArray(data)
          ? (data as { display_name?: string }[]).map((d) => d.display_name).filter((s): s is string => !!s)
          : [];
        setSuggestions(list.slice(0, 5));
      } catch {
        /* offline or blocked — typing still works */
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  return (
    <div className="addrwrap">
      <input
        className="custominput"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <div className="addrlist">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={i}
              className="addritem"
              onClick={() => {
                pickedRef.current = true;
                onChange(s);
                setSuggestions([]);
                setOpen(false);
              }}
            >
              📍 {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
