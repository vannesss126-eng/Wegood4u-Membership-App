import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info, Target } from 'lucide-react-native';
import { router } from 'expo-router';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About This App</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image source={require('@/assets/images/wegood4u.png')} style={styles.logo} alt="Wegood4u"/>
          </View>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Info size={24} color="#206E56" />
            <Text style={styles.sectionTitle}>About Wegood4u</Text>
          </View>
          <Text style={styles.sectionContent}>
            Wegood4u is a membership portal designed to connect bloggers and content creators 
            with F&B and tourism businesses. Our platform gamifies the process of visiting 
            partner locations, allowing members to earn rewards while helping businesses 
            increase their visibility.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={24} color="#206E56" />
            <Text style={styles.sectionTitle}>Our Mission</Text>
          </View>
          <Text style={styles.sectionContent}>
            To create a vibrant community that bridges the gap between content creators and 
            local businesses, fostering authentic experiences and meaningful connections 
            through travel and exploration.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Wegood4u. All rights reserved.
          </Text>
          <Text style={styles.footerSubtext}>
            Made with ❤️ for content creators and local businesses
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 188,
    height: 54
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  version: {
    fontSize: 16,
    color: '#64748B',
  },
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 12,
  },
  sectionContent: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  rolesList: {
    gap: 16,
  },
  roleItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#206E56',
    paddingLeft: 16,
  },
  roleName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
});