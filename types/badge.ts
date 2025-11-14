export interface BadgeLevel {
  level: number;
  requirement: number;
  achieved: boolean;
  progress: number;
}

export interface BadgeCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  levels: BadgeLevel[];
}

export interface Badge {
  id: number;
  name: string;
  category: 'activity' | 'cafe' | 'restaurant';
  required_count: number;
  image_url: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserBadge {
  user_id: string;
  badge_id: number;
  earned_at: string;
}