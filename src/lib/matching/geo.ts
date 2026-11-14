import type { Ring } from "./types";

/**
 * Geometry pre-filter for the matching engine.
 *
 * The AUTHORITATIVE area intersection lives in PostGIS (ST_Intersection +
 * ST_Area > 0, and ST_Covers for venue containment) — see §11.3 of the spec.
 * These pure helpers exist to (a) cheaply reject obviously disjoint areas
 * before hitting the database, and (b) keep the engine unit-testable without a
 * live PostGIS connection. They must never be treated as proof that a real,
 * non-zero-area overlap exists.
 */

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function ringBBox(ring: Ring): BBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

export function areaBBox(area: Ring[]): BBox {
  const boxes = area.map(ringBBox);
  return {
    minLng: Math.min(...boxes.map((b) => b.minLng)),
    minLat: Math.min(...boxes.map((b) => b.minLat)),
    maxLng: Math.max(...boxes.map((b) => b.maxLng)),
    maxLat: Math.max(...boxes.map((b) => b.maxLat)),
  };
}

/** Bounding boxes overlap with positive area (shared edge alone does not count). */
export function bboxesOverlap(a: BBox, b: BBox): boolean {
  return a.minLng < b.maxLng && a.maxLng > b.minLng && a.minLat < b.maxLat && a.maxLat > b.minLat;
}

/**
 * Cheap necessary (not sufficient) condition for two areas to share a region.
 * A false result guarantees no overlap; a true result still needs PostGIS to
 * confirm a non-zero-area intersection.
 */
export function areasMayOverlap(a: Ring[], b: Ring[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return bboxesOverlap(areaBBox(a), areaBBox(b));
}

/** Ray-casting point-in-polygon test for a single ring. Used for venue checks. */
export function pointInRing(point: [number, number], ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** True if a point falls inside any ring of the area (outer-ring approximation). */
export function pointInArea(point: [number, number], area: Ring[]): boolean {
  return area.some((ring) => pointInRing(point, ring));
}
