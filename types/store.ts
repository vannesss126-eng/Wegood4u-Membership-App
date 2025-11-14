export interface PartnerStore {
  id: string;
  name: string;
  type: string;
  city: string;
  latitude: number;
  longitude: number;
  rating: number;
  image: string;
  phone: string;
  hours: string;
  description: string;
}

export interface GroupedStores {
  [city: string]: PartnerStore[];
}

// NFT Store Types
export interface NFTProduct {
  id: string;
  name: string;
  category: 'zodiac' | 'horoscope';
  // price: number;
  image: string;
  description: string;
  createdAt: string;
}

export interface StoreFilters {
  category: 'all' | 'zodiac' | 'horoscope';
  sortBy: 'latest' | 'alphabetical' | 'price-low' | 'price-high';
  searchQuery: string;
  selectedZodiac?: string;
  selectedHoroscope?: string;
}