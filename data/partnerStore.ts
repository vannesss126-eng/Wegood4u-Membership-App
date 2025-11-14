import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { PartnerStore, GroupedStores } from '@/types';

/**
 * Fetches all partner stores from Firestore
 * @returns Promise<PartnerStore[]> Array of partner stores
 */
export const fetchPartnerStores = async (): Promise<PartnerStore[]> => {
  try {
    // Check if Firebase is properly initialized
    if (!db) {
      throw new Error('Firebase database not initialized');
    }

    const partnerStoresCollection = collection(db, 'partner_store');
    const querySnapshot = await getDocs(partnerStoresCollection);
    
    const partnerStores: PartnerStore[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Validate required fields
      if (!data.name || !data.city) {
        console.warn(`Skipping store with invalid data: ${doc.id}`);
        return;
      }
      
      partnerStores.push({
        id: doc.id,
        name: data.name || '',
        type: data.type || '',
        city: data.city || '',
        latitude: typeof data.latitude === 'number' ? data.latitude : 0,
        longitude: typeof data.longitude === 'number' ? data.longitude : 0,
        rating: typeof data.rating === 'number' ? data.rating : 0,
        image: data.image || '',
        phone: data.phone || '',
        hours: data.hours || '',
        description: data.description || '',
      });
    });
    
    console.log(`Successfully loaded ${partnerStores.length} partner stores`);
    return partnerStores;
  } catch (error) {
    console.error('Error fetching partner stores:', error);
    
    // Return empty array instead of throwing to prevent app crashes
    console.log('Returning empty stores array due to error');
    return [];
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