import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, X, RefreshCw, Activity as ActivityIndicator } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { fetchPartnerStores, groupStoresByCity } from '@/data/partnerStore';
import type { PartnerStore } from '@/types';
import UnverifiedMember from '@/components/unverified-member/UnverifiedMember';
import VerifiedMember from '@/components/verified-member/VerifiedMember';
import AdminTaskScreen from '@/components/admin-member/AdminTaskScreen'

export default function TasksScreen() {
  const { userData, isLoading: userLoading, refreshUserData, resendEmailConfirmation } = useUser();
  const [partnerStores, setPartnerStores] = useState<PartnerStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [, setStoresError] = useState<string | null>(null);
  
  // Store selection states
  const [selectedStore, setSelectedStore] = useState<PartnerStore | null>(null);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [expandedCities, setExpandedCities] = useState<{[key: string]: boolean}>({});

  // Group stores by city
  const groupedStores = groupStoresByCity(partnerStores);

  // Filter stores based on search query
  const getFilteredStores = () => {
    if (!storeSearchQuery.trim()) {
      return groupedStores;
    }
    
    const filtered: {[key: string]: PartnerStore[]} = {};
    Object.entries(groupedStores).forEach(([city, stores]) => {
      const filteredStores = stores.filter(store =>
        store.name.toLowerCase().includes(storeSearchQuery.toLowerCase())
      );
      if (filteredStores.length > 0) {
        filtered[city] = filteredStores;
      }
    });
    return filtered;
  };

  const filteredGroupedStores = getFilteredStores();

  const toggleCityExpansion = (city: string) => {
    setExpandedCities(prev => ({
      ...prev,
      [city]: !prev[city]
    }));
  };

  useEffect(() => {
    loadPartnerStores();
  }, []);

  const loadPartnerStores = async () => {
    try {
      setStoresLoading(true);
      setStoresError(null);
      const stores = await fetchPartnerStores();
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
      setStoresError('Failed to load partner stores');
    } finally {
      setStoresLoading(false);
    }
  };

  // Show loading state
  if (userLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#206E56" />
          <Text style={[styles.loadingText, { color: '#64748B' }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if no user data
  if (!userData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: '#EF4444' }]}>Unable to load user data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshUserData}>
            <RefreshCw size={16} color="#206E56" />
            <Text style={[styles.retryButtonText, { color: '#206E56' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render appropriate component based on user role
  const renderContent = () => {
    if (userData.role === 'admin') {
      return <AdminTaskScreen userData={userData} />;
    }
    
    if (userData.role === 'subscriber') {
      return (
        <UnverifiedMember
          userData={userData}
          refreshUserData={refreshUserData}
          resendEmailConfirmation={resendEmailConfirmation}
        />
      );
    }

    return (
      <VerifiedMember
        userData={userData}
        selectedStore={selectedStore}
        setSelectedStore={setSelectedStore}
        setShowStoreDropdown={setShowStoreDropdown}
        partnerStores={partnerStores}
      />
    );
  };

  return (
    <>
      {renderContent()}

      {/* Store Selection Modal */}
      {showStoreDropdown && (
        <View style={styles.modalOverlay}>
          <View style={[styles.storeModal, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: '#000000' }]}>Select Partner Store</Text>
            <ScrollView style={styles.storeList} showsVerticalScrollIndicator={false}>
              
              {/* Search Bar */}
              <View style={[styles.searchContainer, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
                <Search size={20} color="#64748B" />
                <TextInput
                  style={[styles.searchInput, { color: '#000000' }]}
                  placeholder="Search partner stores..."
                  placeholderTextColor="#64748B"
                  value={storeSearchQuery}
                  onChangeText={setStoreSearchQuery}
                />
                {storeSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setStoreSearchQuery('')}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Store List */}
              {Object.entries(filteredGroupedStores).map(([city, stores]) => (
                <React.Fragment key={city}>
                  {/* City Header - Collapsible */}
                  <TouchableOpacity 
                    style={[styles.cityHeader, { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}
                    onPress={() => toggleCityExpansion(city)}
                  >
                    <View style={styles.cityHeaderContent}>
                      <Text style={[styles.cityHeaderText, { color: '#206E56' }]}>{city}</Text>
                      <Text style={[styles.cityStoreCount, { color: '#64748B' }]}>({stores.length} stores)</Text>
                    </View>
                    <ChevronRight 
                      size={20} 
                      color="#64748B" 
                      style={[
                        styles.cityChevron,
                        expandedCities[city] && styles.cityChevronExpanded
                      ]}
                    />
                  </TouchableOpacity>

                  {/* Store Items - Show when expanded */}
                  {expandedCities[city] && stores.map((store) => (
                    <TouchableOpacity
                      key={store.id}
                      style={[
                        styles.storeItem,
                        selectedStore?.id === store.id && { backgroundColor: '#206E56' }
                      ]}
                      onPress={() => {
                        setSelectedStore(store);
                        setShowStoreDropdown(false);
                        setStoreSearchQuery('');
                      }}
                    >
                      <View style={styles.storeItemContent}>
                        <Text style={[
                          styles.storeItemText,
                          { color: selectedStore?.id === store.id ? 'white' : '#000000' }
                        ]}>
                          {store.name}
                        </Text>
                        <Text style={[
                          styles.storeTypeText,
                          { color: selectedStore?.id === store.id ? 'rgba(255, 255, 255, 0.8)' : '#64748B' }
                        ]}>
                          {store.type === "Coffee & Desserts" ? "Cafe" : store.type}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </React.Fragment>
              ))}

              {/* No Results Message */}
              {Object.keys(filteredGroupedStores).length === 0 && storeSearchQuery.length > 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={[styles.noResultsText, { color: '#64748B' }]}>No stores found matching &quot;{storeSearchQuery}&quot;</Text>
                  <TouchableOpacity 
                    style={[styles.clearSearchButton, { backgroundColor: '#206E56' }]}
                    onPress={() => setStoreSearchQuery('')}
                  >
                    <Text style={styles.clearSearchButtonText}>Clear Search</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: '#FFFFFF' }]}
              onPress={() => {
                setShowStoreDropdown(false);
                setStoreSearchQuery('');
              }}
            >
              <Text style={[styles.modalCloseButtonText, { color: '#64748B' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading overlay for stores */}
      {storesLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={[styles.loadingText, { color: '#64748B' }]}>Loading partner stores...</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  retryButtonText: {
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  storeModal: {
    borderRadius: 16,
    margin: 20,
    maxWidth: 350,
    width: '90%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 20,
    paddingBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 1,
  },
  storeList: {
    maxHeight: 300,
  },
  cityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  storeItemText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  storeTypeText: {
    fontSize: 12,
  },
  modalCloseButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  cityHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cityHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  cityStoreCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  cityChevron: {
    transform: [{ rotate: '0deg' }],
  },
  cityChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  storeItemContent: {
    flex: 1,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noResultsText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  clearSearchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearSearchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
});