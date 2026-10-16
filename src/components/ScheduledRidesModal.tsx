import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { X, Calendar, Clock, MapPin, Navigation, CheckCircle, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Booking } from '../types';
import { formatRupees } from '../lib/formatters';

interface ScheduledRidesModalProps {
  visible: boolean;
  onClose: () => void;
  driverId: string;
  onClaimScheduledRide: (booking: Booking) => void;
  theme?: 'light' | 'dark';
}

export function ScheduledRidesModal({
  visible,
  onClose,
  driverId,
  onClaimScheduledRide,
  theme = 'dark',
}: ScheduledRidesModalProps) {
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24)) + 12;

  const [scheduledRides, setScheduledRides] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchScheduledRides();
    }
  }, [visible]);

  async function fetchScheduledRides() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true })
        .limit(25);

      if (data) {
        setScheduledRides(data as Booking[]);
      }
    } catch (e) {
      console.error('Failed to load scheduled rides:', e);
    } finally {
      setLoading(false);
    }
  }

  function handlePreAccept(ride: Booking) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Pre-Accept Scheduled Ride?',
      `Are you sure you want to lock in this departure?\n\n📅 Departure: ${ride.scheduled_at ? new Date(ride.scheduled_at).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Advance'}\n📍 Route: ${ride.pickup_area} → ${ride.drop_area}\n💰 Fare: ₹${formatRupees(ride.estimated_fare)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Pre-Accept',
          style: 'default',
          onPress: async () => {
            const { data: locked, error } = await supabase
              .from('bookings')
              .update({ driver_id: driverId })
              .eq('id', ride.id)
              .is('driver_id', null)
              .select('*')
              .maybeSingle();

            if (error || !locked) {
              Alert.alert(
                'Already Claimed',
                'Another chauffeur just claimed this scheduled departure. Please refresh the list.'
              );
              fetchScheduledRides();
              return;
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClaimScheduledRide(locked as Booking);
            onClose();
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: safeTop }, isDark && styles.headerDark]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={styles.calendarIconWrap}>
              <Calendar size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.headerTitle, isDark && styles.textWhite]}>Scheduled Rides</Text>
              <Text style={styles.headerSub}>Pre-Accept Advance Airport & City Bookings</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.closeBtn, isDark && styles.closeBtnDark]} onPress={onClose}>
            <X size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#F97316" />
            <Text style={[styles.loadingText, isDark && styles.textMutedDark]}>Loading upcoming advance rides...</Text>
          </View>
        ) : (
          <FlatList
            data={scheduledRides}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Calendar size={48} color={isDark ? '#334155' : '#CBD5E1'} />
                <Text style={[styles.emptyTitle, isDark && styles.textWhite]}>No Scheduled Rides</Text>
                <Text style={[styles.emptySubtitle, isDark && styles.textMutedDark]}>
                  New advance airport bookings and early morning runs will appear here automatically.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const formattedDate = item.scheduled_at
                ? new Date(item.scheduled_at).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                : 'Upcoming Advance';

              return (
                <View style={[styles.rideCard, isDark && styles.rideCardDark]}>
                  {/* Top Bar: Date & Fare */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.dateBadge}>
                      <Clock size={12} color="#7C3AED" />
                      <Text style={styles.dateBadgeText}>{formattedDate}</Text>
                    </View>
                    <Text style={styles.fareAmount}>₹{formatRupees(item.estimated_fare)}</Text>
                  </View>

                  {/* Route */}
                  <View style={styles.routeContainer}>
                    <View style={styles.routeRow}>
                      <MapPin size={14} color="#10B981" />
                      <Text style={[styles.addressText, isDark && styles.textWhite]} numberOfLines={1}>
                        {item.pickup_area}
                      </Text>
                    </View>
                    <View style={styles.routeConnector} />
                    <View style={styles.routeRow}>
                      <Navigation size={14} color="#F97316" />
                      <Text style={[styles.addressText, isDark && styles.textWhite]} numberOfLines={1}>
                        {item.drop_area}
                      </Text>
                    </View>
                  </View>

                  {/* Footer & Pre-Accept CTA */}
                  <View style={styles.cardFooter}>
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceBadgeText}>{item.distance_km} km · Zero Surge</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.claimButton}
                      onPress={() => handlePreAccept(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.claimButtonText}>PRE-ACCEPT RIDE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
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
  calendarIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  emptySubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  rideCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dateBadgeText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '800',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
  },
  routeContainer: {
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeConnector: {
    width: 2,
    height: 12,
    backgroundColor: '#CBD5E1',
    marginLeft: 6,
    marginVertical: 3,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  distanceBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  claimButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  textWhite: { color: '#FFFFFF' },
  textMutedDark: { color: '#94A3B8' },
});
