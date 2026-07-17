import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, UserPlus } from 'lucide-react-native';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';

// Admin Console — the entry point for admin-only tools. Gated on role === 'admin'.
// All actions here are still bound by the DB's RLS (admins can write profiles /
// partner_accounts / invitation_codes; non-admins can't). For now: one tool.
export default function AdminConsoleScreen() {
  const { userData } = useUser();
  const isAdmin = userData?.role === 'admin';

  // Belt-and-braces: non-admins should never reach this route. The real gate is
  // RLS on the server; this just avoids showing the UI.
  useEffect(() => {
    if (userData && !isAdmin) router.replace('/(tabs)/profile');
  }, [userData, isAdmin]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Console</Text>
        </View>
        <View style={styles.blockedBox}>
          <Text style={styles.blockedText}>Admins only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tools = [
    {
      key: 'create-partner',
      icon: <UserPlus size={22} color="#16513F" />,
      title: 'Create Partner Account',
      subtitle: 'Provision a vendor or event partner login + role',
      onPress: () => router.push('/admin/create-partner'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Console</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Partner management</Text>
        {tools.map((t) => (
          <TouchableOpacity key={t.key} style={styles.toolRow} onPress={t.onPress} activeOpacity={0.7}>
            <View style={styles.toolIcon}>{t.icon}</View>
            <View style={styles.toolTextWrap}>
              <Text style={styles.toolTitle}>{t.title}</Text>
              <Text style={styles.toolSubtitle}>{t.subtitle}</Text>
            </View>
            <ChevronRight size={20} color="#94a3b8" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginLeft: 16 },
  content: { flex: 1, paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 10,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTextWrap: { flex: 1 },
  toolTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  toolSubtitle: { fontSize: 12.5, color: '#64748b', marginTop: 2 },
  blockedBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { color: '#64748b', fontSize: 15 },
});
