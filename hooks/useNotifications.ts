import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';
import { UseNotificationsReturn, Notification } from '@/types/notification';

export function useNotifications(userId: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (showRefreshIndicator = false) => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    if (!showRefreshIndicator) {
      setIsLoading(true);
    }

    try {
      setError(null);
      
      // Fetch notifications with actor profile data
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select(`
          *,
          actor_profile:actor_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError);
        throw new Error('Failed to fetch notifications');
      }

      // Transform the data to match our interface
      const transformedNotifications: Notification[] = (data || []).map(item => ({
        id: item.id,
        recipient_id: item.recipient_id,
        actor_id: item.actor_id,
        action: item.action,
        object_type: item.object_type,
        object_id: item.object_id,
        data: item.data,
        is_read: item.is_read,
        created_at: item.created_at,
        actor_profile: item.actor_profile,
      }));

      setNotifications(transformedNotifications);
    } catch (err: any) {
      console.error('Error in fetchNotifications:', err);
      setError(err.message);
      if (!showRefreshIndicator) {
        Alert.alert('Error', 'Failed to fetch notifications');
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (err: any) {
      console.error('Error in markAsRead:', err);
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        throw new Error('Failed to mark all notifications as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
    } catch (err: any) {
      console.error('Error in markAllAsRead:', err);
      Alert.alert('Error', 'Failed to mark all notifications as read');
    }
  }, [userId]);

  const deleteNotification = useCallback(async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        throw new Error('Failed to delete notification');
      }

      // Update local state
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (err: any) {
      console.error('Error in deleteNotification:', err);
      Alert.alert('Error', 'Failed to delete notification');
    }
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}