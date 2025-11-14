import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { router } from 'expo-router';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export default function FAQScreen() {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);

  const faqData: FAQItem[] = [
    {
      id: 1,
      category: 'Getting Started',
      question: 'How do I become a member?',
      answer: 'To become a member, you need to: 1) Confirm your email address, 2) Complete the travel questionnaire form. Once both steps are completed, you can request to become a member and start participating in activities.'
    },
    {
      id: 2,
      category: 'Getting Started',
      question: 'What is the difference between Subscriber and Member?',
      answer: 'Subscribers can only view partner stores and blogs. Members can upload proof of visits, earn badges, and participate in the reward system. Members have completed email verification and the questionnaire.'
    },
    {
      id: 3,
      category: 'Submissions',
      question: 'How do I submit proof of visit?',
      answer: 'Go to the Tasks tab, select a partner store, upload a selfie photo and receipt photo, then submit for admin review. Make sure photos are clear and show the required information.'
    },
    {
      id: 4,
      category: 'Submissions',
      question: 'How long does it take for submissions to be approved?',
      answer: 'Submissions are typically reviewed within 24-48 hours. You will be notified once your submission is approved or if any changes are needed.'
    },
    {
      id: 5,
      category: 'Badges & Rewards',
      question: 'How do I earn badges?',
      answer: 'Badges are earned automatically when you reach certain milestones of approved visits. There are different badge categories for total visits, cafe visits, and restaurant visits.'
    },
    {
      id: 6,
      category: 'Badges & Rewards',
      question: 'What are the badge requirements?',
      answer: 'Badge levels are awarded at 1, 5, 10, 25, and 50 approved visits for each category (total visits, cafes, restaurants). Each level unlocks a new badge in your collection.'
    },
    {
      id: 7,
      category: 'Affiliate Program',
      question: 'How do I become an Affiliate Member?',
      answer: 'First become a regular Member, then request affiliate status. An admin will review your request and, if approved, provide you with a unique invitation code to share with others.'
    },
    {
      id: 8,
      category: 'Affiliate Program',
      question: 'How does the referral system work?',
      answer: 'Affiliate Members get unique invitation codes. When someone signs up using your code, they become your direct referral (Level 1). If they become affiliates and refer others, those become your indirect referrals (Level 2).'
    },
    {
      id: 9,
      category: 'Account',
      question: 'How do I change my password?',
      answer: 'Go to Profile > Settings > Security > Change Password. Enter your current password and choose a new secure password that meets our requirements.'
    },
    {
      id: 10,
      category: 'Account',
      question: 'Can I edit my travel preferences?',
      answer: 'Yes! Go to Profile > Settings > Edit Preferences to update your travel destinations, accommodation preferences, budget, and communication details.'
    },
    {
      id: 11,
      category: 'Partner Stores',
      question: 'How do I find partner stores?',
      answer: 'Use the Map tab to see all partner stores by location, or browse by category (Restaurant/Cafe) from the Home page. You can search, filter by location, and sort by rating.'
    },
    {
      id: 12,
      category: 'Technical',
      question: 'The app is not working properly, what should I do?',
      answer: 'Try closing and reopening the app first. If issues persist, check your internet connection. For ongoing problems, contact our support team through the Contact Us page.'
    }
  ];

  const categories = [...new Set(faqData.map(item => item.category))];

  const toggleExpanded = (id: number) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const renderFAQItem = (item: FAQItem) => {
    const isExpanded = expandedItems.includes(item.id);
    
    return (
      <View key={item.id} style={styles.faqItem}>
        <TouchableOpacity
          style={styles.questionContainer}
          onPress={() => toggleExpanded(item.id)}
        >
          <Text style={styles.questionText}>{item.question}</Text>
          {isExpanded ? (
            <ChevronUp size={20} color="#64748B" />
          ) : (
            <ChevronDown size={20} color="#64748B" />
          )}
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.answerContainer}>
            <Text style={styles.answerText}>{item.answer}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Frequently Asked Questions</Text>
          <Text style={styles.introDescription}>
            Find answers to common questions about Wegood4u. If you can&apos;t find what you&apos;re looking for, feel free to contact us.
          </Text>
        </View>

        {categories.map(category => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category}</Text>
            <View style={styles.faqList}>
              {faqData
                .filter(item => item.category === category)
                .map(renderFAQItem)
              }
            </View>
          </View>
        ))}

        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Still have questions?</Text>
          <Text style={styles.contactDescription}>
            Can&apos;t find the answer you&apos;re looking for? Our support team is here to help.
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => router.push('/profile/contact')}
          >
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
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
  introSection: {
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
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#206E56',
    marginBottom: 16,
  },
  faqList: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 12,
  },
  answerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#f8fafc',
  },
  answerText: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },
  contactSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  contactDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  contactButton: {
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  contactButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});