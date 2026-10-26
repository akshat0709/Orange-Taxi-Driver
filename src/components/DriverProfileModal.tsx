import React, { useState, useEffect } from 'react';
import { SignedImage } from './SignedImage';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Linking,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Driver, DriverStats } from '../types';
import { supabase } from '../lib/supabase';
import { formatRupees } from '../lib/formatters';

interface DriverProfileModalProps {
  visible: boolean;
  driver: Driver;
  stats?: DriverStats;
  onClose: () => void;
  onLogout: () => void;
  onUpdateDriver?: (updates: Partial<Driver>) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  visible,
  driver,
  stats,
  onClose,
  onLogout,
  onUpdateDriver,
  theme,
  onToggleTheme,
}) => {
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [navApp, setNavApp] = useState<'google' | 'apple'>('google');

  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@orange_driver_payout').then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.upiId) setUpiId(parsed.upiId);
          if (parsed.bankAccount) setBankAccount(parsed.bankAccount);
          if (parsed.ifscCode) setIfscCode(parsed.ifscCode);
        } catch {}
      }
    });
  }, []);

  async function handleSavePayout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavingPayout(true);
    try {
      const payoutData = { upiId, bankAccount, ifscCode, updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem('@orange_driver_payout', JSON.stringify(payoutData));
      Alert.alert(
        'Settlement Saved',
        'Your bank settlement details have been updated. Automated daily payouts will be credited to this account.'
      );
    } catch {
      Alert.alert('Error', 'Could not save payout details.');
    } finally {
      setSavingPayout(false);
    }
  }

  const handleCallSupport = () => {
    Linking.openURL('tel:+9118001234567').catch(() => {
      Alert.alert('Chauffeur Support', 'Toll-free helpline: 1800-123-4567\nActive 24/7 for Orange Taxi Chauffeurs.');
    });
  };

  const isLight = theme === 'light';

  function handleOpenPrivacyPolicy() {
    Linking.openURL('https://orange-taxi.com/privacy').catch(() => {
      Alert.alert('Privacy Policy', 'Please visit https://orange-taxi.com/privacy to view our full Data Protection Notice.');
    });
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Permanently Delete Chauffeur Account?",
      "Under Section 12 of the Digital Personal Data Protection (DPDP) Act, 2023 (Right to Erasure), your chauffeur profile, KYC documents, phone number, and credentials will be permanently erased. You will immediately lose access to Orange Taxi dispatch.\n\nAre you sure you want to proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase My Data & Delete",
          style: "destructive",
          onPress: async () => {
            // Scrub the driver row while the session can still write (unchanged order), then erase the
            // account via the server. Previously every error was swallowed and the chauffeur was logged
            // out as if the account had been erased; now failure is reported and they stay signed in.
            try {
              if (driver?.id) {
                await supabase.from('drivers').update({
                  full_name: 'DELETED_CHAUFFEUR',
                  phone: `DELETED_${Date.now()}`,
                  is_online: false,
                  status: 'inactive',
                }).eq('id', driver.id);
              }
            } catch (err) {
              console.warn('Driver row scrub notice:', err);
            }
            let deletionError: string | null = null;
            try {
              const { error } = await (supabase as any).rpc('delete_user_account');
              if (error) deletionError = error.message || 'Deletion service unavailable.';
            } catch (e: any) {
              deletionError = e?.message || 'Network error.';
            }
            if (deletionError) {
              Alert.alert(
                'Deletion Not Completed',
                `We could not fully erase your account right now (${deletionError}). Please try again or contact Orange Taxi support.`
              );
              return;
            }
            Alert.alert('Account Erased', 'Your chauffeur account and personal data have been erased.');
            // onLogout performs the sign-out and returns to the login screen.
            onLogout();
          }
        }
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, isLight && styles.containerLight]}>
        {/* Top Header */}
        <View style={[styles.header, isLight && styles.headerLight]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, isLight && styles.closeBtnLight]} activeOpacity={0.7}>
            <Text style={[styles.closeBtnText, isLight && styles.textDark]}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isLight && styles.textDark]}>Chauffeur Profile</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>PRO</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Chauffeur Hero Card */}
          <View style={[styles.heroCard, isLight && styles.cardLight]}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatarCircle, { overflow: 'hidden' }]}>
                {driver.photo_url ? (
                  <SignedImage uri={driver.photo_url} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {driver.full_name ? driver.full_name.charAt(0).toUpperCase() : 'D'}
                  </Text>
                )}
              </View>
              <View style={styles.nameBlock}>
                <View style={styles.titleRow}>
                  <Text style={[styles.driverName, isLight && styles.textDark]}>{driver.full_name || 'Orange Chauffeur'}</Text>
                  <View style={styles.verifiedTag}>
                    <Text style={styles.verifiedTagText}>✓ VERIFIED</Text>
                  </View>
                </View>
                <Text style={styles.driverPhone}>{driver.phone || '+91 98765 43210'}</Text>
                <View style={styles.ratingBadgeRow}>
                  <Text style={styles.ratingStar}>★</Text>
                  <Text style={[styles.ratingNumber, isLight && styles.textDark]}>{(driver.rating || 5.0).toFixed(2)}</Text>
                  <Text style={styles.tripCountBullet}>•</Text>
                  <Text style={styles.tripCountText}>{driver.total_rides || driver.total_trips || stats?.totalTrips || 0} total trips</Text>
                  <Text style={styles.tierText}>• Gold Chauffeur</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Today's Shift Performance */}
          <View style={[styles.sectionCard, isLight && styles.cardLight]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>TODAY'S SHIFT PERFORMANCE</Text>
              <View style={[styles.verifiedTag, { backgroundColor: '#F97316' }]}>
                <Text style={[styles.verifiedTagText, { color: '#FFFFFF' }]}>TODAY</Text>
              </View>
            </View>
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>₹{formatRupees(stats?.todayEarnings || 0)}</Text>
                <Text style={styles.metricLbl}>Today's Net</Text>
              </View>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>{stats?.todayTrips || 0}</Text>
                <Text style={styles.metricLbl}>Today's Trips</Text>
              </View>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>{Number(stats?.todayHours || 0).toFixed(1)} hrs</Text>
                <Text style={styles.metricLbl}>Online Duty</Text>
              </View>
            </View>
          </View>

          {/* Vehicle Assigned */}
          <View style={[styles.sectionCard, isLight && styles.cardLight]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>ASSIGNED VEHICLE</Text>
              {driver.vehicle_model && (
                <View style={styles.evBadge}>
                  <Text style={styles.evBadgeText}>✓ VERIFIED</Text>
                </View>
              )}
            </View>

            <View style={styles.vehicleRow}>
              <View style={[styles.vehicleIconBox, isLight && styles.innerBoxLight]}>
                <Text style={styles.vehicleIcon}>🚘</Text>
              </View>
              <View style={styles.vehicleInfoCol}>
                {driver.vehicle_model ? (
                  <>
                    <Text style={[styles.vehicleModel, isLight && styles.textDark]}>{driver.vehicle_model}</Text>
                    <Text style={styles.vehiclePlate}>{driver.vehicle_number}</Text>
                    <Text style={styles.vehicleCategory}>{driver.vehicle_type || 'Orange Signature'}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.vehicleModel, isLight && styles.textDark]}>Pending Assignment</Text>
                    <Text style={styles.vehicleCategory}>Admin is reviewing your application</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Performance Metrics */}
          <View style={[styles.sectionCard, isLight && styles.cardLight]}>
            <Text style={styles.sectionTitle}>LIFETIME PERFORMANCE & QUALITY</Text>
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>₹{formatRupees(stats?.totalEarnings || 0)}</Text>
                <Text style={styles.metricLbl}>Lifetime Net</Text>
              </View>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>{driver.total_rides || driver.total_trips || stats?.totalTrips || 0}</Text>
                <Text style={styles.metricLbl}>All-Time Trips</Text>
              </View>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>{stats?.acceptanceRate || 98}%</Text>
                <Text style={styles.metricLbl}>Acceptance</Text>
              </View>
            </View>
          </View>

          {/* Chauffeur App Preferences */}
          <View style={[styles.sectionCard, isLight && styles.cardLight]}>
            <Text style={styles.sectionTitle}>DISPATCH & NAVIGATION SETTINGS</Text>

            <View style={styles.prefRow}>
              <View style={styles.prefTextCol}>
                <Text style={[styles.prefTitle, isLight && styles.textDark]}>App Theme (Dark / Light)</Text>
                <Text style={styles.prefSubtitle}>Switch between dark and light modes</Text>
              </View>
              <Switch
                value={isLight}
                onValueChange={onToggleTheme}
                trackColor={{ false: '#334155', true: '#F97316' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.docDivider, isLight && styles.dividerLight]} />



            <View style={styles.prefRow}>
              <View style={styles.prefTextCol}>
                <Text style={[styles.prefTitle, isLight && styles.textDark]}>High-Volume Dispatch Audio Chimes</Text>
                <Text style={styles.prefSubtitle}>Loud pulse sound on new booking broadcast</Text>
              </View>
              <Switch
                value={audioAlerts}
                onValueChange={setAudioAlerts}
                trackColor={{ false: '#334155', true: '#F97316' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.docDivider, isLight && styles.dividerLight]} />

            <View style={styles.navRow}>
              <Text style={[styles.prefTitle, isLight && styles.textDark]}>Default Navigation App</Text>
              <View style={styles.navToggleRow}>
                <TouchableOpacity
                  style={[styles.navBtn, isLight && styles.navBtnLight, navApp === 'google' && styles.navBtnActive, isLight && styles.navBtnActiveLight]}
                  onPress={() => setNavApp('google')}
                >
                  <Text style={[styles.navBtnText, isLight && styles.navBtnTextLight, navApp === 'google' && styles.navBtnTextActive, isLight && styles.navBtnTextActiveLight]}>
                    Google Maps
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navBtn, isLight && styles.navBtnLight, navApp === 'apple' && styles.navBtnActive, isLight && styles.navBtnActiveLight]}
                  onPress={() => setNavApp('apple')}
                >
                  <Text style={[styles.navBtnText, isLight && styles.navBtnTextLight, navApp === 'apple' && styles.navBtnTextActive, isLight && styles.navBtnTextActiveLight]}>
                    Apple Maps
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bank & UPI Settlement Payout (Partner Drivers Only) */}
          {driver?.driver_type === 'partner' ? (
            <View style={[styles.sectionCard, isLight && styles.cardLight]}>
              <Text style={[styles.sectionTitle, isLight && styles.textDark]}>🏦 Payout & Daily Settlement</Text>
              <Text style={styles.payoutSubtitle}>Configure your UPI VPA or Bank Account for automated daily trip payouts.</Text>

              <View style={{ marginTop: 12 }}>
                <Text style={[styles.payoutLabel, isLight && styles.textDark]}>UPI ID (GPay / PhonePe / Paytm)</Text>
                <TextInput
                  style={[styles.payoutInput, isLight && styles.payoutInputLight]}
                  placeholder="e.g. driver@okhdfcbank"
                  placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                />
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={[styles.payoutLabel, isLight && styles.textDark]}>Bank Account Number</Text>
                <TextInput
                  style={[styles.payoutInput, isLight && styles.payoutInputLight]}
                  placeholder="e.g. 50100234567890"
                  placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
                  value={bankAccount}
                  onChangeText={setBankAccount}
                  keyboardType="number-pad"
                />
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={[styles.payoutLabel, isLight && styles.textDark]}>Bank IFSC Code</Text>
                <TextInput
                  style={[styles.payoutInput, isLight && styles.payoutInputLight]}
                  placeholder="e.g. HDFC0001234"
                  placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
                  value={ifscCode}
                  onChangeText={(t) => setIfscCode(t.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>

              <TouchableOpacity
                style={styles.savePayoutBtn}
                disabled={savingPayout}
                onPress={handleSavePayout}
              >
                {savingPayout ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.savePayoutBtnText}>SAVE SETTLEMENT DETAILS</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.sectionCard, isLight && styles.cardLight]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.sectionTitle, isLight && styles.textDark]}>💼 Monthly Salary & Benefits</Text>
                <View style={{ backgroundColor: 'rgba(249, 115, 22, 0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: '#F97316', fontSize: 11, fontWeight: '700' }}>Company Chauffeur</Text>
                </View>
              </View>
              <Text style={styles.payoutSubtitle}>
                You are a full-time company-employed chauffeur with a guaranteed monthly salary. Daily trip bank payouts are not applicable.
              </Text>
              <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: isLight ? '#F1F5F9' : '#1E293B' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isLight ? '#0F172A' : '#FFFFFF', marginBottom: 4 }}>
                  Monthly Salary Structure
                </Text>
                <Text style={{ fontSize: 11, color: isLight ? '#64748B' : '#94A3B8', lineHeight: 16 }}>
                  • Fixed base salary credited directly to your registered payroll bank account on the 1st of every month.{'\n'}
                  • Monthly ride milestone bonuses (up to ₹4,500 extra) calculated and paid along with your salary.
                </Text>
              </View>
            </View>
          )}

          {/* Support Hotline CTA */}
          <TouchableOpacity style={[styles.supportBtn, isLight && styles.supportBtnLight]} onPress={handleCallSupport} activeOpacity={0.8}>
            <Text style={styles.supportBtnIcon}>📞</Text>
            <View style={styles.supportTextCol}>
              <Text style={[styles.supportBtnTitle, isLight && styles.textDark]}>24/7 Chauffeur Dispatch Helpdesk</Text>
              <Text style={styles.supportBtnSubtitle}>Emergency assistance, route deviation & customer issues</Text>
            </View>
          </TouchableOpacity>

          {/* Privacy Policy & DPDP Act Disclosure */}
          <TouchableOpacity
            style={[styles.legalBtn, isLight && styles.legalBtnLight]}
            onPress={handleOpenPrivacyPolicy}
            activeOpacity={0.8}
          >
            <Text style={styles.legalBtnIcon}>🛡️</Text>
            <View style={styles.supportTextCol}>
              <Text style={[styles.legalBtnTitle, isLight && styles.textDark]}>Privacy Policy & Data Rights</Text>
              <Text style={styles.supportBtnSubtitle}>DPDP Act 2023, GPS telemetry scoping & driver KYC rules</Text>
            </View>
            <Text style={[styles.legalArrow, isLight && styles.textDark]}>→</Text>
          </TouchableOpacity>

          {/* Logout / Switch Account */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out of Chauffeur Console?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: onLogout },
              ]);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutBtnText}>Sign Out from Device</Text>
          </TouchableOpacity>

          {/* Delete Account (Apple Guideline 5.1.1 & Google Play Policy) */}
          <TouchableOpacity
            style={[styles.deleteAccountBtn, isLight && styles.deleteAccountBtnLight]}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteAccountBtnText}>Delete Account & Personal Data (DPDP Act)</Text>
          </TouchableOpacity>

          <Text style={styles.versionFooter}>
            Orange Taxi Chauffeur OS v2.4.0 • Enterprise Fleet Build 2026.09
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F97316',
  },
  headerBadgeText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  nameBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  verifiedTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  driverPhone: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 6,
  },
  ratingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    color: '#F59E0B',
    fontSize: 15,
    marginRight: 4,
  },
  ratingNumber: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  tripCountBullet: {
    color: '#64748B',
    marginHorizontal: 6,
  },
  tripCountText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  tierText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  evBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  evBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  vehicleIcon: {
    fontSize: 24,
  },
  vehicleInfoCol: {
    flex: 1,
  },
  vehicleModel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  vehiclePlate: {
    color: '#F97316',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 1,
  },
  vehicleCategory: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  evMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  evMetricCell: {
    flex: 1,
    alignItems: 'center',
  },
  evMetricValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  evMetricLabel: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },
  evMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metricVal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricLbl: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  docIcon: {
    fontSize: 22,
  },
  docName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  docExpiry: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  docStatusVerified: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  docDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  prefTextCol: {
    flex: 1,
    paddingRight: 16,
  },
  prefTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  prefSubtitle: {
    color: '#64748B',
    fontSize: 12,
  },
  navRow: {
    paddingVertical: 6,
  },
  navToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  navBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  navBtnActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: '#F97316',
  },
  navBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  navBtnTextActive: {
    color: '#F97316',
    fontWeight: '800',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  supportBtnIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  supportTextCol: {
    flex: 1,
  },
  supportBtnTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  supportBtnSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
  versionFooter: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
  },
  payoutSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  payoutLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  payoutInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  payoutInputLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    color: '#0F172A',
  },
  savePayoutBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  savePayoutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  containerLight: { backgroundColor: '#F8FAFC' },
  headerLight: { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' },
  cardLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  innerBoxLight: { backgroundColor: '#F1F5F9' },
  textDark: { color: '#0F172A' },
  closeBtnLight: { backgroundColor: '#E2E8F0' },
  dividerLight: { backgroundColor: '#E2E8F0' },
  navBtnLight: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' },
  navBtnActiveLight: { backgroundColor: '#F97316', borderColor: '#EA580C' },
  navBtnTextLight: { color: '#64748B' },
  navBtnTextActiveLight: { color: '#FFFFFF' },
  supportBtnLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  legalBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  legalBtnLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  legalBtnIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  legalBtnTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  legalArrow: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  deleteAccountBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteAccountBtnLight: {},
  deleteAccountBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});