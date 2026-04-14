import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Star,
  MapPin,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react-native';
import banners, { Banner } from '@/data/banners';
import { useUser } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { fetchPartnerStores } from '@/data/partnerStore';
import { router } from 'expo-router';
import type { PartnerStore } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 40; // Account for padding
const AUTO_SCROLL_INTERVAL = 4000; // 4 seconds

const PromoBannerCarousel = ({ promoBanners }: { promoBanners: Banner[] }) => {
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!promoBanners.length) return;

    const interval = setInterval(() => {
      setActiveIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % promoBanners.length;
        scrollRef.current?.scrollTo({
          x: nextIndex * (BANNER_WIDTH + 16),
          animated: true,
        });
        return nextIndex;
      });
    }, AUTO_SCROLL_INTERVAL);

    return () => clearInterval(interval);
  }, [promoBanners.length]);

  return (
    <View style={styles.promoSection}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.promoList}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / (BANNER_WIDTH + 16)
          );
          setActiveIndex(index);
        }}
      >
        {promoBanners.map((banner) => (
          <View key={banner.object_name} style={styles.promoCard}>
            <Image
              source={{ uri: banner.public_url }}
              style={styles.promoImage}
              resizeMode="cover"
            />
          </View>
        ))}
      </ScrollView>
      <View style={styles.paginationContainer}>
        {promoBanners.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === activeIndex && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { userData } = useUser();
  const { isAuthenticated } = useAuth();
  const [recommendedRestaurants, setRecommendedRestaurants] = useState<PartnerStore[]>([]);
  const [recommendedCafes, setRecommendedCafes] = useState<PartnerStore[]>([]);
  const [recommendedBars, setRecommendedBars] = useState<PartnerStore[]>([]);
  const [recommendedExperiences, setRecommendedExperiences] = useState<PartnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load partner stores and filter recommendations
  useEffect(() => {
    loadPartnerStores();
  }, []);

  const restaurantPromoBanners = banners.filter((banner) => banner.category === 'restaurant');
  const cafePromoBanners = banners.filter((banner) => banner.category === 'cafe');
  const barPromoBanners = banners.filter((banner) => banner.category === 'bar');

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

      // Filter and sort bars by rating (top 6)
      const bars = stores
        .filter(store => store.type.toLowerCase().includes('beverage') || 
          store.type.toLowerCase().includes('bar'))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6);

      // Random experiences (top 10 shuffled)
      const shuffled = [...stores].sort(() => 0.5 - Math.random());
      const selectedExperiences = shuffled.slice(0, 10);

      setRecommendedRestaurants(restaurants);
      setRecommendedCafes(cafes);
      setRecommendedBars(bars);
      setRecommendedExperiences(selectedExperiences);
    } catch (error) {
      console.error('Error loading partner stores:', error);
      Alert.alert('Error', 'Failed to load partner stores');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStoreCard = (store: PartnerStore, section: string) => (
    <TouchableOpacity
      key={store.id}
      style={styles.storeCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/partner-store/${section}/${store.id}`)}
    >
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
              router.push('/partner-store/restaurant');
            } else if (title === 'Recommended Cafe') {
              router.push('/partner-store/cafe');
            } else if (title === 'Recommended Bar') {
              router.push('/partner-store/bar');
            } else if (title === 'Recommended Experience') {
              router.push('/partner-store/experience');
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
          {stores.map((store) => {
            let sec = 'restaurant';
            if (title === 'Recommended Cafe') sec = 'cafe';
            else if (title === 'Recommended Bar') sec = 'bar';
            else if (title === 'Recommended Experience') sec = 'experience';
            return renderStoreCard(store, sec);
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No {title.toLowerCase()} available</Text>
        </View>
      )}
    </View>
  );

  const isGuest = !isAuthenticated;

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
          <View style={styles.headerRow}>
            <View style={styles.headerContent}>
              <Text style={styles.greeting}>
                {isGuest ? 'Welcome to Wegood4u!' : 'Welcome back!'}
              </Text>
              <Text style={styles.username}>
                {isGuest
                  ? 'Start Exploring!'
                  : (userData?.fullName || userData?.username || 'User')}
              </Text>
            </View>
            {!isAuthenticated && (
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        <PromoBannerCarousel promoBanners={restaurantPromoBanners} />

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

        <PromoBannerCarousel promoBanners={cafePromoBanners} />

        {/* Recommended Bars */}
        {renderRecommendationSection(
          'Recommended Bar', 
          recommendedBars
        )}

        {/* Recommended Experiences */}
        {renderRecommendationSection(
          'Recommended Experience', 
          recommendedExperiences
        )}

        <PromoBannerCarousel promoBanners={barPromoBanners} />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'flex-start',
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
  signInButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  bannerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerImageContainer: {
    width: BANNER_WIDTH,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  promoSection: {
    marginBottom: 24,
  },
  promoList: {
    paddingHorizontal: 20,
  },
  promoCard: {
    width: BANNER_WIDTH,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    backgroundColor: '#f8fafc',
  },
  promoImage: {
    width: '100%',
    height: '100%',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
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