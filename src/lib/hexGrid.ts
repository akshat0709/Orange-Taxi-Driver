// Hexagonal (H3) location index, shared by the rider app, driver app and website.
// Resolution 7 hexagons are about 1.4 km per side. A driver saves the hexagon they are in; a
// booking saves its pickup hexagon plus 4 rings around it (61 hexagons, always covers 5 km).
// The database matches ride requests to drivers in those hexagons, then checks exact distance
// (migration 20261027100000_h3_hex_matching.sql). Keep these numbers in sync with it.
import { gridDisk, latLngToCell } from 'h3-js';

export const H3_RESOLUTION = 7;
export const H3_RING_SIZE = 4;

const valid = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** The hexagon a point is in, or null for a missing or invalid position. */
export function hexCell(lat: unknown, lng: unknown): string | null {
  if (!valid(lat, lng)) return null;
  try {
    return latLngToCell(lat, lng as number, H3_RESOLUTION);
  } catch {
    return null;
  }
}

/** Columns to save with a booking: the pickup hexagon and its ring. Empty if the pickup is unknown. */
export function pickupHexColumns(lat: unknown, lng: unknown): { pickup_h3_r7?: string; pickup_h3_ring?: string[] } {
  const cell = hexCell(lat, lng);
  if (!cell) return {};
  try {
    return { pickup_h3_r7: cell, pickup_h3_ring: gridDisk(cell, H3_RING_SIZE) };
  } catch {
    return {};
  }
}
