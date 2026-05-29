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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  ArrowUpDown,
  MapPin,
  Star,
  List,
  LayoutGrid,
} from 'lucide-react-native';
import { router } from 'expo-router';
import type { PartnerStore } from '@/types';

type SortOption = 'rating' | 'alphabetical-az' | 'alphabetical-za';
type LocationFilter = 'all' | 'malaysia' | 'thailand';
type ViewMode = 'grid' | 'list';

interface PartnerStoreCategoryScreenProps {
  title: string;
  categoryRoute: string;
  searchPlaceholder?: string;
  loadingText?: string;
  emptyText?: string;
  loadStores: () => Promise<PartnerStore[]>;
}

export default function PartnerStoreCategoryScreen({
  title,
  categoryRoute,
  searchPlaceholder,
  loadingText,
  emptyText,
  loadStores,
}: PartnerStoreCategoryScreenProps) {
  const lowerTitle = title.toLowerCase();
  const placeholder = searchPlaceholder ?? `Search ${lowerTitle}...`;
  const loadingLabel = loadingText ?? `Loading ${lowerTitle}...`;
  const emptyLabel = emptyText ?? `No ${lowerTitle} found`;

  const [stores, setStores] = useState<PartnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      setIsLoading(true);
      const result = await loadStores();
      setStores(result);
    } catch (error) {
      console.error(`Error loading ${lowerTitle}:`, error);
      Alert.alert('Error', `Failed to load ${lowerTitle}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedStores = useMemo(() => {
    let filtered = stores;

    if (searchQuery.trim()) {
      filtered = filtered.filter(store =>
        store.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (locationFilter === 'malaysia') {
      filtered = filtered.filter(store =>
        store.city.toLowerCase().includes('kuala lumpur') ||
        store.city.toLowerCase().includes('malaysia')
      );
    } else if (locationFilter === 'thailand') {
      filtered = filtered.filter(store =>
        store.city.toLowerCase().includes('chiang mai') ||
        store.city.toLowerCase().includes('thailand')
      );
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
  }, [stores, searchQuery, sortBy, locationFilter]);

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

  const renderGridCard = (store: PartnerStore) => (
    <TouchableOpacity
      key={store.id}
      style={styles.storeCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/partner-store/${categoryRoute}/${store.id}` as never)}
    >
      <Image source={{ uri: store.image }} style={styles.storeImage} />
      <View style={styles.storeInfo}>
        <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
        <View style={styles.storeMeta}>
          <Text style={styles.metaText}>{store.type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderListItem = (store: PartnerStore) => (
    <TouchableOpacity
      key={store.id}
      style={styles.listItem}
      activeOpacity={0.7}
      onPress={() => router.push(`/partner-store/${categoryRoute}/${store.id}` as never)}
    >
      <Image source={{ uri: store.image }} style={styles.listImage} />
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{store.name}</Text>
        <View style={styles.listMetaRow}>
          <View style={styles.rating}>
            <Star size={14} color="#FACC15" fill="#FACC15" />
            <Text style={styles.ratingText}>{store.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.metaText}>{store.type}</Text>
          {store.priceRange ? (
            <Text style={styles.priceRange}>{store.priceRange}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{loadingLabel}</Text>
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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
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
          <Text style={styles.filterButtonText} numberOfLines={1}>{getSortDisplayText()}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowLocationModal(true)}
        >
          <MapPin size={16} color="#64748B" />
          <Text style={styles.filterButtonText} numberOfLines={1}>{getLocationDisplayText()}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewToggleButton}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        >
          {viewMode === 'grid' ? (
            <List size={22} color="#64748B" />
          ) : (
            <LayoutGrid size={22} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'grid' ? (
          <View style={styles.grid}>
            {filteredAndSortedStores.map(renderGridCard)}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredAndSortedStores.map((store, index) => (
              <React.Fragment key={store.id}>
                {renderListItem(store)}
                {index < filteredAndSortedStores.length - 1 && (
                  <View style={styles.listDivider} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {filteredAndSortedStores.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{emptyLabel}</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your search or filters</Text>
          </View>
        )}

        {filteredAndSortedStores.length > 0 && (
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
                    sortBy === option.key && styles.selectedOption,
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
                      sortBy === option.key && styles.selectedOptionText,
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
                    locationFilter === option.key && styles.selectedOption,
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
                      locationFilter === option.key && styles.selectedOptionText,
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 16,
  },
  headerSpacer: {
    flex: 1,
  },
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
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    maxWidth: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    flexShrink: 1,
  },
  viewToggleButton: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  storeCard: {
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
  storeImage: {
    width: '100%',
    height: 120,
  },
  storeInfo: {
    padding: 12,
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  storeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  storeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  list: {
    paddingBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  listImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  listInfo: {
    flex: 1,
    gap: 6,
  },
  listName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  priceRange: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  listDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94A3B8',
  },
  endMessage: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  endMessageText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 16,
  },
  modalSpacer: {
    flex: 1,
  },
  optionsList: {
    paddingVertical: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  selectedOption: {
    backgroundColor: '#f0fdf4',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    color: '#1e293b',
  },
  selectedOptionText: {
    color: '#206E56',
    fontWeight: '600',
  },
  selectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#206E56',
  },
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
  resetButtonText: {
    color: '#206E56',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 25,
    backgroundColor: '#206E56',
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
