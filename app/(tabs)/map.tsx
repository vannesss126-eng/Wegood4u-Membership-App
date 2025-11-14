import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Star, Phone, Clock } from 'lucide-react-native';

interface PartnerStore {
  id: number;
  name: string;
  type: string;
  rating: number;
  image: string;
  phone: string;
  hours: string;
  description: string;
}

export default function MapScreen() {
  const partnerStores: PartnerStore[] = [
    {
      id: 1,
      name: 'Cafe Luna',
      type: 'Coffee & Desserts',
      rating: 4.8,
      image: 'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=400',
      phone: '+1 (555) 123-4567',
      hours: '7:00 AM - 9:00 PM',
      description: 'Premium coffee and artisanal desserts in a cozy atmosphere',
    },
    {
      id: 2,
      name: 'Pizza Corner',
      type: 'Italian Cuisine',
      rating: 4.6,
      image: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
      phone: '+1 (555) 234-5678',
      hours: '11:00 AM - 11:00 PM',
      description: 'Authentic Italian pizza made with fresh ingredients',
    },
    {
      id: 3,
      name: 'Sushi Zen',
      type: 'Japanese Food',
      rating: 4.9,
      image: 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=400',
      phone: '+1 (555) 345-6789',
      hours: '12:00 PM - 10:00 PM',
      description: 'Fresh sushi and traditional Japanese dishes',
    },
    {
      id: 4,
      name: 'Burger Palace',
      type: 'Fast Food',
      rating: 4.4,
      image: 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg?auto=compress&cs=tinysrgb&w=400',
      phone: '+1 (555) 456-7890',
      hours: '10:00 AM - 12:00 AM',
      description: 'Gourmet burgers and crispy fries',
    },
    {
      id: 5,
      name: 'Green Garden',
      type: 'Healthy Food',
      rating: 4.7,
      image: 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=400',
      phone: '+1 (555) 567-8901',
      hours: '8:00 AM - 8:00 PM',
      description: 'Fresh salads, smoothies, and healthy options',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Partner Stores</Text>
        <Text style={styles.subtitle}>{partnerStores.length} locations nearby</Text>
      </View>

      <View style={styles.mapContainer}>
        <View style={styles.webMapPlaceholder}>
          <MapPin size={48} color="#F33F32" />
          <Text style={styles.webMapText}>Map View</Text>
          <Text style={styles.webMapSubtext}>
            Interactive map is available on mobile devices
          </Text>
        </View>
      </View>

      <ScrollView style={styles.storesList} showsVerticalScrollIndicator={false}>
        <Text style={styles.storesListTitle}>All Partner Stores</Text>
        {partnerStores.map((store) => (
          <View key={store.id} style={styles.storeCard}>
            <Image source={{ uri: store.image }} style={styles.storeImage} />
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{store.name}</Text>
              <Text style={styles.storeType}>{store.type}</Text>
              <View style={styles.storeRating}>
                <Star size={16} color="#FFD700" />
                <Text style={styles.storeRatingText}>{store.rating}</Text>
              </View>
              <Text style={styles.storeDescription}>{store.description}</Text>
              
              <View style={styles.storeContact}>
                <View style={styles.contactItem}>
                  <Phone size={14} color="#64748B" />
                  <Text style={styles.contactText}>{store.phone}</Text>
                </View>
                <View style={styles.contactItem}>
                  <Clock size={14} color="#64748B" />
                  <Text style={styles.contactText}>{store.hours}</Text>
                </View>
              </View>
            </View>
          </View>
        ))}
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
  mapContainer: {
    height: 200,
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  webMapText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  storesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  storesListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  storeCard: {
    flexDirection: 'row',
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
    width: 100,
    height: 120,
  },
  storeInfo: {
    flex: 1,
    padding: 16,
  },
  storeName: {
    fontSize: 16,
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
    marginBottom: 12,
    lineHeight: 16,
  },
  storeContact: {
    gap: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 12,
    color: '#64748b',
  },
});