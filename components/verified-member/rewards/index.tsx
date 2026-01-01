import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Hotel, UtensilsCrossed, Gift, Ticket, CheckCircle } from 'lucide-react-native';

interface Voucher {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  claimed: boolean;
}

export default function Rewards() {
  const [vouchers, setVouchers] = useState<Voucher[]>([
    {
      id: '1',
      title: 'FREE Accommodation',
      description: 'Enjoy a complimentary night stay at our partner hotels. Valid for standard rooms.',
      icon: <Hotel size={28} color="#3B82F6" />,
      color: '#3B82F6',
      bgColor: '#EFF6FF',
      claimed: false,
    },
    {
      id: '2',
      title: 'FREE Food',
      description: 'Get a free meal at any of our partner restaurants. Valid for meals up to $30.',
      icon: <UtensilsCrossed size={28} color="#F59E0B" />,
      color: '#F59E0B',
      bgColor: '#FFFBEB',
      claimed: false,
    },
    {
      id: '3',
      title: 'FREE Gift',
      description: 'Claim your exclusive gift package from our partners. Limited availability.',
      icon: <Gift size={28} color="#EC4899" />,
      color: '#EC4899',
      bgColor: '#FDF2F8',
      claimed: false,
    },
  ]);

  const handleClaimVoucher = (voucherId: string) => {
    const voucher = vouchers.find(v => v.id === voucherId);
    if (!voucher) return;

    if (voucher.claimed) {
      Alert.alert(
        'Already Claimed',
        'You have already claimed this voucher. Check your email for the voucher code.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Claim Voucher',
      `Are you sure you want to claim "${voucher.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: () => {
            setVouchers(prev =>
              prev.map(v =>
                v.id === voucherId ? { ...v, claimed: true } : v
              )
            );
            Alert.alert(
              'Voucher Claimed! 🎉',
              `Your "${voucher.title}" voucher has been claimed successfully! Check your email for the voucher code.`,
              [{ text: 'Great!' }]
            );
          },
        },
      ]
    );
  };

  const renderVoucherCard = (voucher: Voucher) => (
    <View key={voucher.id} style={styles.voucherCard}>
      <View style={styles.voucherHeader}>
        <View style={[styles.iconContainer, { backgroundColor: voucher.bgColor }]}>
          {voucher.icon}
        </View>
        <View style={styles.voucherInfo}>
          <Text style={styles.voucherTitle}>{voucher.title}</Text>
          {voucher.claimed && (
            <View style={styles.claimedBadge}>
              <CheckCircle size={12} color="#22C55E" />
              <Text style={styles.claimedText}>Claimed</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.voucherDescription}>{voucher.description}</Text>

      <View style={styles.voucherFooter}>
        <View style={styles.voucherMeta}>
          <Ticket size={14} color="#64748B" />
          <Text style={styles.voucherMetaText}>1 voucher available</Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.claimButton,
            voucher.claimed && styles.claimedButton,
            { borderColor: voucher.color }
          ]}
          onPress={() => handleClaimVoucher(voucher.id)}
        >
          <Text
            style={[
              styles.claimButtonText,
              { color: voucher.claimed ? '#94A3B8' : voucher.color }
            ]}
          >
            {voucher.claimed ? 'View Code' : 'Claim Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Your Rewards</Text>
        <View style={styles.rewardsBadge}>
          <Text style={styles.rewardsBadgeText}>{vouchers.length} Available</Text>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>🎁 Special Rewards</Text>
        <Text style={styles.infoText}>
          Claim your exclusive vouchers below! Each voucher can only be claimed once.
          Voucher codes will be sent to your registered email.
        </Text>
      </View>

      {/* Voucher List */}
      <View style={styles.voucherList}>
        {vouchers.map(renderVoucherCard)}
      </View>

      {/* Terms */}
      <View style={styles.termsCard}>
        <Text style={styles.termsTitle}>Terms & Conditions</Text>
        <Text style={styles.termsText}>• Vouchers are valid for 30 days after claiming</Text>
        <Text style={styles.termsText}>• Each voucher can only be used once</Text>
        <Text style={styles.termsText}>• Not combinable with other promotions</Text>
        <Text style={styles.termsText}>• Subject to availability at partner locations</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  rewardsBadge: {
    backgroundColor: '#CBEED2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#206E56',
  },
  rewardsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#206E56',
  },
  infoCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#166534',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#15803D',
    lineHeight: 20,
  },
  voucherList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  voucherCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  voucherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voucherInfo: {
    flex: 1,
  },
  voucherTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  claimedText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
  voucherDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  voucherFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voucherMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voucherMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  claimButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'white',
  },
  claimedButton: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  claimButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  termsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  termsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 8,
  },
  termsText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
});
