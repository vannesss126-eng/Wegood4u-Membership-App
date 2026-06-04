import React from 'react';
import PartnerStoreCategoryScreen from '@/components/partner-store/PartnerStoreCategoryScreen';
import { fetchPartnerStores } from '@/data/partnerStore';

const loadRestaurants = async () => {
  const stores = await fetchPartnerStores();
  return stores.filter(store =>
    store.type.toLowerCase().includes('restaurant') ||
    store.type.toLowerCase().includes('italian') ||
    store.type.toLowerCase().includes('japanese') ||
    store.type.toLowerCase().includes('fast food') ||
    store.type.toLowerCase().includes('healthy food')
  );
};

export default function RestaurantScreen() {
  return (
    <PartnerStoreCategoryScreen
      title="Restaurant"
      categoryRoute="restaurant"
      searchPlaceholder="Search restaurants..."
      emptyText="No restaurants found"
      loadStores={loadRestaurants}
    />
  );
}
