import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import PartnerStoreDetailContent from '@/components/partner-store/PartnerStoreDetailContent';
import { fetchPartnerStoreById } from '@/data/partnerStore';
import {
  formatDistanceKm,
  haversineDistanceKm,
  isValidCoordinatePair,
} from '@/lib/distance';
import type { PartnerStore } from '@/types';

export default function CafeStoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storeId = Array.isArray(id) ? id[0] : id;

  const [store, setStore] = useState<PartnerStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [distanceLabel, setDistanceLabel] = useState('Distance unavailable');

  useEffect(() => {
    let isMounted = true;

    const loadStore = async () => {
      if (!storeId) {
        if (isMounted) {
          setErrorMessage('Missing store id.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      const result = await fetchPartnerStoreById(storeId);

      if (!isMounted) {
        return;
      }

      if (!result) {
        setErrorMessage('Store not found.');
      } else {
        setStore(result);
      }
      setIsLoading(false);
    };

    loadStore();

    return () => {
      isMounted = false;
    };
  }, [storeId]);

  useEffect(() => {
    let isMounted = true;

    const loadDistance = async () => {
      if (!store || !isValidCoordinatePair({ latitude: store.latitude, longitude: store.longitude })) {
        if (isMounted) {
          setDistanceLabel('Distance unavailable');
        }
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setDistanceLabel('Distance unavailable');
          }
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const distanceKm = haversineDistanceKm(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          {
            latitude: store.latitude,
            longitude: store.longitude,
          }
        );

        if (isMounted) {
          setDistanceLabel(`${formatDistanceKm(distanceKm)} from your current location`);
        }
      } catch {
        if (isMounted) {
          setDistanceLabel('Distance unavailable');
        }
      }
    };

    loadDistance();

    return () => {
      isMounted = false;
    };
  }, [store]);

  return (
    <PartnerStoreDetailContent
      categoryLabel="Cafe"
      store={store}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onBack={() => router.back()}
      distanceLabel={distanceLabel}
    />
  );
}
