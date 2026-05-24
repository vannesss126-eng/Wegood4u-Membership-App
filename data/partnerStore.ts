import { supabase } from '@/lib/supabase';
import type { PartnerStore, GroupedStores } from '@/types';

type PartnerStoreRow = {
  id: string;
  name: string;
  type: string | null;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  image: string | null;
  phone: string | null;
  hours: string | null;
  description: string | null;
  price_range: string | null;
  days: string | null;
  menu_images: string[] | null;
  active: boolean;
};

function mapRowToPartnerStore(row: PartnerStoreRow): PartnerStore | null {
  if (!row.name || !row.city) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type ?? '',
    city: row.city,
    address: row.address ?? '',
    latitude: row.latitude ?? 0,
    longitude: row.longitude ?? 0,
    rating: row.rating ?? 0,
    image: row.image ?? '',
    phone: row.phone ?? '',
    hours: row.hours ?? '',
    description: row.description ?? '',
    days: row.days ?? undefined,
    priceRange: row.price_range ?? undefined,
    'menu-images': row.menu_images ?? undefined,
  };
}

/**
 * Fetches all partner stores from Supabase.
 * @returns Promise<PartnerStore[]> Array of partner stores
 */
export const fetchPartnerStores = async (): Promise<PartnerStore[]> => {
  try {
    const { data, error } = await supabase
      .from('partner_stores')
      .select('*');

    if (error) {
      console.error('Error fetching partner stores:', error);
      console.log('Returning empty stores array due to error');
      return [];
    }

    const partnerStores: PartnerStore[] = [];
    for (const row of (data ?? []) as PartnerStoreRow[]) {
      const mapped = mapRowToPartnerStore(row);
      if (!mapped) {
        console.warn(`Skipping store with invalid data: ${row.id}`);
        continue;
      }
      partnerStores.push(mapped);
    }

    console.log(`Successfully loaded ${partnerStores.length} partner stores`);
    return partnerStores;
  } catch (error) {
    console.error('Error fetching partner stores:', error);
    console.log('Returning empty stores array due to error');
    return [];
  }
};

/**
 * Fetches a single partner store by id (preserved Firestore doc id).
 * @returns The store or null if missing, invalid, or on error.
 */
export const fetchPartnerStoreById = async (id: string): Promise<PartnerStore | null> => {
  if (!id?.trim()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('partner_stores')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching partner store by id:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return mapRowToPartnerStore(data as PartnerStoreRow);
  } catch (error) {
    console.error('Error fetching partner store by id:', error);
    return null;
  }
};

/**
 * Groups partner stores by city.
 */
export const groupStoresByCity = (stores: PartnerStore[]): GroupedStores => {
  return stores.reduce((acc: GroupedStores, store) => {
    if (!acc[store.city]) {
      acc[store.city] = [];
    }
    acc[store.city].push(store);
    return acc;
  }, {} as GroupedStores);
};

/**
 * Gets unique cities from partner stores.
 */
export const getUniqueCities = (stores: PartnerStore[]): string[] => {
  const cities = stores.map(store => store.city);
  return [...new Set(cities)].sort();
};
