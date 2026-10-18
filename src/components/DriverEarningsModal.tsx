import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  X,
  TrendingUp,
  IndianRupee,
  Banknote,
  CreditCard,
  Clock,
  Calendar,
  Award,
  Check,
  Zap,
  ShieldCheck,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Booking, Driver } from '../types';
import { formatRupees, round2 } from '../lib/formatters';

interface DriverEarningsModalProps {
  visible: boolean;
  onClose: () => void;
  driverId: string;
  driver?: Driver | null;
  theme?: 'light' | 'dark';
}

export function DriverEarningsModal({
  visible,
  onClose,
  driverId,
  driver,
  theme = 'dark',
}: DriverEarningsModalProps) {
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24)) + 12;

  const [completedTrips, setCompletedTrips] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if driver is company employed or partner driver
  const isCompanyDriver = driver?.driver_type !== 'partner';

  useEffect(() => {
    if (visible && driverId) {
      fetchTrips();
    }
  }, [visible, driverId]);

  async function fetchTrips() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(500);

      if (data) {
        setCompletedTrips(data as Booking[]);
      }
    } catch (e) {
      console.error('Failed to load trips:', e);
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const currentMonthName = now.toLocaleString('en-IN', { month: 'long' });
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  // Today's trips
  const todayTrips = completedTrips.filter((t) => {
    const timeStr = t.completed_at || t.created_at;
    if (!timeStr) return false;
    return new Date(timeStr) >= startOfToday;
  });

  // Current calendar month's trips
  const monthlyTrips = completedTrips.filter((t) => {
    const timeStr = t.completed_at || t.created_at;
    if (!timeStr) return false;
    return new Date(timeStr) >= startOfMonth;
  });

  const monthlyCompletedRides = monthlyTrips.length;

  // Monthly Milestone Calculation for Company Drivers:
  // 150 rides a month: 1000 extra
  // 200 rides a month: 1500 more (cumulative 2,500)
  // 250 rides a month: 2000 more (cumulative 4,500)
  let monthlyBonusEarned = 0;
  if (monthlyCompletedRides >= 250) {
    monthlyBonusEarned = 1000 + 1500 + 2000;
  } else if (monthlyCompletedRides >= 200) {
    monthlyBonusEarned = 1000 + 1500;
  } else if (monthlyCompletedRides >= 150) {
    monthlyBonusEarned = 1000;
  }

  let nextMilestoneRides = 150;
  let nextMilestoneReward = 1000;
  if (monthlyCompletedRides >= 250) {
    nextMilestoneRides = 250;
    nextMilestoneReward = 0;
  } else if (monthlyCompletedRides >= 200) {
    nextMilestoneRides = 250;
    nextMilestoneReward = 2000;
  } else if (monthlyCompletedRides >= 150) {
    nextMilestoneRides = 200;
    nextMilestoneReward = 1500;
  }

  const ridesToNext = Math.max(0, nextMilestoneRides - monthlyCompletedRides);
  const milestoneProgress = Math.min(100, Math.max(0, (monthlyCompletedRides / 250) * 100));

  // Partner Driver Fares
  const todayRaw = todayTrips.reduce(
    (acc, t) => acc + (Number(t.final_fare) || Number(t.estimated_fare) || 0),
    0
  );
  const todayEarnings = round2(todayRaw * 0.85);

  const allRawTotal = completedTrips.reduce(
    (acc, t) => acc + (Number(t.final_fare) || Number(t.estimated_fare) || 0),
    0
  );
  const allTimeEarnings = round2(allRawTotal * 0.85);

  const cashToday = round2(
    todayTrips
      .filter((t) => t.payment_method === 'cash')
      .reduce((acc, t) => acc + (Number(t.final_fare) || Number(t.estimated_fare) || 0), 0)
  );

  const digitalToday = round2(Math.max(0, todayEarnings - cashToday));

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: safeTop }, isDark && styles.headerDark]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={[styles.earningsIconWrap, isCompanyDriver && { backgroundColor: '#F97316' }]}>
              {isCompanyDriver ? <Award size={20} color="#FFFFFF" /> : <TrendingUp size={20} color="#FFFFFF" />}
            </View>
            <View>
              <Text style={[styles.headerTitle, isDark && styles.textWhite]}>
                {isCompanyDriver ? 'Salary & Ride Milestones' : 'Chauffeur Earnings'}
              </Text>
              <Text style={styles.headerSub}>
                {isCompanyDriver ? 'Company Employed Chauffeur • Fixed Salary' : 'Transparent Daily Payout Ledger'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.closeBtn, isDark && styles.closeBtnDark]} onPress={onClose}>
            <X size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        <View style={styles.metricsWrapper}>
          {isCompanyDriver ? (
            /* ================= COMPANY OWNED DRIVER VIEW ================= */
            <View style={[styles.companyCard, isDark && styles.companyCardDark]}>
              {/* Monthly Milestone Header */}
              <View style={styles.companyHeaderRow}>
                <View>
                  <Text style={styles.companyMonthTag}>{currentMonthName.toUpperCase()} SALARY BONUS</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                    <IndianRupee size={28} color="#FFFFFF" />
                    <Text style={styles.companyBonusAmount}>{formatRupees(monthlyBonusEarned)}</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>Extra on Salary</Text>
                  </View>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>
                    {monthlyCompletedRides >= 250
                      ? '🏆 Max Milestone'
                      : monthlyCompletedRides >= 200
                      ? '🥈 Tier 2 Reached'
                      : monthlyCompletedRides >= 150
                      ? '🥉 Tier 1 Reached'
                      : '🎯 Target 150'}
                  </Text>
                </View>
              </View>

              {/* Rides Completed Callout */}
              <View style={styles.ridesCountRow}>
                <Text style={styles.ridesCountBig}>{monthlyCompletedRides}</Text>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                    Rides Completed in {currentMonthName}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 }}>
                    {monthlyCompletedRides >= 250
                      ? 'Congratulations! You unlocked all milestones (₹4,500 total bonus).'
                      : `${ridesToNext} more rides needed to unlock +₹${formatRupees(nextMilestoneReward)} bonus.`}
                  </Text>
                </View>
              </View>

              {/* ================= PROGRESS BAR WITH MILESTONE X-AXIS ================= */}
              <View style={styles.barSection}>
                {/* Visual Bar Track */}
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${milestoneProgress}%` }]} />
                </View>

                {/* Milestone Marker Pins along the bar */}
                {/* 150 rides = 60% of 250 */}
                <View style={[styles.pinWrapper, { left: '60%' }]}>
                  <View style={[styles.pinCircle, monthlyCompletedRides >= 150 && styles.pinCircleActive]}>
                    {monthlyCompletedRides >= 150 ? (
                      <Check size={8} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <View style={styles.pinInnerDot} />
                    )}
                  </View>
                </View>

                {/* 200 rides = 80% of 250 */}
                <View style={[styles.pinWrapper, { left: '80%' }]}>
                  <View style={[styles.pinCircle, monthlyCompletedRides >= 200 && styles.pinCircleActive]}>
                    {monthlyCompletedRides >= 200 ? (
                      <Check size={8} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <View style={styles.pinInnerDot} />
                    )}
                  </View>
                </View>

                {/* 250 rides = 100% of 250 */}
                <View style={[styles.pinWrapper, { left: '98%' }]}>
                  <View style={[styles.pinCircle, monthlyCompletedRides >= 250 && styles.pinCircleActive]}>
                    {monthlyCompletedRides >= 250 ? (
                      <Check size={8} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <View style={styles.pinInnerDot} />
                    )}
                  </View>
                </View>
              </View>

              {/* X-AXIS LABELS */}
              <View style={styles.xAxisRow}>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={styles.xAxisLabel}>0</Text>
                  <Text style={styles.xAxisSub}>Base</Text>
                </View>

                <View style={{ position: 'absolute', left: '60%', transform: [{ translateX: -24 }], alignItems: 'center' }}>
                  <Text style={[styles.xAxisLabel, monthlyCompletedRides >= 150 && styles.xAxisActive]}>
                    150 Rides
                  </Text>
                  <Text style={[styles.xAxisSub, monthlyCompletedRides >= 150 && styles.xAxisBonusActive]}>
                    +₹1,000
                  </Text>
                </View>

                <View style={{ position: 'absolute', left: '80%', transform: [{ translateX: -24 }], alignItems: 'center' }}>
                  <Text style={[styles.xAxisLabel, monthlyCompletedRides >= 200 && styles.xAxisActive]}>
                    200 Rides
                  </Text>
                  <Text style={[styles.xAxisSub, monthlyCompletedRides >= 200 && styles.xAxisBonusActive]}>
                    +₹1.5k
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.xAxisLabel, monthlyCompletedRides >= 250 && styles.xAxisActive]}>
                    250 Rides
                  </Text>
                  <Text style={[styles.xAxisSub, monthlyCompletedRides >= 250 && styles.xAxisBonusActive]}>
                    +₹2k
                  </Text>
                </View>
              </View>

              {/* No Bank Payout Notice */}
              <View style={styles.companyNotice}>
                <Text style={styles.companyNoticeText}>
                  ℹ️ Company Driver Policy: No daily bank payout. Your fixed monthly salary and ₹{formatRupees(monthlyBonusEarned)} milestone bonus will be credited directly to your payroll account on the 1st of next month.
                </Text>
              </View>
            </View>
          ) : (
            /* ================= PARTNER DRIVER VIEW ================= */
            <View>
              <View style={[styles.mainCard, isDark && styles.mainCardDark]}>
                <Text style={styles.mainCardLabel}>Today's Net Earnings</Text>
                <View style={styles.mainCardAmountRow}>
                  <IndianRupee size={28} color="#FFFFFF" />
                  <Text style={styles.mainCardAmount}>{formatRupees(todayEarnings)}</Text>
                </View>
                <Text style={styles.mainCardSub}>
                  {todayTrips.length} Completed Trips Today • ₹{formatRupees(allTimeEarnings)} Lifetime Total ({completedTrips.length} trips)
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <View style={[styles.breakdownItem, isDark && styles.breakdownItemDark]}>
                  <View style={styles.breakdownIconWrap}>
                    <Banknote size={15} color="#F97316" />
                  </View>
                  <View>
                    <Text style={styles.breakdownLabel}>Today's Cash</Text>
                    <Text style={[styles.breakdownValue, isDark && styles.textWhite]}>
                      ₹{formatRupees(cashToday)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.breakdownItem, isDark && styles.breakdownItemDark]}>
                  <View style={styles.breakdownIconWrap}>
                    <CreditCard size={15} color="#10B981" />
                  </View>
                  <View>
                    <Text style={styles.breakdownLabel}>Today's Bank Payout</Text>
                    <Text style={[styles.breakdownValue, isDark && styles.textWhite]}>
                      ₹{formatRupees(digitalToday)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Today's Cash Holding / Trips Summary */}
          {isCompanyDriver && (
            <View style={styles.breakdownRow}>
              <View style={[styles.breakdownItem, isDark && styles.breakdownItemDark]}>
                <View style={styles.breakdownIconWrap}>
                  <Car size={15} color="#F97316" />
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>Today's Trips</Text>
                  <Text style={[styles.breakdownValue, isDark && styles.textWhite]}>
                    {todayTrips.length} Rides
                  </Text>
                </View>
              </View>

              <View style={[styles.breakdownItem, isDark && styles.breakdownItemDark]}>
                <View style={styles.breakdownIconWrap}>
                  <Banknote size={15} color="#EAB308" />
                </View>
                <View>
                  <Text style={styles.breakdownLabel}>Cash Collected Today</Text>
                  <Text style={[styles.breakdownValue, isDark && styles.textWhite]}>
                    ₹{formatRupees(cashToday)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Trips History Ledger */}
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <Text style={[styles.ledgerTitle, isDark && styles.textWhite]}>COMPLETED TRIPS LEDGER</Text>

          {loading ? (
            <ActivityIndicator size="small" color="#F97316" style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={completedTrips}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, isDark && styles.textMutedDark]}>
                    No completed trips yet. Go online to begin taking trips!
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.tripRow, isDark && styles.tripRowDark]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tripRoute, isDark && styles.textWhite]} numberOfLines={1}>
                      {item.pickup_area} → {item.drop_area}
                    </Text>
                    <Text style={styles.tripMeta}>
                      {item.completed_at
                        ? new Date(item.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : 'Today'} · {Number(item.distance_km || 0).toFixed(1)} km · {item.payment_method === 'cash' ? '💵 Cash' : '💳 Digital'}
                    </Text>
                  </View>
                  <Text style={styles.tripFare}>
                    +₹{formatRupees(item.final_fare || item.estimated_fare)}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// Helper icon
function Car({ size, color }: { size: number; color: string }) {
  return <TrendingUp size={size} color={color} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  containerDark: { backgroundColor: '#0B0F19' },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDark: { backgroundColor: '#111827', borderBottomColor: '#1F2937' },
  earningsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDark: { backgroundColor: '#1F2937' },
  metricsWrapper: { padding: 16 },

  // Company Driver Card
  companyCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  companyCardDark: { backgroundColor: '#1E293B' },
  companyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  companyMonthTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F97316',
    letterSpacing: 0.8,
  },
  companyBonusAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statusPill: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  statusPillText: {
    color: '#F97316',
    fontSize: 11,
    fontWeight: '700',
  },
  ridesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  ridesCountBig: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F97316',
  },

  // Milestone Progress Bar & X-Axis
  barSection: {
    marginTop: 20,
    marginBottom: 6,
    position: 'relative',
    height: 20,
    justifyContent: 'center',
  },
  barTrack: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#F97316',
    borderRadius: 5,
  },
  pinWrapper: {
    position: 'absolute',
    top: 2,
    transform: [{ translateX: -8 }],
  },
  pinCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircleActive: {
    backgroundColor: '#10B981',
    borderColor: '#FFFFFF',
  },
  pinInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
    position: 'relative',
    height: 36,
  },
  xAxisLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  xAxisActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  xAxisSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
    fontWeight: '600',
  },
  xAxisBonusActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  companyNotice: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  companyNoticeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },

  // Partner Cards
  mainCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  mainCardDark: { backgroundColor: '#1E293B' },
  mainCardLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  mainCardAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  mainCardAmount: { fontSize: 34, fontWeight: '900', color: '#FFFFFF' },
  mainCardSub: { fontSize: 12, color: '#10B981', fontWeight: '700', marginTop: 8 },
  breakdownRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  breakdownItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breakdownItemDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  breakdownIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownLabel: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  breakdownValue: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  ledgerTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: '#0F172A', marginBottom: 12 },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tripRowDark: { backgroundColor: '#1E293B', borderColor: '#334155' },
  tripRoute: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  tripMeta: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  tripFare: { fontSize: 15, fontWeight: '900', color: '#10B981' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  textWhite: { color: '#FFFFFF' },
  textMutedDark: { color: '#94A3B8' },
});
