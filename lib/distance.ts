export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_M = 6371000;

export function isValidCoordinatePair(coords: Coordinates): boolean {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    !(coords.latitude === 0 && coords.longitude === 0)
  );
}

export function haversineDistanceM(from: Coordinates, to: Coordinates): number {
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);

  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function formatDistanceM(distanceM: number): string {
  if (!Number.isFinite(distanceM) || distanceM < 0) {
    return 'Loading distance...';
  }

  if (distanceM < 1000) {
    return `${Math.round(distanceM)}m`;
  }

  const distanceKm = Math.floor(distanceM / 1000);
  if (distanceKm > 99) {
    return '+99km';
  }
  return `+${distanceKm}km`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
