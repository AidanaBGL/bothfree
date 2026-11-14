"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Polygon, LayerGroup } from "leaflet";

/**
 * Draw-your-own meeting area on a real OpenStreetMap-based map (dark CARTO
 * tiles). Click to drop polygon vertices; the ring is reported back as
 * GeoJSON-style [lng, lat] pairs (closed). Leaflet is imported lazily inside an
 * effect so it never runs during server rendering.
 */
export interface AreaMapProps {
  onChange: (ring: [number, number][] | null) => void;
}

const NYC: [number, number] = [40.73, -73.95];

export function AreaMap({ onChange }: AreaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const polyRef = useRef<Polygon | null>(null);
  const vertexLayerRef = useRef<LayerGroup | null>(null);
  const pointsRef = useRef<[number, number][]>([]); // [lat, lng]
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, { center: NYC, zoom: 11, zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19,
      }).addTo(map);

      const vertexLayer = L.layerGroup().addTo(map);
      vertexLayerRef.current = vertexLayer;

      function redraw() {
        const pts = pointsRef.current;
        vertexLayer.clearLayers();
        pts.forEach(([lat, lng]) =>
          L.circleMarker([lat, lng], {
            radius: 5,
            color: "#8fb4ff",
            fillColor: "#5e8bff",
            fillOpacity: 1,
            weight: 2,
          }).addTo(vertexLayer),
        );
        if (polyRef.current) {
          map.removeLayer(polyRef.current);
          polyRef.current = null;
        }
        if (pts.length >= 2) {
          polyRef.current = L.polygon(pts, {
            color: "#5e8bff",
            weight: 2,
            fillColor: "#5e8bff",
            fillOpacity: 0.18,
          }).addTo(map);
        }
        setCount(pts.length);
        if (pts.length >= 3) {
          const ring: [number, number][] = pts.map(([lat, lng]) => [lng, lat]);
          ring.push(ring[0]); // close the ring
          onChangeRef.current(ring);
        } else {
          onChangeRef.current(null);
        }
      }

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        pointsRef.current = [...pointsRef.current, [e.latlng.lat, e.latlng.lng]];
        redraw();
      });

      // expose redraw for the toolbar buttons via the ref container
      (map as unknown as { _bfRedraw: () => void })._bfRedraw = redraw;

      // Leaflet needs a size recalculation once it's visible in the modal.
      setTimeout(() => map.invalidateSize(), 50);

      cleanup = () => {
        map.remove();
        mapRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  function redrawNow() {
    const map = mapRef.current as unknown as { _bfRedraw?: () => void } | null;
    map?._bfRedraw?.();
  }
  function undo() {
    pointsRef.current = pointsRef.current.slice(0, -1);
    redrawNow();
  }
  function clear() {
    pointsRef.current = [];
    redrawNow();
  }

  return (
    <div className="areamapwrap">
      <div ref={containerRef} className="areamap" />
      <div className="areamap-toolbar">
        <span className="areamap-hint">
          {count === 0
            ? "Tap the map to start drawing your area"
            : count < 3
              ? `${count} point${count === 1 ? "" : "s"} — add at least 3`
              : `Area set · ${count} points`}
        </span>
        <div className="areamap-btns">
          <button type="button" className="rangebtn" onClick={undo} disabled={count === 0}>
            Undo
          </button>
          <button type="button" className="rangebtn" onClick={clear} disabled={count === 0}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
