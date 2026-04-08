import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  ArrowLeft,
  Search,
  ArrowUpDown,
  MapPin,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { fetchPartnerStores } from '@/data/partnerStore';
import { haversineDistanceM, formatDistanceM } from '@/lib/distance';
import type { PartnerStore } from '@/types';

type SortOption = 'rating' | 'alphabetical-az' | 'alphabetical-za';
type LocationFilter = 'all' | 'malaysia' | 'thailand';

export default function BarScreen() {
  const [bars, setBars] = useState<PartnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadBars();
    loadUserLocation();
  }, []);

  const loadUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      console.warn('Error getting location for category:', error);
    }
  };

  const loadBars = async () => {
    try {
      setIsLoading(true);
      const stores = await fetchPartnerStores();

      const barStores = stores.filter(store =>
        store.type.toLowerCase().includes('beverage') ||
        store.type.toLowerCase().includes('bar')
      );

      setBars(barStores);
    } catch (error) {
      console.error('Error loading bars:', error);
      Alert.alert('Error', 'Failed to load bars');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedBars = useMemo(() => {
    let filtered = bars;

    if (searchQuery.trim()) {
      filtered = filtered.filter(bar =>
        bar.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (locationFilter !== 'all') {
      if (locationFilter === 'malaysia') {
        filtered = filtered.filter(bar =>
          bar.city.toLowerCase().includes('kuala lumpur') ||
          bar.city.toLowerCase().includes('malaysia')
        );
      } else if (locationFilter === 'thailand') {
        filtered = filtered.filter(bar =>
          bar.city.toLowerCase().includes('chiang mai') ||
          bar.city.toLowerCase().includes('thailand')
        );
      }
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'alphabetical-az':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'alphabetical-za':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }

    return sorted;
  }, [bars, searchQuery, sortBy, locationFilter]);

  const getSortDisplayText = () => {
    switch (sortBy) {
      case 'rating': return 'Recommended';
      case 'alphabetical-az': return 'A-Z';
      case 'alphabetical-za': return 'Z-A';
      default: return 'Sort By';
    }
  };

  const getLocationDisplayText = () => {
    switch (locationFilter) {
      case 'malaysia': return 'Malaysia';
      case 'thailand': return 'Thailand';
      default: return 'Any Location';
    }
  };

  const renderBarCard = (bar: PartnerStore) => (
    <TouchableOpacity
      key={bar.id}
      style={styles.barCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/partner-store/bar/${bar.id}`)}
    >
      <Image source={{ uri: bar.image }} style={styles.barImage} />
      <View style={styles.barInfo}>
        <Text style={styles.barName}>{bar.name}</Text>
        <View style={styles.barBottomContent}>
          <View style={styles.barMeta}>
            <Text style={styles.barType}>{bar.type}</Text>
            {userLocation ? (
              <Text style={styles.barDistance}>
                {formatDistanceM(haversineDistanceM(userLocation, { latitude: bar.latitude, longitude: bar.longitude }))}
              </Text>
            ) : (
              <ActivityIndicator size="small" color="#64748b" style={{ transform: [{ scale: 0.7 }] }} />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading bars...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bar & Beverages</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search bars..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowSortModal(true)}
        >
          <ArrowUpDown size={16} color="#64748B" />
          <Text style={styles.filterButtonText}>{getSortDisplayText()}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowLocationModal(true)}
        >
          <MapPin size={16} color="#64748B" />
          <Text style={styles.filterButtonText}>{getLocationDisplayText()}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.barGrid}>
          {filteredAndSortedBars.map(renderBarCard)}
        </View>

        {filteredAndSortedBars.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No bars found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your search or filters</Text>
          </View>
        )}

        {filteredAndSortedBars.length > 0 && (
          <View style={styles.endMessage}>
            <Text style={styles.endMessageText}>You&apos;ve reached the end!</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <ArrowLeft size={24} color="#1e293b" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Sort By</Text>
              <View style={styles.modalSpacer} />
            </View>

            <View style={styles.optionsList}>
              {[
                { key: 'rating', label: 'Recommended', icon: '👍' },
                { key: 'alphabetical-az', label: 'A-Z', icon: '🔤' },
                { key: 'alphabetical-za', label: 'Z-A', icon: '🔤' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.optionItem,
                    sortBy === option.key && styles.selectedOption
                  ]}
                  onPress={() => {
                    setSortBy(option.key as SortOption);
                    setShowSortModal(false);
                  }}
                >
                  <View style={styles.optionContent}>
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                    <Text style={[
                      styles.optionText,
                      sortBy === option.key && styles.selectedOptionText
                    ]}>
                      {option.label}
                    </Text>
                  </View>
                  {sortBy === option.key && (
                    <View style={styles.selectedIndicator} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => setSortBy('rating')}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowSortModal(false)}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <ArrowLeft size={24} color="#1e293b" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Location</Text>
              <View style={styles.modalSpacer} />
            </View>

            <View style={styles.optionsList}>
              {[
                { key: 'all', label: 'Any Location', icon: '🌍' },
                { key: 'malaysia', label: 'Malaysia', icon: '🇲🇾' },
                { key: 'thailand', label: 'Thailand', icon: '🇹🇭' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.optionItem,
                    locationFilter === option.key && styles.selectedOption
                  ]}
                  onPress={() => {
                    setLocationFilter(option.key as LocationFilter);
                    setShowLocationModal(false);
                  }}
                >
                  <View style={styles.optionContent}>
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                    <Text style={[
                      styles.optionText,
                      locationFilter === option.key && styles.selectedOptionText
                    ]}>
                      {option.label}
                    </Text>
                  </View>
                  {locationFilter === option.key && (
                    <View style={styles.selectedIndicator} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => setLocationFilter('all')}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowLocationModal(false)}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#64748B' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginLeft: 16 },
  headerSpacer: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#1e293b' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  filterButtonText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  content: { flex: 1, paddingHorizontal: 20 },
  barGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  barCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  barImage: { width: '100%', height: 120 },
  barInfo: { padding: 12, flex: 1, flexDirection: 'column', justifyContent: 'space-between' },
  barName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  barBottomContent: { marginTop: 'auto' },
  barMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barType: { fontSize: 12, color: '#64748b' },
  barDistance: { fontSize: 12, color: '#64748b' },
  barRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  priceRange: { fontSize: 14, color: '#64748b', marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyStateText: { fontSize: 18, fontWeight: 'bold', color: '#64748B', marginBottom: 8 },
  emptyStateSubtext: { fontSize: 14, color: '#94A3B8' },
  endMessage: { alignItems: 'center', paddingVertical: 20 },
  endMessageText: { fontSize: 14, color: '#94A3B8', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginLeft: 16 },
  modalSpacer: { flex: 1 },
  optionsList: { paddingVertical: 20 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  selectedOption: { backgroundColor: '#f0fdf4' },
  optionContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  optionIcon: { fontSize: 20, marginRight: 12 },
  optionText: { fontSize: 16, color: '#1e293b' },
  selectedOptionText: { color: '#206E56', fontWeight: '600' },
  selectedIndicator: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#206E56' },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#206E56',
    alignItems: 'center',
  },
  resetButtonText: { color: '#206E56', fontSize: 16, fontWeight: '600' },
  applyButton: { flex: 1, paddingVertical: 16, borderRadius: 25, backgroundColor: '#206E56', alignItems: 'center' },
  applyButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
