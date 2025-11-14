import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Bell, 
  CheckCheck, 
  Trash2, 
  RefreshCw,
  FileText,
  Store,
  Award,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/types/notification';

export default function NotificationsScreen() {
  const { userData } = useUser();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications(userData?.id || '');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      Alert.alert('Info', 'All notifications are already read');
      return;
    }

    Alert.alert(
      'Mark All as Read',
      `Mark all ${unreadCount} unread notifications as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark All', 
          onPress: async () => {
            await markAllAsRead();
            Alert.alert('Success', 'All notifications marked as read');
          }
        },
      ]
    );
  };

  const handleDeleteNotification = (notification: Notification) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteNotification(notification.id)
        },
      ]
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.object_type) {
      case 'submission':
        router.push('/tasks');
        break;
      case 'badge':
        router.push('/tasks'); // Navigate to rewards tab
        break;
      default:
        // Just mark as read for other types
        break;
    }
  };

  const getNotificationIcon = (action: string, objectType: string) => {
    switch (action) {
      case 'submission_approved':
        return <CheckCheck size={20} color="#22C55E" />;
      case 'submission_rejected':
        return <FileText size={20} color="#EF4444" />;
      case 'badge_earned':
        return <Award size={20} color="#F59E0B" />;
      case 'submission_created':
        return <Store size={20} color="#3B82F6" />;
      default:
        return <Bell size={20} color="#64748B" />;
    }
  };

  const getNotificationMessage = (notification: Notification) => {
    const actorName = notification.actor_profile?.full_name || 
                     notification.actor_profile?.username || 
                     'Someone';

    switch (notification.action) {
      case 'submission_approved':
        return `Your submission to ${notification.data?.store_name || 'a partner store'} has been approved!`;
      case 'submission_rejected':
        return `Your submission to ${notification.data?.store_name || 'a partner store'} was rejected.`;
      case 'badge_earned':
        return `Congratulations! You've earned the "${notification.data?.badge_name}" badge!`;
      case 'submission_created':
        return `New submission received from ${actorName}`;
      default:
        return notification.action.replace('_', ' ');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const notificationDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationDate.toLocaleDateString();
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      style={[
        styles.notificationItem,
        !notification.is_read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(notification)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            {getNotificationIcon(notification.action, notification.object_type)}
          </View>
          
          <View style={styles.notificationBody}>
            <Text style={[
              styles.notificationMessage,
              !notification.is_read && styles.unreadText
            ]}>
              {getNotificationMessage(notification)}
            </Text>
            <Text style={styles.notificationTime}>
              {formatTimeAgo(notification.created_at)}
            </Text>
          </View>

          <View style={styles.notificationActions}>
            {!notification.is_read && (
              <View style={styles.unreadDot} />
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteNotification(notification)}
            >
              <Trash2 size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Bell size={32} color="#206E56" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
          <CheckCheck size={20} color="#206E56" />
        </TouchableOpacity>
      </View>

      {/* Notification Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Bell size={20} color="#206E56" />
          <Text style={styles.summaryText}>
            {notifications.length} total notifications
          </Text>
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadSummary}>
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
            <Text style={styles.unreadSummaryText}>unread</Text>
          </View>
        )}
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#206E56']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <RefreshCw size={16} color="#206E56" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyDescription}>
              You&apos;ll see notifications here when there are updates about your submissions, badges, and other activities.
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map(renderNotification)}
          </View>
        )}

        {/* Quick Actions */}
        {notifications.length > 0 && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleMarkAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck size={16} color={unreadCount > 0 ? "#206E56" : "#94A3B8"} />
              <Text style={[
                styles.quickActionText,
                { color: unreadCount > 0 ? "#206E56" : "#94A3B8" }
              ]}>
                Mark All as Read
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 16,
    flex: 1,
  },
  markAllButton: {
    padding: 4,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  unreadSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unreadSummaryText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#206E56',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationsList: {
    padding: 20,
    gap: 12,
  },
  notificationItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#206E56',
    backgroundColor: '#f0fdf4',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBody: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 22,
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '600',
  },
  notificationTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  notificationActions: {
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#206E56',
  },
  deleteButton: {
    padding: 4,
  },
  quickActions: {
    padding: 20,
    paddingTop: 0,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});