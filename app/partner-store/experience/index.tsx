import React from 'react';
import PartnerStoreCategoryScreen from '@/components/partner-store/PartnerStoreCategoryScreen';
import { fetchPartnerStores } from '@/data/partnerStore';

const loadExperiences = async () => {
  const stores = await fetchPartnerStores();
  const shuffled = [...stores].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 20);
};

export default function ExperienceScreen() {
  return (
    <PartnerStoreCategoryScreen
      title="Experience"
      categoryRoute="experience"
      searchPlaceholder="Search experiences..."
      loadingText="Loading experiences..."
      emptyText="No experiences found"
      loadStores={loadExperiences}
    />
  );
}
