import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { CircleCheck as CheckCircle, Star, Coffee, UtensilsCrossed, Store } from 'lucide-react-native';

import type { TransformedSubmission, ApprovedCounts, BadgeLevel, BadgeCategory } from '@/types';

interface BadgesProps {
  userData: any;
  submissions: TransformedSubmission[];
  approvedCounts: ApprovedCounts;
  isLoadingSubmissions: boolean;
  fetchSubmissions: (showRefreshIndicator?: boolean) => Promise<void>;
}

export default function Badges({ 
  userData, 
  submissions, 
  approvedCounts, 
  isLoadingSubmissions, 
  fetchSubmissions 
}: BadgesProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle refresh button press
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchSubmissions(true);
      Alert.alert('Success', `Badges updated! Found ${approvedCounts.total} approved submissions.`);
    } catch (error: any) {
      console.error('Badge refresh error:', error);
      Alert.alert('Error', error?.message || 'Failed to refresh badges. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const createBadgeLevels = (currentCount: number): BadgeLevel[] => {
    const requirements = [1, 5, 10]; // More realistic requirements
    return requirements.map((req, index) => ({
      level: index + 1,
      requirement: req,
      achieved: currentCount >= req,
      progress: Math.min((currentCount / req) * 100, 100),
    }));
  };

  const badgeCategories: BadgeCategory[] = [
    {
      id: 'any',
      name: 'Explorer',
      icon: <Store size={24} color="#8B5CF6" />,
      color: '#8B5CF6',
      bgColor: '#F3F4F6',
      levels: createBadgeLevels(approvedCounts.total),
    },
    {
      id: 'cafe',
      name: 'Coffee Lover',
      icon: <Coffee size={24} color="#F59E0B" />,
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      levels: createBadgeLevels(approvedCounts.cafe),
    },
    {
      id: 'restaurant',
      name: 'Foodie',
      icon: <UtensilsCrossed size={24} color="#EF4444" />,
      color: '#EF4444',
      bgColor: '#FEE2E2',
      levels: createBadgeLevels(approvedCounts.restaurant),
    },
  ];

  const renderProgressBar = (progress: number, color: string) => (
    <View style={styles.progressBarSmall}>
      <View style={[styles.progressFillSmall, { width: `${progress}%`, backgroundColor: color }]} />
    </View>
  );

  const getCurrentCountForCategory = (categoryId: string): number => {
    switch (categoryId) {
      case 'any':
        return approvedCounts.total;
      case 'cafe':
        return approvedCounts.cafe;
      case 'restaurant':
        return approvedCounts.restaurant;
      default:
        return 0;
    }
  };

  const renderBadgeLevel = (category: BadgeCategory, level: BadgeLevel) => {
    const currentCount = getCurrentCountForCategory(category.id);
    
    return (
      <View key={level.level} style={[styles.badgeLevel, level.achieved && styles.achievedBadge]}>
        <View style={[styles.badgeIcon, { backgroundColor: level.achieved ? category.color : '#F3F4F6' }]}>
          {level.achieved ? (
            <Star size={16} color="white" fill="white" />
          ) : (
            <Text style={styles.badgeLevelNumber}>{level.level}</Text>
          )}
        </View>
        <View style={styles.badgeInfo}>
          <Text style={[styles.badgeLevelText, level.achieved && styles.achievedBadgeText]}>
            Level {level.level}
          </Text>
          <Text style={styles.badgeRequirement}>
            {level.requirement} approved visits required
          </Text>
          {!level.achieved && (
            <Text style={styles.badgeProgress}>
              {currentCount} / {level.requirement}
            </Text>
          )}
          {!level.achieved && renderProgressBar(level.progress, category.color)}
        </View>
        {level.achieved && (
          <CheckCircle size={20} color={category.color} />
        )}
      </View>
    );
  };

  if (isLoadingSubmissions && approvedCounts.total === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Star size={32} color="#64748B" />
        <Text style={styles.loadingText}>Loading your achievements...</Text>
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
          <Star 
            size={16} 
            color={isRefreshing ? "#94A3B8" : "#64748B"} 
          />
          <Text style={[styles.refreshText, isRefreshing && styles.refreshTextDisabled]}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.rewardsContainer} showsVerticalScrollIndicator={false}>
        {/* Debug Info - Remove this in production 
        <View style={styles.debugCard}>
          <Text style={styles.debugTitle}>Debug Info (Remove in production)</Text>
          <Text style={styles.debugText}>Total Approved: {approvedCounts.total}</Text>
          <Text style={styles.debugText}>Restaurant: {approvedCounts.restaurant}</Text>
          <Text style={styles.debugText}>Cafe: {approvedCounts.cafe}</Text>
          <Text style={styles.debugText}>Others: {approvedCounts.others}</Text>
          <Text style={styles.debugText}>Total Submissions: {submissions.length}</Text>
          <Text style={styles.debugText}>User ID: {userData?.id || 'Not set'}</Text>
        </View>
        */}
        
        {/* Achievement Summary */}
        <View style={styles.achievementSummary}>
          <Text style={styles.sectionTitle}>Achievement Progress</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{approvedCounts.total}</Text>
              <Text style={styles.summaryLabel}>Total Visits</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{approvedCounts.cafe}</Text>
              <Text style={styles.summaryLabel}>Café Visits</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryNumber}>{approvedCounts.restaurant}</Text>
              <Text style={styles.summaryLabel}>Restaurant Visits</Text>
            </View>
          </View>
          <Text style={styles.achievementNote}>
            Only approved submissions count towards badges
          </Text>
          {approvedCounts.total > 0 && (
            <Text style={styles.pointsSubtext}>
              You have {approvedCounts.total} approved submissions!
            </Text>
          )}
        </View>

        {/* Badge Categories */}
        {badgeCategories.map((category) => {
          const earnedBadges = category.levels.filter(l => l.achieved).length;
          return (
            <View key={category.id} style={styles.badgeCategory}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryIconContainer, { backgroundColor: category.bgColor }]}>
                  {category.icon}
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryProgress}>
                    {earnedBadges} of {category.levels.length} badges earned
                  </Text>
                  {earnedBadges > 0 && (
                    <Text style={[styles.categoryAchievement, { color: category.color }]}>
                      🎉 Level {earnedBadges} achieved!
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.badgeLevels}>
                {category.levels.map((level) => renderBadgeLevel(category, level))}
              </View>
            </View>
          );
        })}

        {/* Tips Section */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Tips to Earn More Badges</Text>
          <View style={styles.tipsList}>
            <Text style={styles.tipItem}>• Visit different types of partner stores (restaurants, cafés)</Text>
            <Text style={styles.tipItem}>• Take clear photos of your receipt and selfie</Text>
            <Text style={styles.tipItem}>• Submit proof within 24 hours of your visit</Text>
            <Text style={styles.tipItem}>• Check out our partner stores in different cities</Text>
            <Text style={styles.tipItem}>• Wait for admin approval to earn points and badges</Text>
          </View>
        </View>

        {approvedCounts.total === 0 && (
          <View style={styles.emptyState}>
            <Star size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Start Your Journey!</Text>
            <Text style={styles.emptyDescription}>
              Submit your first proof of travel to begin earning badges and points. Only approved submissions count towards your achievements.
            </Text>
          </View>
        )}
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
    marginBottom: 20,
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
    borderColor: '#f1f5f9',
  },
  refreshText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  refreshTextDisabled: {
    color: '#94A3B8',
  },
  rewardsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  debugCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#7F1D1D',
    marginBottom: 4,
  },
  pointsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  pointsInfo: {
    flex: 1,
  },
  pointsNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  pointsLabel: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  pointsDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  pointsSubtext: {
    fontSize: 12,
    color: '#22C55E',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  achievementSummary: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#206E56',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  achievementNote: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  badgeCategory: {
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
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  categoryProgress: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  categoryAchievement: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  badgeLevels: {
    gap: 12,
  },
  badgeLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  achievedBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeLevelNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  badgeInfo: {
    flex: 1,
  },
  badgeLevelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  achievedBadgeText: {
    color: '#206E56',
  },
  badgeRequirement: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badgeProgress: {
    fontSize: 12,
    color: '#E5C69E',
    marginTop: 2,
    fontWeight: '600',
  },
  progressBarSmall: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFillSmall: {
    height: '100%',
    borderRadius: 2,
  },
  tipsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
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
    gap: 8,
  },
  tipItem: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
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
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});