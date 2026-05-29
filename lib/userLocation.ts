import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from './distance';

/**
 * Session-wide cache for the user's current location.
 *
 * Getting a GPS fix takes a few seconds, and every screen used to request it
 * independently — which is why "Loading distance..." reappeared on each
 * navigation. We fetch the location once, cache it at module scope for the
 * lifetime of the app session, and hand the cached value to every later caller
 * synchronously. Concurrent requests share a single in-flight promise so we
 * never fire the GPS request more than once at a time.
 */
let cachedLocation: Coordinates | null = null;
let inFlight: Promise<Coordinates | null> | null = null;

export function getCachedUserLocation(): Coordinates | null {
  return cachedLocation;
}

export async function getUserLocation(
  options?: { force?: boolean }
): Promise<Coordinates | null> {
  if (!options?.force && cachedLocation) {
    return cachedLocation;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      cachedLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      return cachedLocation;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Returns the cached user location, fetching it once if not yet available.
 * Re-renders the consuming component as soon as the location is known. After
 * the first successful fetch this resolves synchronously from cache, so the
 * distance is shown immediately on every subsequent screen.
 */
export function useUserLocation(): Coordinates | null {
  const [location, setLocation] = useState<Coordinates | null>(() =>
    getCachedUserLocation()
  );

  useEffect(() => {
    if (location) {
      return;
    }

    let isMounted = true;
    getUserLocation().then((coords) => {
      if (isMounted && coords) {
        setLocation(coords);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [location]);

  return location;
}
