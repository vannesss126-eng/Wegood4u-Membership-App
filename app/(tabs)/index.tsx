import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Star,
  MapPin,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { fetchPartnerStores } from '@/data/partnerStore';
import { router } from 'expo-router';
import type { PartnerStore } from '@/types';

export default function HomeScreen() {
  const { userData } = useUser();
  const [recommendedRestaurants, setRecommendedRestaurants] = useState<PartnerStore[]>([]);
  const [recommendedCafes, setRecommendedCafes] = useState<PartnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load partner stores and filter recommendations
  useEffect(() => {
    loadPartnerStores();
  }, []);

  const loadPartnerStores = async () => {
    try {
      setIsLoading(true);
      const stores = await fetchPartnerStores();

      // Filter and sort restaurants by rating (top 6)
      const restaurants = stores
        .filter(store => store.type.toLowerCase().includes('restaurant') || 
          store.type.toLowerCase().includes('italian') ||
          store.type.toLowerCase().includes('japanese') ||
          store.type.toLowerCase().includes('fast food') ||
          store.type.toLowerCase().includes('healthy food'))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6);

      // Filter and sort cafes by rating (top 6)
      const cafes = stores
        .filter(store => store.type.toLowerCase().includes('coffee') || 
          store.type.toLowerCase().includes('dessert') ||
          store.type.toLowerCase().includes('cafe'))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6);

      setRecommendedRestaurants(restaurants);
      setRecommendedCafes(cafes);
    } catch (error) {
      console.error('Error loading partner stores:', error);
      Alert.alert('Error', 'Failed to load partner stores');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStoreCard = (store: PartnerStore, index: number) => (
    <TouchableOpacity key={store.id} style={styles.storeCard}>
      <Image source={{ uri: store.image }} style={styles.storeImage} />
      <View style={styles.storeInfo}>
        <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
        <Text style={styles.storeType} numberOfLines={1}>{store.type}</Text>
        <View style={styles.storeRating}>
          <Star size={12} color="#FFD700" fill="#FFD700" />
          <Text style={styles.rating}>{store.rating}</Text>
        </View>
        <View style={styles.storeLocation}>
          <MapPin size={10} color="#64748B" />
          <Text style={styles.locationText} numberOfLines={1}>{store.city}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRecommendationSection = (title: string, stores: PartnerStore[]) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <TouchableOpacity 
          style={styles.circularButton}
          onPress={() => {
            if (title === 'Recommended Restaurant') {
              router.push('../partner-store/Restaurant');
            } else if (title === 'Recommended Cafe') {
              router.push('../partner-store/Cafe');
            }
          }}
        >
          <ChevronRightIcon size={16} color="#206E56" />
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading recommendations...</Text>
        </View>
      ) : stores.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeList}>
          {stores.map((store, index) => renderStoreCard(store, index))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No {title.toLowerCase()} available</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#206E56', '#CBEED2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>Welcome back!</Text>
            <Text style={styles.username}>{userData?.fullName || userData?.username || 'User'}</Text>
          </View>
        </LinearGradient>

        {/* Advertisement Banner */}
        <View style={styles.section}>
          <View style={styles.advertisementBanner}>
            <Text style={styles.advertisementText}>Advertisement</Text>
          </View>
        </View>

        {/* Recommended Restaurants */}
        {renderRecommendationSection(
          'Recommended Restaurant', 
          recommendedRestaurants
        )}

        {/* Recommended Cafes */}
        {renderRecommendationSection(
          'Recommended Cafe', 
          recommendedCafes
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingVertical: 30,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  circularButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CBEED2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#206E56',
  },
  advertisementBanner: {
    backgroundColor: '#dce0e7ff',
    borderRadius: 16,
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  advertisementText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  storeList: {
    paddingRight: 20,
  },
  storeCard: {
    width: 140,
    backgroundColor: 'white',
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  storeImage: {
    width: '100%',
    height: 90,
  },
  storeInfo: {
    padding: 12,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  storeType: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  storeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 4,
  },
  storeLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 2,
  },
  uploadedImageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  uploadBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  uploadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  activityList: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
});