export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371;

export function isValidCoordinatePair(coords: Coordinates): boolean {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    !(coords.latitude === 0 && coords.longitude === 0)
  );
}

export function haversineDistanceKm(from: Coordinates, to: Coordinates): number {
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);

  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function formatDistanceKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return 'Distance unavailable';
  }

  if (distanceKm < 1) {
    return '<1 km';
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  }

  return `${Math.round(distanceKm)} km`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
