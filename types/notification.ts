export interface Notification {
  id: number;
  recipient_id: string;
  actor_id: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  data: any;
  is_read: boolean;
  created_at: string;
  // Joined actor profile data
  actor_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: (showRefreshIndicator?: boolean) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
}