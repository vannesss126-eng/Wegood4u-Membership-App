import React, { useEffect, useState } from 'react';
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
import * as Location from 'expo-location';
import MapView, { Marker, Callout } from 'react-native-maps';
import { MapPin, Star, Phone, Clock, Navigation, ChevronDown } from 'lucide-react-native';
import { fetchPartnerStores, groupStoresByCity } from '@/data/partnerStore';
import type { PartnerStore } from '@/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FallbackMap } from '@/components/FallbackMap';

export default function MapScreen() {
  const [, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [partnerStores, setPartnerStores] = useState<PartnerStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<PartnerStore | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedCities, setExpandedCities] = useState<{[key: string]: boolean}>({});

  // Group stores by city
  const groupedStores = groupStoresByCity(partnerStores);
  const cities = Object.keys(groupedStores).sort();

  const getFilteredStores = () => {
    if (!partnerStores || partnerStores.length === 0) {
      return [];
    }
    
    if (selectedFilter === 'All') {
      return partnerStores;
    }
    
    // Check if it's a city filter
    if (cities.includes(selectedFilter)) {
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
    if (cities.includes(selectedFilter)) {
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
    getUserLocation();
    loadPartnerStores();
  }, []);

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
      
      // Initialize expanded cities state
      const cities = [...new Set(stores.map(store => store.city))];
      const initialExpandedState = cities.reduce((acc, city) => {
        acc[city] = false;
        return acc;
      }, {} as {[key: string]: boolean});
      setExpandedCities(initialExpandedState);
    } catch (err) {
      console.error('Error loading partner stores:', err);
      setError('Failed to load partner stores. Please check your internet connection and try again.');
      
      // Set empty stores array to prevent crashes
      setPartnerStores([]);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied, using fallback coordinates');
        // Don't show alert to avoid blocking the UI
        setUserLocation({
          latitude: 18.79210626514222, 
          longitude: 98.99534619999957,
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      // Fallback to Thailand coordinates
      setUserLocation({
        latitude: 18.79210626514222, 
        longitude: 98.99534619999957,
      });
    }
  };

  const toggleCityExpansion = (city: string) => {
    setExpandedCities(prev => ({
      ...prev,
      [city]: !prev[city]
    }));
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
                  } catch (dialerError) {
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
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading partner stores...</Text>
          </View>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  // Show error state
  if (error) {
    return (
      <ErrorBoundary>
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPartnerStores}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
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
        {filteredStores.filter(store => store.latitude !== 0 && store.longitude !== 0).length > 0 ? (
          <MapView
            style={styles.map}
            region={getMapRegion()}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {filteredStores
              .filter(store => store.latitude !== 0 && store.longitude !== 0)
              .map((store) => (
              <Marker
                key={store.id}
                coordinate={{
                  latitude: store.latitude,
                  longitude: store.longitude,
                }}
                onPress={() => setSelectedStore(store)}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.marker}>
                    <MapPin size={20} color="#F33F32" />
                  </View>
                </View>
                <Callout>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{store.name}</Text>
                    <Text style={styles.calloutType}>{store.type}</Text>
                    <Text style={styles.calloutCity}>{store.city}</Text>
                    <View style={styles.calloutRating}>
                      <Star size={12} color="#FFD700" />
                      <Text style={styles.calloutRatingText}>{store.rating}</Text>
                    </View>
                  </View>
                </Callout>
              </Marker>
            ))}
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

            {/* Chiang Mai Section */}
            {/* Dynamic City Sections */}
            {cities.map((city) => {
              const cityStores = groupedStores[city] || [];
              return (
                <React.Fragment key={city}>
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      styles.cityHeader,
                      selectedFilter === city && styles.selectedDropdownItem
                    ]}
                    onPress={() => {
                      if (expandedCities[city]) {
                        // If expanded, collapse it
                        toggleCityExpansion(city);
                      } else {
                        // If collapsed, expand it and optionally select the city
                        toggleCityExpansion(city);
                        setSelectedFilter(city);
                        setSelectedStore(null);
                      }
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      styles.cityHeaderText,
                      selectedFilter === city && styles.selectedDropdownItemText
                    ]}>
                      {city}
                    </Text>
                    <Text style={[
                      styles.storeCount,
                      selectedFilter === city && { color: 'rgba(255,255,255,0.8)' }
                    ]}>
                      {cityStores.length} stores
                    </Text>
                  </TouchableOpacity>

                  {/* City Stores */}
                  {expandedCities[city] && cityStores.map((store) => (
                    <TouchableOpacity
                      key={store.id}
                      style={[
                        styles.dropdownItem,
                        styles.storeItem,
                        selectedFilter === store.name && styles.selectedDropdownItem
                      ]}
                      onPress={() => {
                        setSelectedFilter(store.name);
                        setShowDropdown(false);
                        setSelectedStore(store);
                      }}
                    >
                      <Text style={[
                        styles.storeItemText,
                        selectedFilter === store.name && styles.selectedDropdownItemText
                      ]}>
                        • {store.name}
                      </Text>
                      <Text style={[
                        styles.storeTypeText,
                        selectedFilter === store.name && { color: 'rgba(255,255,255,0.8)' }
                      ]}>
                        {store.type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </React.Fragment>
              );
            })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      </SafeAreaView>
    </ErrorBoundary>
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
  cityHeader: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
    marginBottom: 8,
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