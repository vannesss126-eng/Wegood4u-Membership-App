import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Star from '@/components/icons/Star';

interface StarWalletPillProps {
  balance: number;
}

export default function StarWalletPill({ balance }: StarWalletPillProps) {
  return (
    <View style={styles.pill}>
      <Star size={14} color="#E5A93D" />
      <Text style={styles.balance}>{balance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#16513F',
    shadowColor: '#206E56',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 4,
  },
  balance: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
