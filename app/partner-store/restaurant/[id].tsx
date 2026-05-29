import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import PartnerStoreDetailContent from '@/components/partner-store/PartnerStoreDetailContent';
import { fetchPartnerStoreById } from '@/data/partnerStore';
import {
  formatDistanceM,
  haversineDistanceM,
  isValidCoordinatePair,
} from '@/lib/distance';
import { useUserLocation } from '@/lib/userLocation';
import type { PartnerStore } from '@/types';

export default function RestaurantStoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storeId = Array.isArray(id) ? id[0] : id;

  const [store, setStore] = useState<PartnerStore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userLocation = useUserLocation();

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

  const distanceLabel = useMemo(() => {
    if (
      !store ||
      !userLocation ||
      !isValidCoordinatePair({ latitude: store.latitude, longitude: store.longitude })
    ) {
      return 'Loading distance...';
    }

    const distanceM = haversineDistanceM(userLocation, {
      latitude: store.latitude,
      longitude: store.longitude,
    });
    return `${formatDistanceM(distanceM)} from your current location`;
  }, [store, userLocation]);

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
