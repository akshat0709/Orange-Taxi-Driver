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
import { X, TrendingUp, IndianRupee, Banknote, CreditCard, Clock, Calendar } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Booking } from '../types';
import { formatRupees, round2 } from '../lib/formatters';

interface DriverEarningsModalProps {
  visible: boolean;
  onClose: () => void;
  driverId: string;
  theme?: 'light' | 'dark';
}

export function DriverEarningsModal({
  visible,
  onClose,
  driverId,
  theme = 'dark',
}: DriverEarningsModalProps) {
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24)) + 12;

  const [completedTrips, setCompletedTrips] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && driverId) {
      fetchTrips();
    }
  }, [visible, driverId]);

  async function fetchTrips() {
    setLoading(true);
    try {
      // Query completed bookings for this driver
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50);

      if (data) {
        setCompletedTrips(data as Booking[]);
      }
    } catch (e) {
      console.error('Failed to load trips:', e);
    } finally {
      setLoading(false);
    }
  }

  // Calculate today vs lifetime earnings metrics rounded strictly to 2 decimal places
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const todayTrips = completedTrips.filter((t) => {
    const timeStr = t.completed_at || t.created_at;
    if (!timeStr) return false;
    return new Date(timeStr) >= startOfToday;
  });

  // Today's Net earnings: 85% chauffeur payout of today's trips
  const todayRaw = todayTrips.reduce(
    (acc, t) => acc + (Number(t.final_fare) || Number(t.estimated_fare) || 0),
    0
  );
  const todayEarnings = round2(todayRaw * 0.85);

  // All-time lifetime net earnings: 85% of all completed trips
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
            <View style={styles.earningsIconWrap}>
              <TrendingUp size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.headerTitle, isDark && styles.textWhite]}>Chauffeur Earnings</Text>
              <Text style={styles.headerSub}>Transparent Daily Payout Ledger</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.closeBtn, isDark && styles.closeBtnDark]} onPress={onClose}>
            <X size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        {/* Big Earnings Balance Card - Today's Performance Focus */}
        <View style={styles.metricsWrapper}>
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

          {/* Breakdown: Cash Collected vs Digital Bank Payout Today */}
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
                    No completed trips yet today. Go online to begin taking trips!
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
