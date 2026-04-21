import React from 'react';
import PartnerStoreCategoryScreen from '@/components/partner-store/PartnerStoreCategoryScreen';
import { fetchPartnerStores } from '@/data/partnerStore';

const loadCafes = async () => {
  const stores = await fetchPartnerStores();
  return stores.filter(store =>
    store.type.toLowerCase().includes('coffee') ||
    store.type.toLowerCase().includes('dessert') ||
    store.type.toLowerCase().includes('cafe')
  );
};

export default function CafeScreen() {
  return (
    <PartnerStoreCategoryScreen
      title="Cafe"
      categoryRoute="cafe"
      searchPlaceholder="Search cafes..."
      loadingText="Loading cafes..."
      emptyText="No cafes found"
      loadStores={loadCafes}
    />
  );
}
