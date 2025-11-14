import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, User, Settings, Bell, Lock, Info, MessageCircle, CircleHelp as HelpCircle, LogOut, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

interface SettingsOverlayProps {
  visible: boolean;
  onClose: () => void;
  userData: any;
}

export default function SettingsOverlay({ visible, onClose, userData }: SettingsOverlayProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const isSubscriber = userData?.role === 'subscriber'; // Conditional check

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => {
            onClose();
            await signOut();
          }
        },
      ]
    );
  };

  const handleAccountProfile = () => {
    onClose();
    router.push('/profile/account');
  };

  const handleEditPreferences = () => {
    onClose();
    router.push('/profile/preferences');
  };

  const handleNotifications = () => {
    onClose();
    router.push('/profile/notifications');
  };

  const handleChangePassword = () => {
    onClose();
    router.push('/profile/change-password');
  };

  const handleAboutApp = () => {
    onClose();
    router.push('/profile/about');
  };

  const handleContactUs = () => {
    onClose();
    router.push('/profile/contact');
  };

  const handleFAQ = () => {
    onClose();
    router.push('/profile/faq');
  };

  const renderMenuItem = (
    icon: React.ReactNode,
    title: string,
    onPress: () => void,
    showChevron: boolean = true
  ) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuItemIcon}>
          {icon}
        </View>
        <Text style={styles.menuItemText}>{title}</Text>
      </View>
      {showChevron && <ChevronRight size={20} color="#64748B" />}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sidebar}>
          <SafeAreaView style={styles.sidebarContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Settings</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* General Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>General</Text>
                
                {renderMenuItem(
                  <User size={20} color="#64748B" />,
                  'Account Profile',
                  handleAccountProfile
                )}
                
                {!isSubscriber && renderMenuItem(
                  <Settings size={20} color="#64748B" />,
                  'Edit Preferences',
                  handleEditPreferences
                )}

                {!isSubscriber && renderMenuItem(
                  <Bell size={20} color="#64748B" />,
                  'Notifications',
                  handleNotifications
                )}
              </View>

              {/* Security Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Security</Text>
                
                {renderMenuItem(
                  <Lock size={20} color="#64748B" />,
                  'Change Password',
                  handleChangePassword
                )}
              </View>

              {/* About Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                
                {renderMenuItem(
                  <Info size={20} color="#64748B" />,
                  'About This App',
                  handleAboutApp
                )}
                
                {renderMenuItem(
                  <MessageCircle size={20} color="#64748B" />,
                  'Contact Us',
                  handleContactUs
                )}
                
                {renderMenuItem(
                  <HelpCircle size={20} color="#64748B" />,
                  'FAQ',
                  handleFAQ
                )}

                {/* Logout */}
                <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
                  <View style={styles.menuItemLeft}>
                    <View style={styles.logoutIcon}>
                      <LogOut size={20} color="#EF4444" />
                    </View>
                    <Text style={styles.logoutText}>Logout</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
        
        {/* Backdrop */}
        <TouchableOpacity 
          style={styles.backdrop} 
          onPress={onClose}
          activeOpacity={1}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  sidebarContent: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 16,
    marginHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  themeOptions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 8,
  },
  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});