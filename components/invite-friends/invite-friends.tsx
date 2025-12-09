import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, Platform, Clipboard, ActivityIndicator } from 'react-native';
import { Copy, Share2, Sparkles } from 'lucide-react-native';
import { useUser } from '@/context/UserContext';

export default function InviteFriends() {
  const { userData, generateInvitationCodeForUser, isLoading } = useUser();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const referralCode = userData?.invitationCode || '';
  const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.saysheji.wegood4u';
  const shareMessage = `Join Wegood4u using my code: ${referralCode}\n\nDownload the app: ${PLAY_STORE_LINK}`;
  const hasInvitationCode = !!userData?.invitationCode;

  const handleGenerateCode = async () => {
    if (!userData?.id) {
      Alert.alert('Error', 'Unable to generate code. Please try again later.');
      return;
    }

    try {
      setIsGenerating(true);
      await generateInvitationCodeForUser();
      Alert.alert('Success!', 'Your invitation code has been generated successfully.');
    } catch (error: any) {
      console.error('Failed to generate invitation code:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to generate invitation code. Please try again later.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!referralCode) {
      Alert.alert('Error', 'No referral code available');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(referralCode);
      } else {
        Clipboard.setString(referralCode);
      }
      Alert.alert('Copied!', 'Referral code has been copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
      Alert.alert('Error', 'Failed to copy referral code');
    }
  };

  const shareReferral = async () => {
    if (!referralCode) {
      Alert.alert('Error', 'No referral code available');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        Alert.alert('Share', shareMessage);
      } else {
        await Share.share({
          message: shareMessage,
        });
      }
    } catch (error) {
      console.error('Failed to share:', error);
      Alert.alert('Error', 'Failed to share referral code');
    }
  };

  // Show loading state while user data is loading
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#206E56" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hasInvitationCode ? (
        // User has invitation code - show code display
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Share2 size={48} color="#206E56" />
          </View>

          <Text style={styles.cardTitle}>Your Referral Code</Text>
          <Text style={styles.cardDescription}>
            Share your unique code with friends and earn rewards when they join!
          </Text>

          <View style={styles.codeContainer}>
            <Text style={styles.code}>{referralCode}</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
              <Copy size={20} color="white" />
              <Text style={styles.copyButtonText}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={shareReferral}>
              <Share2 size={20} color="#206E56" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // User doesn't have invitation code - show generate code UI
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Sparkles size={48} color="#206E56" />
          </View>

          <Text style={styles.cardTitle}>Get Your Referral Code</Text>
          <Text style={styles.cardDescription}>
            Generate your unique invitation code to start inviting friends and earn rewards!
          </Text>

          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
            onPress={handleGenerateCode}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                <Text style={styles.generateButtonText}>Generating...</Text>
              </>
            ) : (
              <Text style={styles.generateButtonText}>Generate Code</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <View style={styles.infoItem}>
          <View style={styles.infoBullet} />
          <Text style={styles.infoText}>Share your referral code with friends</Text>
        </View>
        <View style={styles.infoItem}>
          <View style={styles.infoBullet} />
          <Text style={styles.infoText}>They sign up using your code</Text>
        </View>
        <View style={styles.infoItem}>
          <View style={styles.infoBullet} />
          <Text style={styles.infoText}>You both earn rewards!</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CBEED2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  codeContainer: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  code: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#206E56',
    letterSpacing: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#206E56',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  copyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CBEED2',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#206E56',
  },
  shareButtonText: {
    color: '#206E56',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#206E56',
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  generateButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#206E56',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
