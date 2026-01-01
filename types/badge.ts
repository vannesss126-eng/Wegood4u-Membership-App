// Badge tier types
export type BadgeTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
export type BadgeRank = 1 | 2 | 3;
export type BadgeCategoryId = 'bar' | 'cafe' | 'restaurant';

// Legacy interface - kept for backwards compatibility
export interface BadgeLevel {
  level: number;
  requirement: number;
  achieved: boolean;
  progress: number;
}

// Legacy interface - kept for backwards compatibility
export interface BadgeCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  levels: BadgeLevel[];
}

// New badge item interface
export interface BadgeItem {
  tier: BadgeTier;
  rank: BadgeRank;
  requirement: number;
  imageUrl: string;
  unlocked: boolean;
  current: boolean;
}

// Badge category with items
export interface BadgeCategoryWithItems {
  id: BadgeCategoryId;
  displayName: string;
  color: string;
  bgColor: string;
  approvedCount: number;
  currentBadge: BadgeItem | null;
  badges: BadgeItem[];
  progress: number;
  nextRequirement: number | null;
}

// Database badge interface
export interface Badge {
  id: number;
  name: string;
  category: 'activity' | 'cafe' | 'restaurant' | 'bar';
  required_count: number;
  image_url: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// User earned badge
export interface UserBadge {
  user_id: string;
  badge_id: number;
  earned_at: string;
}