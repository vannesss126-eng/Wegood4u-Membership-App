import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Store, Ticket, Check, Eye, EyeOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/lib/supabase';
import { fetchPartnerStores } from '@/data/partnerStore';

type Kind = 'vendors' | 'event';
type StoreOpt = { id: string; name: string; city: string };

// Same password rules as the register screen — labels MUST match validatePassword's
// output so the live ✓/✗ checklist can cross-check met/unmet.
const PASSWORD_RULES_ORDER = [
  'At least 6 characters',
  'One lowercase letter',
  'One uppercase letter',
  'One number',
  'One special character',
];

function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 6) errors.push('At least 6 characters');
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/\d/.test(password)) errors.push('One number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('One special character');
  return errors;
}

export default function CreatePartnerScreen() {
  const { userData } = useUser();
  const isAdmin = userData?.role === 'admin';

  const [kind, setKind] = useState<Kind>('event');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setPasswordErrors(validatePassword(text));
  };

  // Event
  const [code, setCode] = useState('');

  // Vendors — one account can own MANY branches, so stores are multi-select.
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [storeQuery, setStoreQuery] = useState('');
  const [fee, setFee] = useState('3.00');
  const [loadingStores, setLoadingStores] = useState(false);

  const toggleStore = (id: string) =>
    setStoreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userData && !isAdmin) router.replace('/(tabs)/profile');
  }, [userData, isAdmin]);

  // Lazy-load partner stores the first time Vendors is selected.
  useEffect(() => {
    if (kind !== 'vendors' || stores.length > 0) return;
    setLoadingStores(true);
    fetchPartnerStores()
      .then((rows) =>
        setStores(rows.map((s: any) => ({ id: s.id, name: s.name, city: s.city })))
      )
      .catch(() => Alert.alert('Error', 'Could not load partner stores.'))
      .finally(() => setLoadingStores(false));
  }, [kind, stores.length]);

  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    );
  }, [stores, storeQuery]);

  async function handleCreate() {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Email and password are required.');
      return;
    }
    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0) {
      Alert.alert('Invalid password', `Password still needs:\n• ${pwErrors.join('\n• ')}`);
      return;
    }
    if (kind === 'event' && !code.trim()) {
      Alert.alert('Missing info', 'Enter the event referral code.');
      return;
    }
    if (kind === 'vendors' && storeIds.length === 0) {
      Alert.alert('Missing info', 'Pick at least one store for this vendor.');
      return;
    }

    setSubmitting(true);
    try {
      // 1) Create the login + role + optional code via the admin-gated Edge
      //    Function (service_role runs server-side; email is auto-confirmed).
      const { data: fnData, error: fnErr } = await supabase.functions.invoke(
        'admin-create-partner',
        {
          body: {
            email: email.trim(),
            password,
            username: displayName.trim(),
            role: kind, // 'vendors' | 'event'
            referralCode: kind === 'event' ? code.trim() : undefined,
          },
        }
      );
      if (fnErr) throw new Error(fnErr.message);
      const res = fnData as any;
      if (res?.error) throw new Error(res.error);
      const newUserId = res?.user_id as string | undefined;
      if (!newUserId) throw new Error('No user id returned from the server.');

      // 2) Vendors: link EACH selected branch (admin RLS). One account, many stores.
      if (kind === 'vendors') {
        for (const sid of storeIds) {
          const { error: settingsErr } = await supabase
            .from('partner_store_settings')
            .upsert(
              { partner_store_id: sid, per_visit_fee: Number(fee) || 0, active: true },
              { onConflict: 'partner_store_id' }
            );
          if (settingsErr) throw new Error(`Store settings failed (${sid}): ${settingsErr.message}`);

          const { error: paErr } = await supabase
            .from('partner_accounts')
            .upsert(
              { user_id: newUserId, partner_store_id: sid, role: 'owner' },
              { onConflict: 'user_id,partner_store_id' }
            );
          if (paErr) throw new Error(`Partner link failed (${sid}): ${paErr.message}`);
        }
      }

      Alert.alert(
        'Partner account created',
        `${email.trim()} is now a ${kind === 'event' ? 'event' : 'vendor'} partner (login confirmed).` +
          (kind === 'event' ? `\nReferral code: ${code.trim()}` : '') +
          (kind === 'vendors'
            ? `\nLinked to ${storeIds.length} branch${storeIds.length === 1 ? '' : 'es'}.`
            : ''),
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Could not create account', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Partner Account</Text>
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
        <Text style={styles.headerTitle}>Create Partner Account</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Account type */}
          <Text style={styles.label}>Account type</Text>
          <View style={styles.toggleRow}>
            {(['vendors', 'event'] as Kind[]).map((k) => {
              const active = kind === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.toggle, active && styles.toggleActive]}
                  onPress={() => setKind(k)}
                  activeOpacity={0.8}
                >
                  {k === 'vendors' ? (
                    <Store size={16} color={active ? '#16513F' : '#64748b'} />
                  ) : (
                    <Ticket size={16} color={active ? '#16513F' : '#64748b'} />
                  )}
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                    {k === 'vendors' ? 'Vendor (store)' : 'Event'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Common fields */}
          <Text style={styles.label}>Partner email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="partner@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={handlePasswordChange}
              placeholder="Set a password"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeIcon}>
              {showPassword ? (
                <EyeOff size={20} color="#94a3b8" />
              ) : (
                <Eye size={20} color="#94a3b8" />
              )}
            </TouchableOpacity>
          </View>
          {password.length > 0 && (
            <View style={styles.passwordRequirements}>
              {PASSWORD_RULES_ORDER.map((rule) => {
                const met = !passwordErrors.includes(rule);
                return (
                  <View key={rule} style={styles.passwordRequirementRow}>
                    <Text
                      style={[styles.passwordRequirementMark, met ? styles.reqMet : styles.reqUnmet]}
                    >
                      {met ? '✓' : '✗'}
                    </Text>
                    <Text
                      style={[
                        styles.passwordRequirementText,
                        met ? styles.reqMetText : styles.reqUnmetText,
                      ]}
                    >
                      {rule}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={styles.hint}>
            The partner can keep this password or change it anytime after signing in.
          </Text>

          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={kind === 'event' ? 'e.g. Amazing Thailand' : 'e.g. store owner name'}
          />

          {kind === 'event' ? (
            <>
              <Text style={styles.label}>Referral code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="e.g. MIRACLETH01"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hint}>
                Case-sensitive — entered/displayed exactly as typed. Must be unique.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>
                Partner branches{storeIds.length > 0 ? ` · ${storeIds.length} selected` : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={storeQuery}
                onChangeText={setStoreQuery}
                placeholder="Search store or city…"
                autoCorrect={false}
              />
              <View style={styles.storeList}>
                {loadingStores ? (
                  <ActivityIndicator color="#16513F" style={{ padding: 16 }} />
                ) : (
                  filteredStores.slice(0, 30).map((s) => {
                    const selected = storeIds.includes(s.id);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.storeRow, selected && styles.storeRowSelected]}
                        onPress={() => toggleStore(s.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.storeName}>{s.name}</Text>
                          <Text style={styles.storeCity}>{s.city}</Text>
                        </View>
                        {selected && <Check size={18} color="#16513F" />}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
              <Text style={styles.hint}>
                Tap to select one or more branches — this one account can access them all.
              </Text>

              <Text style={styles.label}>Per-visit fee (RM)</Text>
              <TextInput
                style={styles.input}
                value={fee}
                onChangeText={setFee}
                placeholder="3.00"
                keyboardType="decimal-pad"
              />
              <Text style={styles.hint}>Applied to every selected branch.</Text>
            </>
          )}

          <TouchableOpacity
            style={[styles.submit, submitting && styles.submitDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitText}>Create Partner Account</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 18,
    marginBottom: 8,
  },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  toggleActive: { borderColor: '#16513F', backgroundColor: '#ecfdf5' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  toggleTextActive: { color: '#16513F' },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  eyeIcon: { position: 'absolute', right: 12, padding: 4 },
  passwordRequirements: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  passwordRequirementRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  passwordRequirementMark: { width: 16, fontSize: 13, fontWeight: '700', marginRight: 8 },
  passwordRequirementText: { fontSize: 12 },
  reqMet: { color: '#16A34A' },
  reqUnmet: { color: '#9CA3AF' },
  reqMetText: { color: '#15803D' },
  reqUnmetText: { color: '#6B7280' },
  storeList: {
    marginTop: 8,
    maxHeight: 240,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  storeRowSelected: { backgroundColor: '#ecfdf5' },
  storeName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  storeCity: { fontSize: 12, color: '#64748b', marginTop: 2 },
  submit: {
    marginTop: 28,
    backgroundColor: '#16513F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
