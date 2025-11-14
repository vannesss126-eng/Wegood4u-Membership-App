import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck as CheckCircle, Mail, FileText, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface UnverifiedMemberProps {
  userData: any;
  refreshUserData: () => Promise<void>;
  resendEmailConfirmation: () => Promise<void>;
}

export default function UnverifiedMember({
  userData,
  refreshUserData,
  resendEmailConfirmation
}: UnverifiedMemberProps) {
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  // Removed insets usage

  const isEmailConfirmed = !!userData?.emailConfirmedAt;
  const isQuestionnaireComplete = userData.verificationCompleted;
  const stepsCompleted = (isEmailConfirmed ? 1 : 0) + (isQuestionnaireComplete ? 1 : 0);
  const allStepsCompleted = stepsCompleted === 2;

  const handleResendEmail = async () => {
    setIsResendingEmail(true);
    try {
      await resendEmailConfirmation();
      Alert.alert('Success', 'Confirmation email sent! Please check your inbox.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsResendingEmail(false);
    }
  };

  const navigateToQuestionnaire = () => {
    router.push('/question');
  };

  const handleRequestMember = async () => {
    // Check if both requirements are met
    if (!isEmailConfirmed || !isQuestionnaireComplete) {
      const missingRequirements = [];
      if (!isEmailConfirmed) missingRequirements.push('Email confirmation');
      if (!isQuestionnaireComplete) missingRequirements.push('Questionnaire completion');
      
      Alert.alert(
        'Requirements Not Met',
        `Please complete the following requirements first:\n• ${missingRequirements.join('\n• ')}`
      );
      return;
    }

    try {
      // Update user role to 'member' in the database
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'member' })
        .eq('id', userData.id);

      if (error) {
        throw error;
      }

      // Refresh user data to reflect the role change
      await refreshUserData();

      Alert.alert(
        'Congratulations! 🎉',
        'Your role has been successfully upgraded to Member! You can now upload proof of travel and earn badges.',
        [
          { text: 'OK', onPress: () => console.log('Role upgraded to member') }
        ]
      );
    } catch (error: any) {
      console.error('Error updating role:', error);
      Alert.alert(
        'Update Failed',
        'Failed to update your role. Please try again later.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Unverified Member</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.verificationContainer}>
          <Text style={styles.verificationTitle}>Verification Checklist</Text>
          <Text style={styles.verificationSubtitle}>
            Complete all steps below to become a verified member and unlock travel proof uploads and rewards.
          </Text>

          {/* Email Confirmation */}
          <View style={styles.checklistItem}>
            <View style={styles.checklistHeader}>
              <View style={styles.checklistIconContainer}>
                <Mail size={20} color={isEmailConfirmed ? '#22C55E' : '#64748B'} />
              </View>
              <View style={styles.checklistContent}>
                <Text style={styles.checklistTitle}>Confirm Email Address</Text>
                <Text style={styles.checklistDescription}>
                  {isEmailConfirmed 
                    ? 'Your email has been confirmed' 
                    : 'Please check your email and click the confirmation link'
                  }
                </Text>
              </View>
              <View style={styles.checklistStatus}>
                {isEmailConfirmed ? (
                  <CheckCircle size={24} color="#22C55E" />
                ) : (
                  <X size={24} color="#EF4444" />
                )}
              </View>
            </View>
            {!isEmailConfirmed && (
              <TouchableOpacity
                style={[styles.actionButton, isResendingEmail && styles.actionButtonDisabled]}
                onPress={handleResendEmail}
                disabled={isResendingEmail}
              >
                <Mail size={16} color="#206E56" />
                <Text style={styles.actionButtonText}>
                  {isResendingEmail ? 'Sending...' : 'Resend Confirmation Email'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Questionnaire */}
          <View style={styles.checklistItem}>
            <View style={styles.checklistHeader}>
              <View style={styles.checklistIconContainer}>
                <FileText size={20} color={isQuestionnaireComplete ? '#22C55E' : '#64748B'} />
              </View>
              <View style={styles.checklistContent}>
                <Text style={styles.checklistTitle}>Fill the Questionnaire Form</Text>
                <Text style={styles.checklistDescription}>
                  {isQuestionnaireComplete 
                    ? 'Questionnaire has been completed' 
                    : 'Complete the travel questionnaire to help us serve you better'
                  }
                </Text>
              </View>
              <View style={styles.checklistStatus}>
                {isQuestionnaireComplete ? (
                  <CheckCircle size={24} color="#22C55E" />
                ) : (
                  <X size={24} color="#EF4444" />
                )}
              </View>
            </View>
            {!isQuestionnaireComplete ? (
              <TouchableOpacity style={styles.actionButton} onPress={navigateToQuestionnaire}>
                <FileText size={16} color="#206E56" />
                <Text style={styles.actionButtonText}>Fill Out Verification Form</Text>
              </TouchableOpacity> 
              ) : (
              <TouchableOpacity style={styles.confirmButton}>
                <FileText size={16} color="#206E56" />
                <Text style={styles.confirmButtonText}>Verification Form Finished</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Summary */}
          <View style={styles.progressSummary}>
            <Text style={styles.progressTitle}>Verification Progress</Text>
            <Text style={styles.progressDescription}>
              Once you have completed all the verification requirements, please click the button to request the Member Role
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${stepsCompleted / 2 * 100}%` 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {stepsCompleted} of 2 steps completed.
            </Text>

            <TouchableOpacity
              style={[styles.requestButton, !allStepsCompleted && styles.requestButtonDisabled]}
              onPress={handleRequestMember}
              disabled={!allStepsCompleted}
            >
              <Text style={styles.requestButtonText}>Request to be Member</Text>
            </TouchableOpacity>

            {!allStepsCompleted && (
              <Text style={styles.requestHintText}>✗ Please complete all requirements to be a member</Text>
            )}
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  content: {
    flex: 1,
  },
  verificationContainer: {
    padding: 20,
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  verificationSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  checklistItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  checklistContent: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  checklistDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 18,
  },
  checklistStatus: {
    marginLeft: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CBEED2',
    borderWidth: 1,
    borderColor: '#206E56',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#206E56',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CBEED2',
    borderWidth: 1,
    borderColor: '#206E56',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  confirmButtonText: {
    color: '#206E56',
    fontSize: 14,
    fontWeight: '600',
  },
  progressSummary: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#206E56',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  progressDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  requestButton: {
    marginTop: 12,
    backgroundColor: '#206E56',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  requestButtonDisabled: {
    opacity: 0.6,
  },
  requestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  requestHintText: {
    marginTop: 8,
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
  },
});