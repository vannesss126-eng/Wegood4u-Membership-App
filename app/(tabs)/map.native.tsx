import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, type Region } from 'react-native-maps';
import Supercluster from 'supercluster';
import { MapPin, Star, Phone, Clock, Navigation, ChevronDown } from 'lucide-react-native';
import { fetchPartnerStores, groupStoresByCountryAndCity } from '@/data/partnerStore';
import type { PartnerStore } from '@/types';
import { FallbackMap } from '@/components/FallbackMap';
import { useUserLocation, getCachedUserLocation } from '@/lib/userLocation';
import {
  haversineDistanceM,
  formatDistanceM,
  isValidCoordinatePair,
  type Coordinates,
} from '@/lib/distance';

// Custom-view markers force react-native-maps to rasterize the pin into a
// bitmap on every ViewChangesTracker tick. With tracksViewChanges left at its
// default (true) that loop leaks bitmaps until the app OOM-crashes. Our pin is
// a static SVG, so we only need to track changes until it has painted once,
// then turn tracking off.
function VenueMarker({
  store,
  onPress,
  distanceLabel,
  highlighted,
}: {
  store: PartnerStore;
  onPress: () => void;
  distanceLabel?: string | null;
  highlighted?: boolean;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // Re-rasterize on mount AND whenever the highlight flips. The marker stops
  // tracking view changes after it first paints, so without re-arming this the
  // highlighted look would never appear when a store is selected.
  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return (
    <Marker
      coordinate={{ latitude: store.latitude, longitude: store.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      zIndex={highlighted ? 999 : 1}
    >
      <View style={styles.markerContainer}>
        <View style={[styles.marker, highlighted && styles.markerHighlighted]}>
          <MapPin size={highlighted ? 24 : 20} color={highlighted ? '#FFFFFF' : '#F33F32'} />
        </View>
      </View>
      <Callout>
        <View style={styles.calloutContainer}>
          <Text style={styles.calloutTitle}>{store.name}</Text>
          <Text style={styles.calloutType}>{store.type}</Text>
          <Text style={styles.calloutCity}>{store.city}</Text>
          {distanceLabel ? (
            <Text style={styles.calloutDistance}>{distanceLabel} away</Text>
          ) : null}
          <View style={styles.calloutRating}>
            <Star size={12} color="#FFD700" />
            <Text style={styles.calloutRatingText}>{store.rating}</Text>
          </View>
        </View>
      </Callout>
    </Marker>
  );
}

// A grouped-pin bubble shown when several stores sit close together at the
// current zoom. Like VenueMarker, it must track view changes until the bubble
// has rasterized once — on Android a custom-view Marker that mounts with
// tracksViewChanges={false} never captures a bitmap and renders blank. The
// count is baked into this component's key, so a changed count remounts it and
// re-triggers the initial tracking window.
function ClusterMarker({
  longitude,
  latitude,
  count,
  onPress,
}: {
  longitude: number;
  latitude: number;
  count: number;
  onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.clusterMarker}>
        <Text style={styles.clusterText}>{count}</Text>
      </View>
    </Marker>
  );
}

// Convert a map Region to the [westLng, southLat, eastLng, northLat] bbox and
// integer zoom level that supercluster's getClusters() expects.
function regionToBBox(region: Region): [number, number, number, number] {
  return [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
}

function regionToZoom(region: Region): number {
  const zoom = Math.round(Math.log2(360 / region.longitudeDelta));
  return Math.max(0, Math.min(20, zoom));
}

export default function MapScreen() {
  // Session-cached GPS fix (fetched once, shared across screens). null until the
  // user grants permission and the first fix lands, or forever if they decline.
  const userLocation = useUserLocation();
  const [partnerStores, setPartnerStores] = useState<PartnerStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<PartnerStore | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<{ [key: string]: boolean }>({});
  const [expandedCities, setExpandedCities] = useState<{ [key: string]: boolean }>({});
  // Tracks the map's currently visible area so clustering recomputes at the
  // right zoom as the user pans/zooms. Starts null and is seeded on first render.
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView>(null);
  // Flips true once the user manually pans/drags, so the "center on me"
  // auto-centering never yanks the map out from under them afterwards.
  const userInteractedRef = useRef(false);

  // Distance (metres) from the user to a store. Infinity when either the user
  // location or the store's coordinates are unknown, so those sort to the end.
  const distanceOf = useCallback(
    (store: PartnerStore): number => {
      const coords = { latitude: store.latitude, longitude: store.longitude };
      if (!userLocation || !isValidCoordinatePair(coords)) return Infinity;
      return haversineDistanceM(userLocation, coords);
    },
    [userLocation]
  );

  // Group stores into a Country ▸ City ▸ Store tree.
  const groupedByCountry = groupStoresByCountryAndCity(partnerStores);
  // Set of all city names, for resolving a city-level filter.
  const cityNames = new Set(partnerStores.map((s) => s.city));

  // The nearest store in a list defines that group's rank (Feature ①).
  const nearestInList = (list: PartnerStore[]) =>
    list.length ? Math.min(...list.map(distanceOf)) : Infinity;

  // Countries ordered nearest-first once we know where the user is; else A→Z.
  const countryNames = Object.keys(groupedByCountry).sort((a, b) => {
    if (!userLocation) return a.localeCompare(b);
    const na = Math.min(...Object.values(groupedByCountry[a]).map(nearestInList));
    const nb = Math.min(...Object.values(groupedByCountry[b]).map(nearestInList));
    return na - nb;
  });

  // Cities within a country, ordered nearest-first; else A→Z.
  const citiesOfCountry = (country: string) => {
    const cityMap = groupedByCountry[country] ?? {};
    return Object.keys(cityMap).sort((a, b) => {
      if (!userLocation) return a.localeCompare(b);
      return nearestInList(cityMap[a]) - nearestInList(cityMap[b]);
    });
  };

  const getFilteredStores = () => {
    if (!partnerStores || partnerStores.length === 0) {
      return [];
    }
    
    if (selectedFilter === 'All') {
      return partnerStores;
    }
    
    // Check if it's a city filter
    if (cityNames.has(selectedFilter)) {
      return partnerStores.filter(store => store.city === selectedFilter);
    }

    // Check if it's a specific store
    const specificStore = partnerStores.find(store => store.name === selectedFilter);
    return specificStore ? [specificStore] : partnerStores;
  };
  
  const filteredStores = getFilteredStores();
  
  const getDropdownDisplayText = () => {
    if (selectedFilter === 'All') return 'All Locations';
    
    // Check if it's a specific store
    const specificStore = partnerStores.find(store => store.name === selectedFilter);
    if (specificStore) {
      return specificStore.name;
    }
    
    return selectedFilter;
  };
  
  const getMapRegion = () => {
    // If a specific store is selected, center on that store
    const specificStore = partnerStores.find(store => store.name === selectedFilter);
    if (specificStore && specificStore.latitude !== 0 && specificStore.longitude !== 0) {
      return {
        latitude: specificStore.latitude,
        longitude: specificStore.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    
    // Check if it's a city filter
    if (cityNames.has(selectedFilter)) {
      const cityStores = partnerStores.filter(store => store.city === selectedFilter && store.latitude !== 0 && store.longitude !== 0);
      if (cityStores.length > 0) {
        // Calculate center of city stores
        const avgLat = cityStores.reduce((sum, store) => sum + store.latitude, 0) / cityStores.length;
        const avgLng = cityStores.reduce((sum, store) => sum + store.longitude, 0) / cityStores.length;
        return {
          latitude: avgLat,
          longitude: avgLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }
    }
    
    // Show all stores with valid coordinates
    const validStores = partnerStores.filter(store => store.latitude !== 0 && store.longitude !== 0);
    if (validStores.length > 0) {
      const avgLat = validStores.reduce((sum, store) => sum + store.latitude, 0) / validStores.length;
      const avgLng = validStores.reduce((sum, store) => sum + store.longitude, 0) / validStores.length;
      return {
        latitude: avgLat,
        longitude: avgLng,
        latitudeDelta: 15,
        longitudeDelta: 15,
      };
    }
    
    // Fallback to Thailand region
    return {
      latitude: 18.79210626514222,
      longitude: 98.99534619999957,
      latitudeDelta: 5,
      longitudeDelta: 5,
    };
  };

  // A viewport centred on the user, zoomed just wide enough to include their
  // nearest partner store so at least one pin is visible on open.
  const buildUserRegion = (loc: Coordinates): Region => {
    const nearestM = partnerStores.reduce((min, s) => {
      const coords = { latitude: s.latitude, longitude: s.longitude };
      if (!isValidCoordinatePair(coords)) return min;
      return Math.min(min, haversineDistanceM(loc, coords));
    }, Infinity);
    // ~2.5× the nearest-store distance as padding, clamped to a ~3km–55km view.
    let delta = 0.05;
    if (Number.isFinite(nearestM)) {
      delta = Math.min(0.5, Math.max(0.03, ((nearestM / 1000) * 2.5) / 111));
    }
    return {
      latitude: loc.latitude,
      longitude: loc.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  };

  // The region the map first mounts with: the user's area if a cached fix is
  // already available, otherwise the all-stores overview.
  const cachedFix = getCachedUserLocation();
  const initialRegion = cachedFix ? buildUserRegion(cachedFix) : getMapRegion();

  // Build the supercluster index from ALL stores (not the current selection) so
  // the whole network stays visible on the map — picking a store/city just moves
  // the camera, it never hides the other pins. Rebuilds only when the data
  // changes, not on every pan, so panning/zooming stays cheap.
  const clusterIndex = useMemo(() => {
    const points = partnerStores
      .filter(store => store.latitude !== 0 && store.longitude !== 0)
      .map((store) => ({
        type: 'Feature' as const,
        properties: { store },
        geometry: {
          type: 'Point' as const,
          coordinates: [store.longitude, store.latitude] as [number, number],
        },
      }));
    const index = new Supercluster<{ store: PartnerStore }>({ radius: 50, maxZoom: 18 });
    index.load(points);
    return index;
  }, [partnerStores]);

  // The area we cluster for: the user's live viewport once known, else the
  // region the map opened with.
  const activeRegion = visibleRegion ?? initialRegion;

  const clusters = useMemo(
    () => clusterIndex.getClusters(regionToBBox(activeRegion), regionToZoom(activeRegion)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clusterIndex, activeRegion.latitude, activeRegion.longitude, activeRegion.latitudeDelta, activeRegion.longitudeDelta]
  );

  // Tapping a cluster zooms in to the level where it breaks apart.
  const handleClusterPress = (clusterId: number, longitude: number, latitude: number) => {
    const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(clusterId), 18);
    const delta = 360 / Math.pow(2, expansionZoom);
    mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta },
      300
    );
  };

  const getSubtitleText = () => {
    const count = filteredStores.length;
    if (selectedFilter === 'All') {
      return `${count} locations total`;
    }
    
    const specificStore = partnerStores.find(store => store.name === selectedFilter);
    if (specificStore) {
      return `${specificStore.city} • ${specificStore.type}`;
    }
    
    return `${count} locations in ${selectedFilter}`;
  };

  useEffect(() => {
    loadPartnerStores();
  }, []);

  // Center on the user once their location is known, and re-center whenever the
  // dropdown filter changes. An explicit city/store selection always wins; on
  // "All" we only recentre on the user if they haven't manually panned yet.
  useEffect(() => {
    if (selectedFilter === 'All') {
      if (userInteractedRef.current) return;
      if (userLocation) {
        mapRef.current?.animateToRegion(buildUserRegion(userLocation), 600);
      }
      return;
    }
    mapRef.current?.animateToRegion(getMapRegion(), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, userLocation]);

  const loadPartnerStores = async () => {
    try {
      setLoading(true);
      setError(null);
      const stores = await fetchPartnerStores();
      
      // Validate stores data
      if (!Array.isArray(stores)) {
        throw new Error('Invalid stores data received');
      }
      
      setPartnerStores(stores);
      
      // Countries start expanded (usually Malaysia + Thailand); cities collapsed.
      const countries = [...new Set(stores.map((store) => store.country))];
      setExpandedCountries(
        countries.reduce((acc, country) => {
          acc[country] = true;
          return acc;
        }, {} as { [key: string]: boolean })
      );
      setExpandedCities({});
    } catch (err) {
      console.error('Error loading partner stores:', err);
      setError('Failed to load partner stores. Please check your internet connection and try again.');
      
      // Set empty stores array to prevent crashes
      setPartnerStores([]);
    } finally {
      setLoading(false);
    }
  };

  const cityKey = (country: string, city: string) => `${country}::${city}`;

  const toggleCountryExpansion = (country: string) => {
    setExpandedCountries((prev) => ({ ...prev, [country]: !prev[country] }));
  };

  const toggleCityExpansion = (country: string, city: string) => {
    const key = cityKey(country, city);
    setExpandedCities((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const getDirections = (store: PartnerStore) => {
    Alert.alert(
      'Get Directions',
      `Open directions to ${store.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open', 
          onPress: async () => {
            try {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
              const supported = await Linking.canOpenURL(url);
              
              if (supported) {
                await Linking.openURL(url);
              } else {
                Alert.alert('Error', 'Unable to open Google Maps. Please install Google Maps app.');
              }
            } catch (error) {
              console.error('Error opening directions:', error);
              Alert.alert('Error', 'Unable to open directions. Please try again.');
            }
          }
        },
      ]
    );
  };

  const callStore = (phone: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'This store does not have a phone number available.');
      return;
    }
    
    Alert.alert(
      'Call Store',
      `Call ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call', 
          onPress: async () => {
            try {
              // Try different phone URL formats for better compatibility
              const phoneUrl = `tel:${phone}`;
              const supported = await Linking.canOpenURL(phoneUrl);
              
              if (supported) {
                await Linking.openURL(phoneUrl);
              } else {
                // If tel: doesn't work, try alternative methods
                if (Platform.OS === 'android') {
                  // For Android, try opening the dialer with the number
                  const dialerUrl = `tel:${phone}`;
                  try {
                    await Linking.openURL(dialerUrl);
                  } catch {
                    // If that fails, show instructions
                    Alert.alert(
                      'Call Instructions',
                      `To call this store, please dial: ${phone}\n\nOr copy the number and use your phone app.`,
                      [
                        { text: 'Copy Number', onPress: () => {
                          // You could add clipboard functionality here if needed
                          Alert.alert('Number Copied', `Phone number: ${phone}`);
                        }},
                        { text: 'OK' }
                      ]
                    );
                  }
                } else {
                  // For iOS, show instructions
                  Alert.alert(
                    'Call Instructions',
                    `To call this store, please dial: ${phone}\n\nOr copy the number and use your phone app.`,
                    [
                      { text: 'Copy Number', onPress: () => {
                        Alert.alert('Number Copied', `Phone number: ${phone}`);
                      }},
                      { text: 'OK' }
                    ]
                  );
                }
              }
            } catch (error) {
              console.error('Error opening phone dialer:', error);
              Alert.alert(
                'Call Instructions',
                `To call this store, please dial: ${phone}\n\nOr copy the number and use your phone app.`,
                [
                  { text: 'Copy Number', onPress: () => {
                    Alert.alert('Number Copied', `Phone number: ${phone}`);
                  }},
                  { text: 'OK' }
                ]
              );
            }
          }
        },
      ]
    );
  };

  // Show loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading partner stores...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPartnerStores}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Partner Stores</Text>
          <Text style={styles.subtitle}>{getSubtitleText()}</Text>
        </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={styles.dropdown}
          onPress={() => setShowDropdown(true)}
        >
          <Text style={styles.dropdownText}>{getDropdownDisplayText()}</Text>
          <ChevronDown size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {partnerStores.filter(store => store.latitude !== 0 && store.longitude !== 0).length > 0 ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            onRegionChangeComplete={setVisibleRegion}
            onPanDrag={() => {
              userInteractedRef.current = true;
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {clusters.map((c) => {
              const [longitude, latitude] = c.geometry.coordinates;
              const props = c.properties;

              if ('cluster' in props && props.cluster) {
                return (
                  <ClusterMarker
                    key={`cluster-${props.cluster_id}-${props.point_count}`}
                    longitude={longitude}
                    latitude={latitude}
                    count={props.point_count}
                    onPress={() => handleClusterPress(props.cluster_id, longitude, latitude)}
                  />
                );
              }

              const store = props.store;
              const distanceLabel =
                userLocation &&
                isValidCoordinatePair({ latitude: store.latitude, longitude: store.longitude })
                  ? formatDistanceM(distanceOf(store))
                  : null;
              return (
                <VenueMarker
                  key={store.id}
                  store={store}
                  distanceLabel={distanceLabel}
                  highlighted={selectedStore?.id === store.id}
                  onPress={() => setSelectedStore(store)}
                />
              );
            })}
          </MapView>
        ) : (
          <FallbackMap message="No partner stores available" />
        )}
      </View>

      {selectedStore && (
        <View style={styles.storeDetailsContainer}>
          <ScrollView style={styles.storeDetails} showsVerticalScrollIndicator={false}>
            <View style={styles.storeHeader}>
              <Image source={{ uri: selectedStore.image }} style={styles.storeImage} />
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{selectedStore.name}</Text>
                <Text style={styles.storeType}>{selectedStore.type}</Text>
                <View style={styles.storeRating}>
                  <Star size={16} color="#FFD700" />
                  <Text style={styles.storeRatingText}>{selectedStore.rating}</Text>
                </View>
                <Text style={styles.storeDescription}>{selectedStore.description}</Text>
              </View>
            </View>

            <View style={styles.storeContact}>
              {selectedStore.phone && (
                <View style={styles.contactItem}>
                  <Phone size={16} color="#64748B" />
                  <Text style={styles.contactText}>{selectedStore.phone}</Text>
                </View>
              )}
              <View style={styles.contactItem}>
                <Clock size={16} color="#64748B" />
                <Text style={styles.contactText}>{selectedStore.hours}</Text>
              </View>
            </View>

            <View style={styles.storeActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => getDirections(selectedStore)}
              >
                <Navigation size={18} color="white" />
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.callButton]}
                onPress={() => callStore(selectedStore.phone)}
              >
                <Phone size={18} color="white" />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedStore(null)}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownModal}>
            <ScrollView 
              style={styles.dropdownScrollView}
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.dropdownTitle}>Select Location or Store</Text>
            
            {/* All Locations Option */}
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                selectedFilter === 'All' && styles.selectedDropdownItem
              ]}
              onPress={() => {
                userInteractedRef.current = false;
                setSelectedFilter('All');
                setShowDropdown(false);
                setSelectedStore(null);
              }}
            >
              <Text style={[
                styles.dropdownItemText,
                selectedFilter === 'All' && styles.selectedDropdownItemText
              ]}>
                All Locations
              </Text>
              <Text style={styles.storeCount}>
                {partnerStores.length} stores
              </Text>
            </TouchableOpacity>

            {/* Country ▸ City ▸ Store */}
            {countryNames.map((country) => {
              const countryOpen = expandedCountries[country];
              const cityList = citiesOfCountry(country);
              const countryStoreCount = cityList.reduce(
                (sum, c) => sum + (groupedByCountry[country][c]?.length ?? 0),
                0
              );
              return (
                <React.Fragment key={country}>
                  {/* Country Header - Collapsible */}
                  <TouchableOpacity
                    style={[styles.dropdownItem, styles.countryHeader]}
                    onPress={() => toggleCountryExpansion(country)}
                  >
                    <Text style={[styles.dropdownItemText, styles.countryHeaderText]}>
                      {country}
                    </Text>
                    <Text style={styles.storeCount}>{countryStoreCount} stores</Text>
                  </TouchableOpacity>

                  {countryOpen &&
                    cityList.map((city) => {
                      const cityStores = [...(groupedByCountry[country][city] || [])].sort(
                        (a, b) => distanceOf(a) - distanceOf(b)
                      );
                      const cityOpen = expandedCities[cityKey(country, city)];
                      return (
                        <React.Fragment key={city}>
                          <TouchableOpacity
                            style={[
                              styles.dropdownItem,
                              styles.cityHeader,
                              styles.cityHeaderNested,
                              selectedFilter === city && styles.selectedDropdownItem,
                            ]}
                            onPress={() => {
                              toggleCityExpansion(country, city);
                              if (!cityOpen) {
                                setSelectedFilter(city);
                                setSelectedStore(null);
                              }
                            }}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              styles.cityHeaderText,
                              selectedFilter === city && styles.selectedDropdownItemText,
                            ]}>
                              {city}
                            </Text>
                            <Text style={[
                              styles.storeCount,
                              selectedFilter === city && { color: 'rgba(255,255,255,0.8)' },
                            ]}>
                              {cityStores.length} stores
                            </Text>
                          </TouchableOpacity>

                          {/* City Stores */}
                          {cityOpen &&
                            cityStores.map((store) => (
                              <TouchableOpacity
                                key={store.id}
                                style={[
                                  styles.dropdownItem,
                                  styles.storeItem,
                                  styles.storeItemNested,
                                  selectedFilter === store.name && styles.selectedDropdownItem,
                                ]}
                                onPress={() => {
                                  setSelectedFilter(store.name);
                                  setShowDropdown(false);
                                  setSelectedStore(store);
                                }}
                              >
                                <Text style={[
                                  styles.storeItemText,
                                  selectedFilter === store.name && styles.selectedDropdownItemText,
                                ]}>
                                  • {store.name}
                                </Text>
                                <Text style={[
                                  styles.storeTypeText,
                                  selectedFilter === store.name && { color: 'rgba(255,255,255,0.8)' },
                                ]}>
                                  {store.type}
                                </Text>
                                {userLocation &&
                                  isValidCoordinatePair({ latitude: store.latitude, longitude: store.longitude }) && (
                                    <Text style={[
                                      styles.storeDistanceText,
                                      selectedFilter === store.name && { color: 'rgba(255,255,255,0.9)' },
                                    ]}>
                                      {formatDistanceM(distanceOf(store))} away
                                    </Text>
                                  )}
                              </TouchableOpacity>
                            ))}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  clusterMarker: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#F33F32',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  marker: {
    width: 30,
    height: 30,
    padding: 10,
    borderRadius: 50,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerHighlighted: {
    width: 44,
    height: 44,
    backgroundColor: '#206E56',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  calloutContainer: {
    width: 150,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
  },
  calloutType: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  calloutCity: {
    fontSize: 11,
    color: '#F33F32',
    fontWeight: '600',
    marginBottom: 4,
  },
  calloutDistance: {
    fontSize: 11,
    color: '#206E56',
    fontWeight: '600',
    marginBottom: 4,
  },
  calloutRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calloutRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  storeDetailsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  storeDetails: {
    padding: 20,
  },
  storeHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  storeImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  storeType: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  storeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  storeRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  storeDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  storeContact: {
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#1e293b',
  },
  storeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F33F32',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  callButton: {
    backgroundColor: '#00A85A',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 20,
    maxWidth: 350,
    width: '90%',
    maxHeight: '75%',
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScrollView: {
    paddingHorizontal: 20,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
    textAlign: 'center',
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedDropdownItem: {
    backgroundColor: '#F33F32',
  },
  countryHeader: {
    backgroundColor: '#EEF2F1',
    borderWidth: 1,
    borderColor: '#CBEED2',
    marginTop: 12,
    marginBottom: 6,
  },
  countryHeaderText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#206E56',
  },
  cityHeader: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    marginBottom: 6,
  },
  cityHeaderNested: {
    marginLeft: 12,
  },
  cityHeaderText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  storeItem: {
    marginLeft: 16,
    backgroundColor: '#fafbfc',
    borderLeftWidth: 3,
    borderLeftColor: '#e2e8f0',
  },
  storeItemNested: {
    marginLeft: 24,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  storeItemText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  selectedDropdownItemText: {
    color: 'white',
  },
  storeCount: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  storeTypeText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontStyle: 'italic',
  },
  storeDistanceText: {
    fontSize: 11,
    color: '#206E56',
    fontWeight: '600',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F33F32',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});