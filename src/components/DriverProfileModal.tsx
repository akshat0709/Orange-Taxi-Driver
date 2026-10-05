import React, { useState } from 'react';
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
} from 'react-native';
import { Driver } from '../types';

interface DriverProfileModalProps {
  visible: boolean;
  driver: Driver;
  onClose: () => void;
  onLogout: () => void;
  onUpdateDriver?: (updates: Partial<Driver>) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  visible,
  driver,
  onClose,
  onLogout,
  onUpdateDriver,
  theme,
  onToggleTheme,
}) => {
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [navApp, setNavApp] = useState<'google' | 'apple'>('google');

  const handleCallSupport = () => {
    Linking.openURL('tel:+9118001234567').catch(() => {
      Alert.alert('Chauffeur Support', 'Toll-free helpline: 1800-123-4567\nActive 24/7 for Orange Taxi Chauffeurs.');
    
  navBtnLight: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' },
  navBtnActiveLight: { backgroundColor: '#F97316', borderColor: '#EA580C' },
  navBtnTextLight: { color: '#64748B' },
  navBtnTextActiveLight: { color: '#FFFFFF' },
  supportBtnLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
});
  };

  const isLight = theme === 'light';

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
                  <Image source={{ uri: driver.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
                  <Text style={[styles.ratingNumber, isLight && styles.textDark]}>{(driver.rating || 4.92).toFixed(2)}</Text>
                  <Text style={styles.tripCountBullet}>•</Text>
                  <Text style={styles.tripCountText}>{driver.total_trips || 1248} trips</Text>
                  <Text style={styles.tierText}>• Gold Chauffeur</Text>
                </View>
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
                    <Text style={styles.vehicleCategory}>{driver.vehicle_type || 'Standard Cab'}</Text>
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
            <Text style={styles.sectionTitle}>PERFORMANCE & QUALITY SCORE</Text>
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>97.4%</Text>
                <Text style={styles.metricLbl}>Acceptance Rate</Text>
              </View>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>0.8%</Text>
                <Text style={styles.metricLbl}>Cancellation</Text>
              </View>
              <View style={[styles.metricCard, isLight && styles.innerBoxLight]}>
                <Text style={[styles.metricVal, isLight && styles.textDark]}>99.1%</Text>
                <Text style={styles.metricLbl}>On-Time Arrival</Text>
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

          {/* Support Hotline CTA */}
          <TouchableOpacity style={[styles.supportBtn, isLight && styles.supportBtnLight]} onPress={handleCallSupport} activeOpacity={0.8}>
            <Text style={styles.supportBtnIcon}>📞</Text>
            <View style={styles.supportTextCol}>
              <Text style={[styles.supportBtnTitle, isLight && styles.textDark]}>24/7 Chauffeur Dispatch Helpdesk</Text>
              <Text style={styles.supportBtnSubtitle}>Emergency assistance, route deviation & customer issues</Text>
            </View>
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
});
