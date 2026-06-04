import React from 'react';
import PartnerStoreCategoryScreen from '@/components/partner-store/PartnerStoreCategoryScreen';
import { fetchPartnerStores } from '@/data/partnerStore';

const loadBars = async () => {
  const stores = await fetchPartnerStores();
  return stores.filter(store =>
    store.type.toLowerCase().includes('beverage') ||
    store.type.toLowerCase().includes('bar')
  );
};

export default function BarScreen() {
  return (
    <PartnerStoreCategoryScreen
      title="Bar & Beverages"
      categoryRoute="bar"
      searchPlaceholder="Search bars..."
      emptyText="No bars found"
      loadStores={loadBars}
    />
  );
}
