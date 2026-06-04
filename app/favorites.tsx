import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star, Heart, MapPin } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useFavorites, type FavoriteStore } from '@/hooks/useFavorite';
import { categoryRouteForType } from '@/lib/storeCategoryRoute';
import LoginRequiredScreen from '@/components/LoginRequiredScreen';

export default function FavoritesScreen() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { favorites, isLoading, refresh } = useFavorites(user?.id);

  // Refetch whenever the screen regains focus (e.g. after un-favoriting on a detail page).
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refresh();
      }
    }, [isAuthenticated, refresh])
  );

  if (!authLoading && !isAuthenticated) {
    return <LoginRequiredScreen featureName="Favorites" />;
  }

  const renderItem = (store: FavoriteStore) => (
    <TouchableOpacity
      key={store.id}
      style={styles.listItem}
      activeOpacity={0.7}
      onPress={() =>
        router.push(`/partner-store/${categoryRouteForType(store.type)}/${store.id}` as never)
      }
    >
      <Image source={{ uri: store.image }} style={styles.listImage} />
      <View style={styles.listInfo}>
        <Text style={styles.listName} numberOfLines={1}>{store.name}</Text>
        <View style={styles.listMetaRow}>
          <View style={styles.rating}>
            <Star size={14} color="#FACC15" fill="#FACC15" />
            <Text style={styles.ratingText}>{store.rating.toFixed(1)}</Text>
          </View>
          {store.type ? <Text style={styles.metaText}>{store.type}</Text> : null}
          {store.priceRange ? <Text style={styles.priceRange}>{store.priceRange}</Text> : null}
        </View>
        <View style={styles.locationRow}>
          <MapPin size={12} color="#94A3B8" />
          <Text style={styles.metaText} numberOfLines={1}>{store.city}</Text>
        </View>
      </View>
      <Heart size={20} color="#F43F5E" fill="#F43F5E" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading && favorites.length === 0 ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#206E56" />
          <Text style={styles.stateText}>Loading your favorites...</Text>
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.stateContainer}>
          <Heart size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.stateText}>
            Tap the heart on any partner store to save it here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#206E56" />
          }
        >
          <View style={styles.list}>
            {favorites.map((store, index) => (
              <React.Fragment key={store.id}>
                {renderItem(store)}
                {index < favorites.length - 1 && <View style={styles.listDivider} />}
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  list: {
    paddingVertical: 12,
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  metaText: {
    fontSize: 12,
    color: '#64748b',
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
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
  },
  stateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
