import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { RefreshCw, Lock, Wine, Coffee, UtensilsCrossed } from 'lucide-react-native';

import {
  BADGE_CATEGORIES,
  BADGE_CATEGORY_INFO,
  BADGE_TIER_COLORS,
  getAllBadgesForCategory,
  getCurrentBadge,
  MAX_BADGE_REQUIREMENT,
  type BadgeCategoryType,
  type BadgeTier,
  type BadgeRank,
} from '@/config/badges';
import type { TransformedSubmission, ApprovedCounts } from '@/types';

interface BadgesProps {
  userData: any;
  submissions: TransformedSubmission[];
  approvedCounts: ApprovedCounts;
  isLoadingSubmissions: boolean;
  fetchSubmissions: (showRefreshIndicator?: boolean) => Promise<void>;
}

// Map category to approved count key
const getCategoryCount = (category: BadgeCategoryType, approvedCounts: ApprovedCounts): number => {
  switch (category) {
    case 'Bar':
      return approvedCounts.bar;
    case 'Cafe':
      return approvedCounts.cafe;
    case 'Restaurant':
      return approvedCounts.restaurant;
    default:
      return 0;
  }
};

// Category icons
const getCategoryIcon = (category: BadgeCategoryType, isActive: boolean) => {
  const color = isActive ? '#206E56' : '#64748B';
  const size = 18;
  switch (category) {
    case 'Bar':
      return <Wine size={size} color={color} />;
    case 'Cafe':
      return <Coffee size={size} color={color} />;
    case 'Restaurant':
      return <UtensilsCrossed size={size} color={color} />;
  }
};

export default function Badges({ 
  userData, 
  submissions, 
  approvedCounts, 
  isLoadingSubmissions, 
  fetchSubmissions 
}: BadgesProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<BadgeCategoryType>('Bar');
  const [activeTier, setActiveTier] = useState<BadgeTier>('Bronze');

  // Handle refresh button press
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchSubmissions(true);
      Alert.alert('Success', 'Badges updated successfully!');
    } catch (error: any) {
      console.error('Badge refresh error:', error);
      Alert.alert('Error', error?.message || 'Failed to refresh badges. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleImageLoadStart = (key: string) => {
    setLoadingImages(prev => ({ ...prev, [key]: true }));
  };

  const handleImageLoadEnd = (key: string) => {
    setLoadingImages(prev => ({ ...prev, [key]: false }));
  };

  const renderBadgeImage = (
    imageUrl: string, 
    unlocked: boolean, 
    current: boolean,
    tier: BadgeTier,
    rank: BadgeRank,
    category: BadgeCategoryType
  ) => {
    const imageKey = `${category}_${tier}_${rank}`;
    const isLoading = loadingImages[imageKey];
    const tierColor = BADGE_TIER_COLORS[tier];

    return (
      <View style={[
        styles.badgeImageContainer,
        current && styles.currentBadgeContainer,
        current && { borderColor: tierColor.primary }
      ]}>
        {isLoading && (
          <View style={styles.imageLoader}>
            <ActivityIndicator size="small" color="#206E56" />
          </View>
        )}
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.badgeImage,
            !unlocked && styles.lockedBadgeImage
          ]}
          resizeMode="contain"
          onLoadStart={() => handleImageLoadStart(imageKey)}
          onLoadEnd={() => handleImageLoadEnd(imageKey)}
        />
        {!unlocked && (
          <View style={styles.lockOverlay}>
            <Lock size={20} color="#64748B" />
          </View>
        )}
        {current && (
          <View style={[styles.currentIndicator, { backgroundColor: tierColor.primary }]}>
            <Text style={styles.currentIndicatorText}>Current</Text>
          </View>
        )}
      </View>
    );
  };

  const renderCategorySection = (category: BadgeCategoryType) => {
    const count = getCategoryCount(category, approvedCounts);
    const categoryInfo = BADGE_CATEGORY_INFO[category];
    const allBadges = getAllBadgesForCategory(category, count);
    const currentBadgeInfo = getCurrentBadge(count);
    
    // Get only the active tier's badges - KEY OPTIMIZATION!
    const activeTierBadges = allBadges.filter(b => b.tier === activeTier);
    const earnedInTier = activeTierBadges.filter(b => b.unlocked).length;
    
    const earnedCount = allBadges.filter(b => b.unlocked).length;
    const progressPercentage = Math.min((count / MAX_BADGE_REQUIREMENT) * 100, 100);

    // Get tier requirements range for display
    const tierRequirements: Record<BadgeTier, string> = {
      Bronze: '5 - 20',
      Silver: '30 - 50',
      Gold: '60 - 80',
      Platinum: '90 - 120',
    };

    return (
      <View key={category} style={styles.categorySection}>
        {/* Category Header */}
        <View style={[styles.categoryHeader, { backgroundColor: categoryInfo.bgColor }]}>
          <View style={styles.categoryTitleRow}>
            <Text style={[styles.categoryTitle, { color: categoryInfo.color }]}>
              {categoryInfo.displayName}
            </Text>
            <View style={[styles.countBadge, { backgroundColor: categoryInfo.color }]}>
              <Text style={styles.countBadgeText}>{count} visits</Text>
            </View>
          </View>
          <Text style={styles.categoryProgress}>
            {earnedCount} of {allBadges.length} badges earned
          </Text>
          
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progressPercentage}%`, backgroundColor: categoryInfo.color }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{count}/{MAX_BADGE_REQUIREMENT}</Text>
          </View>
        </View>

        {/* Tier Slider/Tabs */}
        <View style={styles.tierSliderContainer}>
          {(['Bronze', 'Silver', 'Gold', 'Platinum'] as BadgeTier[]).map((tier) => {
            const isActive = activeTier === tier;
            const tierColor = BADGE_TIER_COLORS[tier];
            const tierBadges = allBadges.filter(b => b.tier === tier);
            const earnedInThisTier = tierBadges.filter(b => b.unlocked).length;
            
            return (
              <TouchableOpacity
                key={tier}
                style={[
                  styles.tierSliderTab,
                  isActive && styles.tierSliderTabActive,
                  isActive && { backgroundColor: tierColor.bg, borderColor: tierColor.primary }
                ]}
                onPress={() => handleTierChange(tier)}
              >
                <View style={[styles.tierSliderDot, { backgroundColor: tierColor.primary }]} />
                <Text style={[
                  styles.tierSliderText,
                  isActive && { color: tierColor.text, fontWeight: 'bold' }
                ]}>
                  {tier}
                </Text>
                <Text style={[
                  styles.tierSliderCount,
                  isActive && { color: tierColor.primary }
                ]}>
                  {earnedInThisTier}/3
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active Tier Info */}
        <View style={styles.tierInfoSection}>
          <Text style={styles.tierInfoText}>
            {activeTier} tier requires {tierRequirements[activeTier]} visits
          </Text>
        </View>

        {/* Only render the active tier's badges - 3 images only! */}
        <View style={styles.badgesSection}>
          <View style={styles.badgesRow}>
            {activeTierBadges.map((badge) => (
              <TouchableOpacity
                key={`${badge.tier}_${badge.rank}`}
                style={styles.badgeItem}
                onPress={() => {
                  if (badge.unlocked) {
                    Alert.alert(
                      `${badge.tier} Badge ${badge.rank}`,
                      `Congratulations! You earned this badge at ${badge.requirement} visits.`
                    );
                  } else {
                    Alert.alert(
                      `${badge.tier} Badge ${badge.rank}`,
                      `Reach ${badge.requirement} approved visits to unlock this badge.`
                    );
                  }
                }}
              >
                {renderBadgeImage(
                  badge.imageUrl,
                  badge.unlocked,
                  badge.current,
                  badge.tier,
                  badge.rank,
                  category
                )}
                <Text style={[
                  styles.badgeRequirement,
                  badge.unlocked && styles.badgeRequirementUnlocked
                ]}>
                  {badge.requirement} visits
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Current Badge Display */}
        {currentBadgeInfo && count >= 5 && (
          <View style={styles.currentBadgeSection}>
            <Text style={styles.currentBadgeLabel}>🏆 Your Current Badge</Text>
            <View style={styles.currentBadgeDisplay}>
              <View style={styles.currentBadgeInfo}>
                <Text style={styles.currentBadgeTier}>
                  {currentBadgeInfo.tier} {currentBadgeInfo.rank}
                </Text>
                {currentBadgeInfo.nextRequirement && (
                  <Text style={styles.nextBadgeText}>
                    Next: {currentBadgeInfo.nextTier} {currentBadgeInfo.nextRank} ({currentBadgeInfo.nextRequirement} visits)
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Clear image loading state when switching categories
  const handleCategoryChange = useCallback((category: BadgeCategoryType) => {
    setLoadingImages({}); // Reset loading states
    setActiveCategory(category);
    setActiveTier('Bronze'); // Reset to Bronze when switching category
  }, []);

  // Handle tier change
  const handleTierChange = useCallback((tier: BadgeTier) => {
    setLoadingImages({}); // Reset loading states
    setActiveTier(tier);
  }, []);

  if (isLoadingSubmissions && approvedCounts.total === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#206E56" />
        <Text style={styles.loadingText}>Loading your badges...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Refresh Button */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Your Badges</Text>
        <TouchableOpacity 
          style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]} 
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw 
            size={16} 
            color={isRefreshing ? "#94A3B8" : "#206E56"} 
          />
          <Text style={[styles.refreshText, isRefreshing && styles.refreshTextDisabled]}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryTabsContainer}>
        {BADGE_CATEGORIES.map((category) => {
          const isActive = activeCategory === category;
          const count = getCategoryCount(category, approvedCounts);
          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryTab, isActive && styles.categoryTabActive]}
              onPress={() => handleCategoryChange(category)}
            >
              {getCategoryIcon(category, isActive)}
              <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                {category}
              </Text>
              <View style={[styles.categoryTabBadge, isActive && styles.categoryTabBadgeActive]}>
                <Text style={[styles.categoryTabBadgeText, isActive && styles.categoryTabBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Only render the active category - This is the key optimization! */}
        {renderCategorySection(activeCategory)}

        {/* Empty State */}
        {approvedCounts.total === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Start Your Journey!</Text>
            <Text style={styles.emptyDescription}>
              Submit your first proof of travel to begin earning badges. 
              Collect all 12 badges in each category to become a master explorer!
            </Text>
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Badge Progression</Text>
          <View style={styles.tipsList}>
            <Text style={styles.tipItem}>• Bronze: 5 → 10 → 20 visits</Text>
            <Text style={styles.tipItem}>• Silver: 30 → 40 → 50 visits</Text>
            <Text style={styles.tipItem}>• Gold: 60 → 70 → 80 visits</Text>
            <Text style={styles.tipItem}>• Platinum: 90 → 100 → 120 visits</Text>
          </View>
        </View>
      </ScrollView>
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
    marginBottom: 12,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CBEED2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#206E56',
  },
  refreshButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  refreshText: {
    fontSize: 14,
    color: '#206E56',
    fontWeight: '600',
  },
  refreshTextDisabled: {
    color: '#94A3B8',
  },
  categoryTabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  categoryTabActive: {
    backgroundColor: '#CBEED2',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTabTextActive: {
    color: '#206E56',
  },
  categoryTabBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  categoryTabBadgeActive: {
    backgroundColor: '#206E56',
  },
  categoryTabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
  },
  categoryTabBadgeTextActive: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Note: summaryCard styles removed - replaced with category tabs for better performance
  categorySection: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryHeader: {
    padding: 16,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryProgress: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    width: 60,
    textAlign: 'right',
  },
  tierSliderContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tierSliderTab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  tierSliderTabActive: {
    borderWidth: 2,
  },
  tierSliderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierSliderText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  tierSliderCount: {
    fontSize: 10,
    color: '#94A3B8',
  },
  tierInfoSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  tierInfoText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  badgesSection: {
    padding: 16,
  },
  currentBadgeSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  currentBadgeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  currentBadgeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  currentBadgeInfo: {
    flex: 1,
  },
  currentBadgeTier: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  nextBadgeText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  badgeItem: {
    alignItems: 'center',
  },
  badgeImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  currentBadgeContainer: {
    borderWidth: 3,
  },
  badgeImage: {
    width: 70,
    height: 70,
  },
  lockedBadgeImage: {
    opacity: 0.3,
  },
  imageLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  lockOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
  },
  currentIndicatorText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  badgeRequirement: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  badgeRequirementUnlocked: {
    color: '#22C55E',
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  tipsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  tipsList: {
    gap: 6,
  },
  tipItem: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
});
