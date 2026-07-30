export interface PartnerStore {
  id: string;
  name: string;
  type: string;
  country: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  image: string;
  phone: string;
  hours: string;
  description: string;
  days?: string;
  priceRange?: string;
  'menu-images'?: string[];
}

export interface GroupedStores {
  [city: string]: PartnerStore[];
}

// Country ▸ City ▸ Store, for the nested submission picker and map filter.
export interface GroupedStoresByCountry {
  [country: string]: {
    [city: string]: PartnerStore[];
  };
}