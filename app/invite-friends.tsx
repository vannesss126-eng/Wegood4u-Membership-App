import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import InviteFriendsPage from '@/components/invite-friends/page';

export default function InviteFriendsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Invite Friends',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#1e293b" />
            </TouchableOpacity>
          ),
          headerStyle: {
            backgroundColor: 'white',
          },
          headerShadowVisible: true,
        }}
      />
      <InviteFriendsPage />
    </>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
  },
});
