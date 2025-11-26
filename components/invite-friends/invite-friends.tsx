import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, Platform, Clipboard } from 'react-native';
import { Copy, Share2 } from 'lucide-react-native';

export default function InviteFriends() {
  const referralCode = 'WEGOOD8976DD';
  const shareMessage = `Join Wegood4u using my code: ${referralCode}`;

  const copyToClipboard = async () => {
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

  return (
    <View style={styles.container}>
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
});
