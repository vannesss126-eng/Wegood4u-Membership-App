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