import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { RefreshCw, Lock, Wine, Coffee, UtensilsCrossed, Hotel } from 'lucide-react-native';

import {
  BADGE_CATEGORIES,
  BADGE_CATEGORY_INFO,
  BADGE_TIER_COLORS,
  BADGE_TIERS,
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
    case 'Hotel':
      return approvedCounts.hotel;
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
    case 'Hotel':
      return <Hotel size={size} color={color} />;
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

  // Clear image loading state when switching categories
  const handleCategoryChange = useCallback((category: BadgeCategoryType) => {
    setLoadingImages({}); // Reset loading states
    setActiveCategory(category);
  }, []);

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
            <Lock size={16} color="#94A3B8" />
          </View>
        )}
        {current && (
          <View style={[styles.currentIndicator, { backgroundColor: tierColor.primary }]}>
            <Text style={styles.currentIndicatorText}>✓</Text>
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
    
    // Group badges by tier
    const badgesByTier: Record<BadgeTier, typeof allBadges> = {
      Bronze: allBadges.filter(b => b.tier === 'Bronze'),
      Silver: allBadges.filter(b => b.tier === 'Silver'),
      Gold: allBadges.filter(b => b.tier === 'Gold'),
      Platinum: allBadges.filter(b => b.tier === 'Platinum'),
    };

    const earnedCount = allBadges.filter(b => b.unlocked).length;
    const progressPercentage = Math.min((count / MAX_BADGE_REQUIREMENT) * 100, 100);

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

        {/* All Badges organized by Tier */}
        {BADGE_TIERS.map((tier) => {
          const tierBadges = badgesByTier[tier];
          const tierColor = BADGE_TIER_COLORS[tier];
          const earnedInTier = tierBadges.filter(b => b.unlocked).length;
          
          return (
            <View key={tier} style={styles.tierSection}>
              {/* Tier Header */}
              <View style={styles.tierHeader}>
                <View style={[styles.tierDot, { backgroundColor: tierColor.primary }]} />
                <Text style={[styles.tierTitle, { color: tierColor.text }]}>{tier}</Text>
                <Text style={styles.tierProgress}>{earnedInTier}/3</Text>
              </View>
              
              {/* Badges Row */}
              <View style={styles.badgesRow}>
                {tierBadges.map((badge) => (
                  <TouchableOpacity
                    key={`${badge.tier}_${badge.rank}`}
                    style={styles.badgeItem}
                    onPress={() => {
                      if (badge.unlocked) {
                        Alert.alert(
                          `${badge.tier} Badge ${badge.rank} 🎉`,
                          `Congratulations! You earned this badge at ${badge.requirement} visits.`
                        );
                      } else {
                        Alert.alert(
                          `${badge.tier} Badge ${badge.rank} 🔒`,
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
                      {badge.requirement}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {/* Current Badge Info */}
        {currentBadgeInfo && count >= 5 && (
          <View style={styles.currentBadgeInfo}>
            <Text style={styles.currentBadgeText}>
              🏆 Current: {currentBadgeInfo.tier} {currentBadgeInfo.rank}
              {currentBadgeInfo.nextRequirement && (
                <Text style={styles.nextBadgeText}>
                  {' '}• Next: {currentBadgeInfo.nextTier} {currentBadgeInfo.nextRank} at {currentBadgeInfo.nextRequirement} visits
                </Text>
              )}
            </Text>
          </View>
        )}
      </View>
    );
  };

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
        {/* Render the active category with ALL badges */}
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
    paddingVertical: 10,
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
    flexWrap: 'wrap',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryTab: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
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
    width: 50,
    textAlign: 'right',
  },
  tierSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  tierProgress: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
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
    opacity: 0.4,
  },
  imageLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  lockOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentIndicatorText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeRequirement: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '600',
  },
  badgeRequirementUnlocked: {
    color: '#22C55E',
  },
  currentBadgeInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0FDF4',
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
  },
  currentBadgeText: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
  },
  nextBadgeText: {
    fontWeight: '400',
    color: '#15803D',
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
