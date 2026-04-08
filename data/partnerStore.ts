import {
  collection,
  getDocs,
  doc,
  getDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { PartnerStore, GroupedStores } from '@/types';

function mapDocToPartnerStore(docId: string, data: DocumentData): PartnerStore | null {
  if (!data.name || !data.city) {
    return null;
  }

  return {
    id: docId,
    name: data.name || '',
    type: data.type || '',
    city: data.city || '',
    address: typeof data.address === 'string' ? data.address : '',
    latitude: typeof data.latitude === 'number' ? data.latitude : 0,
    longitude: typeof data.longitude === 'number' ? data.longitude : 0,
    rating: typeof data.rating === 'number' ? data.rating : 0,
    image: data.image || '',
    phone: data.phone || '',
    hours: data.hours || '',
    description: data.description || '',
    days: data.days,
    priceRange: data.priceRange,
    'menu-images': data['menu-images'],
  };
}

/**
 * Fetches all partner stores from Firestore
 * @returns Promise<PartnerStore[]> Array of partner stores
 */
export const fetchPartnerStores = async (): Promise<PartnerStore[]> => {
  try {
    if (!db) {
      throw new Error('Firebase database not initialized');
    }

    const partnerStoresCollection = collection(db, 'partner_store');
    const querySnapshot = await getDocs(partnerStoresCollection);

    const partnerStores: PartnerStore[] = [];

    querySnapshot.forEach((docSnap) => {
      const mapped = mapDocToPartnerStore(docSnap.id, docSnap.data());
      if (!mapped) {
        console.warn(`Skipping store with invalid data: ${docSnap.id}`);
        return;
      }
      partnerStores.push(mapped);
    });

    console.log(`Successfully loaded ${partnerStores.length} partner stores`);
    return partnerStores;
  } catch (error) {
    console.error('Error fetching partner stores:', error);
    console.log('Returning empty stores array due to error');
    return [];
  }
};

/**
 * Fetches a single partner store by Firestore document id.
 * @returns The store or null if missing, invalid, or on error.
 */
export const fetchPartnerStoreById = async (id: string): Promise<PartnerStore | null> => {
  if (!db || !id?.trim()) {
    return null;
  }

  try {
    const ref = doc(db, 'partner_store', id);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    return mapDocToPartnerStore(snapshot.id, snapshot.data());
  } catch (error) {
    console.error('Error fetching partner store by id:', error);
    return null;
  }
};

/**
 * Groups partner stores by city
 * @param stores Array of partner stores
  * @returns GroupedStores Stores grouped by city
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
 * Gets unique cities from partner stores
 * @param stores Array of partner stores
 * @returns string[] Array of unique city names
 */
export const getUniqueCities = (stores: PartnerStore[]): string[] => {
  const cities = stores.map(store => store.city);
  return [...new Set(cities)].sort();
};
