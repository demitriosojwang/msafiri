// GPS calculation utilities for live tracking.
// In production, these would use PostGIS ST_Distance / ST_MakeLine on the server.
// Here we simulate with Haversine distance and linear interpolation.

import type { CabETA, DriverPosition, Stage } from './types';
import { TERMINUS_GPS } from './seed';

// Haversine distance between two GPS points (km)
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Interpolate a position along a route from stage → terminus (or terminus → stage for outbound).
// progress: 0 = at origin, 1 = at destination
export function interpolatePosition(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  progress: number,
): { lat: number; lng: number } {
  return {
    lat: origin.lat + (destination.lat - origin.lat) * progress,
    lng: origin.lng + (destination.lng - origin.lng) * progress,
  };
}

// Compute a driver's simulated live position based on their route progress.
// Inbound: cab starts at stage, heads to terminus (progress 0→1)
// Outbound: cab starts at terminus, heads to stage (progress 0→1)
export function computeDriverPosition(
  cabId: string,
  stage: Stage,
  direction: 'inbound' | 'outbound',
  routeProgress: number,
): DriverPosition {
  const origin = direction === 'inbound' ? stage : TERMINUS_GPS;
  const destination = direction === 'inbound' ? TERMINUS_GPS : stage;
  const pos = interpolatePosition(origin, destination, routeProgress);

  // Heading: rough bearing from origin to destination
  const heading = computeBearing(origin.lat, origin.lng, destination.lat, destination.lng);

  // Simulated speed: 30-50 km/h typical for Mombasa roads
  const speedKmh = 30 + Math.random() * 20;

  return {
    cabId,
    lat: pos.lat,
    lng: pos.lng,
    heading,
    speedKmh: Math.round(speedKmh),
    recordedAt: Date.now(),
    routeProgress,
  };
}

// Compute bearing between two GPS points (0-359 degrees)
function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(bearing);
}

function toDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

// Compute ETA for a cab to reach a passenger's stage.
// Returns distance (km) and estimated minutes.
export function computeETA(
  driverPos: DriverPosition,
  passengerStage: Stage,
  stageTravelMin: number,
): { distanceKm: number; etaMin: number } {
  const distanceKm = haversineKm(driverPos.lat, driverPos.lng, passengerStage.lat, passengerStage.lng);
  // ETA = distance / speed, but use stage's typical travel time as a baseline
  // and scale by remaining route progress for realism
  const remainingProgress = 1 - driverPos.routeProgress;
  const etaMin = Math.max(1, Math.round(stageTravelMin * remainingProgress));
  return { distanceKm: Math.round(distanceKm * 10) / 10, etaMin };
}

// Format ETA for display: "about 6 min", "less than 1 min", "arriving"
export function fmtETA(etaMin: number): string {
  if (etaMin <= 0) return 'arriving';
  if (etaMin < 1) return 'less than 1 min';
  if (etaMin === 1) return 'about 1 min';
  if (etaMin < 60) return `about ${etaMin} min`;
  const h = Math.floor(etaMin / 60);
  const m = etaMin % 60;
  return m === 0 ? `about ${h}h` : `about ${h}h ${m}m`;
}

// Format distance for display
export function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
