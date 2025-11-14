import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';

interface FallbackMapProps {
  message?: string;
}

export const FallbackMap: React.FC<FallbackMapProps> = ({ 
  message = "Map temporarily unavailable" 
}) => {
  return (
    <View style={styles.container}>
      <MapPin size={48} color="#F33F32" />
      <Text style={styles.title}>Map View</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.subtext}>
        Please check your internet connection and try again
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 12,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
