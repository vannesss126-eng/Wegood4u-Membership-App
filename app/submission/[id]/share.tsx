import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  Star,
  Link2,
  Upload,
  Check,
  Clock,
  X as XIcon,
  Copy,
} from 'lucide-react-native';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/lib/supabase';
import {
  useSubmissionShare,
  type ShareStatus,
  type SubmissionShareRow,
} from '@/hooks/useSubmissionShare';
import {
  SHARE_PLATFORMS,
  STARS_PER_PLATFORM,
  STARS_ALL_THREE_BONUS,
  STARS_MAX,
  REQUIRED_HASHTAGS,
  REQUIRED_MENTION,
  type SharePlatform,
} from '@/lib/shareConfig';

const BAR_GREEN = '#206E56';
const BAR_GREEN_DEEP = '#16513F';
const STAR_GOLD = '#E5A93D';

interface SubmissionLite {
  id: number;
  partner_store_name: string | null;
  partner_store_category: string | null;
  created_at: string;
  status: string;
}

function statusToBadge(status: ShareStatus | null) {
  if (!status) return null;
  if (status === 'verified') {
    return { icon: <Check size={14} color="#FFFFFF" strokeWidth={3} />, label: 'Verified', bg: BAR_GREEN };
  }
  if (status === 'pending') {
    return { icon: <Clock size={14} color="#9C6F1A" />, label: 'Pending review', bg: '#FFF4DD' };
  }
  return { icon: <XIcon size={14} color="#FFFFFF" strokeWidth={3} />, label: 'Rejected', bg: '#EF4444' };
}

export default function ShareEarnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const submissionId = params.id ? Number(params.id) : null;
  const { userData } = useUser();

  const [submission, setSubmission] = useState<SubmissionLite | null>(null);
  const [submissionLoading, setSubmissionLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<SharePlatform | null>(null);
  const [postUrl, setPostUrl] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);

  const { byPlatform, isSubmitting, error, submitShare } = useSubmissionShare(
    userData?.id,
    submissionId,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!submissionId) {
        setSubmissionLoading(false);
        return;
      }
      const { data } = await supabase
        .from('submissions')
        .select('id, partner_store_name, partner_store_category, created_at, status')
        .eq('id', submissionId)
        .single();
      if (!cancelled) {
        setSubmission(data as SubmissionLite | null);
        setSubmissionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  const verifiedCount = SHARE_PLATFORMS.filter(
    (p) => byPlatform[p.key]?.status === 'verified',
  ).length;
  const earnedStars =
    verifiedCount * STARS_PER_PLATFORM +
    (verifiedCount === 3 ? STARS_ALL_THREE_BONUS : 0);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
  };

  const pickScreenshot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setScreenshotUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!activePlatform) return;
    if (!postUrl.trim()) {
      Alert.alert('Post URL required', 'Paste the link to your share post.');
      return;
    }
    const row = await submitShare(activePlatform, {
      postUrl: postUrl.trim(),
      screenshotUri,
    });
    if (row) {
      Alert.alert(
        'Submitted',
        'Our team will review your share shortly. Stars are awarded once verified.',
      );
      setActivePlatform(null);
      setPostUrl('');
      setScreenshotUri(null);
    }
  };

  if (submissionLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color={BAR_GREEN} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!submission || submission.status !== 'approved') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share & Earn</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ padding: 24 }}>
          <Text style={styles.bodyText}>
            This submission isn’t available for sharing — only approved submissions earn share rewards.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share & Earn</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Reward this trip</Text>
              <View style={styles.heroPointsRow}>
                <Text style={styles.heroPoints}>+{STARS_MAX}</Text>
                <Text style={styles.heroUnit}>stars max</Text>
              </View>
              <Text style={styles.heroTagline}>
                Share to FB · IG · TikTok for the +{STARS_ALL_THREE_BONUS} bonus
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <Star size={36} color={STAR_GOLD} fill={STAR_GOLD} />
            </View>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>This trip</Text>
            <Text style={styles.progressText}>
              <Text style={styles.progressBold}>{earnedStars}</Text> / {STARS_MAX} ★ earned
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(earnedStars / STARS_MAX) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Trip card */}
        <Text style={styles.sectionLabel}>Trip</Text>
        <View style={styles.tripCard}>
          <Text style={styles.tripPlace}>{submission.partner_store_name ?? 'Approved trip'}</Text>
          <Text style={styles.tripMeta}>
            {(submission.partner_store_category ?? '').toUpperCase()} · {' '}
            {new Date(submission.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Platforms */}
        <Text style={styles.sectionLabel}>Platforms</Text>
        {SHARE_PLATFORMS.map((p) => {
          const row = byPlatform[p.key];
          const status = (row?.status ?? null) as ShareStatus | null;
          const badge = statusToBadge(status);
          const isActive = activePlatform === p.key;
          const canVerify = !row || row.status === 'rejected';

          return (
            <View key={p.key} style={styles.platformWrap}>
              <TouchableOpacity
                style={styles.platformRow}
                onPress={() => {
                  if (canVerify) {
                    setActivePlatform(isActive ? null : p.key);
                    setPostUrl('');
                    setScreenshotUri(null);
                  }
                }}
                disabled={!canVerify}
              >
                <View style={[styles.platformDot, { backgroundColor: p.brandColor }]} />
                <Text style={styles.platformName}>{p.label}</Text>
                <View style={styles.starChip}>
                  <Star size={11} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.starChipText}>+{STARS_PER_PLATFORM}</Text>
                </View>
                {badge ? (
                  <View style={[styles.statusChip, { backgroundColor: badge.bg }]}>
                    {badge.icon}
                    <Text
                      style={[
                        styles.statusChipText,
                        status === 'pending' && { color: '#9C6F1A' },
                      ]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.tapToVerify}>
                    {isActive ? 'Cancel' : 'Verify'}
                  </Text>
                )}
              </TouchableOpacity>

              {isActive && canVerify && (
                <View style={styles.verifyCard}>
                  <Text style={styles.verifyDesc}>
                    Paste the link to your {p.label} post. Optionally add a screenshot for private accounts.
                  </Text>

                  <View style={styles.inputWrap}>
                    <Link2 size={14} color="#94A3B8" />
                    <TextInput
                      style={styles.input}
                      placeholder={`https://${p.key}.com/...`}
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      value={postUrl}
                      onChangeText={setPostUrl}
                    />
                  </View>

                  {screenshotUri && (
                    <View style={styles.screenshotPreview}>
                      <Image source={{ uri: screenshotUri }} style={styles.screenshotImg} />
                      <TouchableOpacity
                        style={styles.removeShot}
                        onPress={() => setScreenshotUri(null)}
                      >
                        <XIcon size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.btnSecondary} onPress={pickScreenshot}>
                      <Upload size={14} color={BAR_GREEN} />
                      <Text style={styles.btnSecondaryText}>
                        {screenshotUri ? 'Replace' : 'Screenshot'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnPrimary, isSubmitting && { opacity: 0.6 }]}
                      onPress={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Check size={14} color="#FFFFFF" strokeWidth={3} />
                          <Text style={styles.btnPrimaryText}>Submit for review</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {error && <Text style={styles.errorText}>{error}</Text>}
                </View>
              )}
            </View>
          );
        })}

        {/* All-three bonus row */}
        <View style={styles.bonusRow}>
          <Star size={16} color={STAR_GOLD} fill={STAR_GOLD} />
          <Text style={styles.bonusText}>All 3 platforms shared on this trip</Text>
          <Text style={styles.bonusReward}>+{STARS_ALL_THREE_BONUS} ★</Text>
        </View>

        {/* Hashtags */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Required hashtags</Text>
        <View style={styles.pillGrid}>
          {REQUIRED_HASHTAGS.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.pill}
              onPress={() => copyToClipboard(tag)}
            >
              <Text style={styles.pillText}>{tag}</Text>
              <Copy size={12} color={BAR_GREEN_DEEP} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.pill, styles.pillMention]}
            onPress={() => copyToClipboard(REQUIRED_MENTION)}
          >
            <Text style={[styles.pillText, { color: '#0F62B0' }]}>{REQUIRED_MENTION}</Text>
            <Copy size={12} color="#0F62B0" />
          </TouchableOpacity>
        </View>
        <Text style={styles.pillNote}>Tap a tag to copy</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  headerSpacer: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  bodyText: { fontSize: 14, color: '#475569', lineHeight: 20 },

  // Hero
  hero: {
    backgroundColor: '#E8F2EC',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C9E0D2',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BAR_GREEN_DEEP,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroPointsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroPoints: { fontSize: 36, fontWeight: '800', color: BAR_GREEN_DEEP, letterSpacing: -1 },
  heroUnit: { fontSize: 13, fontWeight: '600', color: BAR_GREEN_DEEP },
  heroTagline: { fontSize: 12, color: BAR_GREEN_DEEP, marginTop: 6 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: { fontSize: 12, color: BAR_GREEN_DEEP, fontWeight: '600' },
  progressBold: { fontWeight: '800', color: BAR_GREEN },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: BAR_GREEN },

  // Section labels
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  // Trip
  tripCard: {
    backgroundColor: '#F7F8F7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EAECE9',
  },
  tripPlace: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  tripMeta: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 4, letterSpacing: 0.4 },

  // Platform row
  platformWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECE9',
    marginBottom: 10,
    overflow: 'hidden',
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  platformDot: { width: 28, height: 28, borderRadius: 14 },
  platformName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  starChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: STAR_GOLD,
  },
  starChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  tapToVerify: { fontSize: 12, fontWeight: '700', color: BAR_GREEN },

  // Verify card (inline)
  verifyCard: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#EAECE9',
    paddingTop: 12,
  },
  verifyDesc: { fontSize: 12, color: '#475569', marginBottom: 10, lineHeight: 18 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F7F8F7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECE9',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  screenshotPreview: {
    position: 'relative',
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  screenshotImg: { width: '100%', height: 160 },
  removeShot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 8 },
  btnSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAECE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnSecondaryText: { color: BAR_GREEN, fontWeight: '600', fontSize: 13 },
  btnPrimary: {
    flex: 1.4,
    height: 44,
    borderRadius: 10,
    backgroundColor: BAR_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 8 },

  // Bonus row
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4DD',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#F2D177',
  },
  bonusText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#9C6F1A' },
  bonusReward: { fontSize: 13, fontWeight: '800', color: '#9C6F1A' },

  // Hashtag pills
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#E8F2EC',
    borderWidth: 1,
    borderColor: '#C9E0D2',
  },
  pillMention: { backgroundColor: '#E8F4FE', borderColor: '#BFDFFA' },
  pillText: { fontSize: 13, fontWeight: '600', color: BAR_GREEN_DEEP },
  pillNote: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
