import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import PartnerStoreDetailContent from '@/components/partner-store/PartnerStoreDetailContent';
import { fetchPartnerStoreById } from '@/data/partnerStore';
import {
  formatDistanceM,
  haversineDistanceM,
  isValidCoordinatePair,
} from '@/lib/distance';
import type { PartnerStore } from '@/types';

export default function RestaurantStoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storeId = Array.isArray(id) ? id[0] : id;

  const [store, setStore] = useState<PartnerStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [distanceLabel, setDistanceLabel] = useState('Loading distance...');

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
          setDistanceLabel('Loading distance...');
        }
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setDistanceLabel('Loading distance...');
          }
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const distanceM = haversineDistanceM(
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
          setDistanceLabel(`${formatDistanceM(distanceM)} from your current location`);
        }
      } catch {
        if (isMounted) {
          setDistanceLabel('Loading distance...');
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
      categoryLabel="Restaurant"
      store={store}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onBack={() => router.back()}
      distanceLabel={distanceLabel}
    />
  );
}
