import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MapPin, Navigation, Banknote, CreditCard, Wallet, Car, Clock, ShieldCheck } from 'lucide-react-native';
import { Booking } from '../types';
import { formatRupees } from '../lib/formatters';
import { soundService } from '../lib/soundService';

interface IncomingRideModalProps {
  booking: Booking | null;
  onAccept: (booking: Booking) => void;
  onDecline: (booking: Booking) => void;
  theme?: 'light' | 'dark';
}

const RING_DURATION = 30; // seconds

export function IncomingRideModal({
  booking,
  onAccept,
  onDecline,
  theme = 'dark',
}: IncomingRideModalProps) {
  const isDark = theme === 'dark';
  const [secondsRemaining, setSecondsRemaining] = useState(RING_DURATION);

  useEffect(() => {
    if (!booking) {
      setSecondsRemaining(RING_DURATION);
      soundService.stopDispatchAlert();
      return;
    }

    setSecondsRemaining(RING_DURATION);

    // Initial alert vibration and continuous audible sound alert
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    soundService.playDispatchAlert();

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          soundService.stopDispatchAlert();
          onDecline(booking);
          return 0;
        }
        if (prev % 3 === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      soundService.stopDispatchAlert();
    };
  }, [booking?.id]);

  if (!booking) return null;

  const progressPercent = (secondsRemaining / RING_DURATION) * 100;

  return (
    <Modal visible={Boolean(booking)} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          {/* Animated Countdown Progress Bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>

          {/* Header & Fare */}
          <View style={styles.headerRow}>
            <View>
              <View style={styles.dispatchPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.dispatchPillText}>INCOMING DISPATCH · {secondsRemaining}s</Text>
              </View>
              <Text style={[styles.vehicleTag, isDark && styles.textWhite]}>
                {booking.vehicle_name || 'Orange Electric Chauffeur'}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.fareAmount}>₹{formatRupees(booking.estimated_fare)}</Text>
              {(() => {
                const rawPaymentMade = String(booking.payment_made ?? '').trim().toLowerCase();
                const isExplicitlyNo = rawPaymentMade === 'no' || booking.payment_made === false;
                const isExplicitlyYes = rawPaymentMade === 'yes' || booking.payment_made === true;
                const isPaidOnline = isExplicitlyNo
                  ? false
                  : isExplicitlyYes
                  ? true
                  : booking.payment_method === 'cash' || booking.payment_method === 'driver_upi'
                  ? false
                  : booking.payment_status === 'paid' || booking.payment_status === 'paid_online'
                  ? true
                  : booking.payment_method === 'wallet'
                  ? true
                  : false;

                return (
                  <View style={styles.paymentMethodRow}>
                    {booking.payment_method === 'cash' || !isPaidOnline ? (
                      <Banknote size={12} color="#10B981" />
                    ) : booking.payment_method === 'wallet' ? (
                      <Wallet size={12} color="#F97316" />
                    ) : (
                      <CreditCard size={12} color="#3B82F6" />
                    )}
                    <Text style={styles.paymentMethodText}>
                      {booking.payment_method === 'cash' || !isPaidOnline
                        ? 'Collect on Arrival'
                        : booking.payment_method === 'wallet'
                        ? 'Orange Wallet'
                        : 'Paid Online'}
                    </Text>
                  </View>
                );
              })()}
            </View>
          </View>

          {/* Route Card: Pickup to Destination */}
          <View style={[styles.routeBox, isDark && styles.routeBoxDark]}>
            {/* Pickup */}
            <View style={styles.stopRow}>
              <View style={styles.pickupDot} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.stopMicroLabel}>PASSENGER PICKUP</Text>
                <Text style={[styles.stopAddress, isDark && styles.textWhite]} numberOfLines={2}>
                  {booking.pickup_area}
                </Text>
              </View>
            </View>

            <View style={styles.connectorLine} />

            {/* Drop off */}
            <View style={styles.stopRow}>
              <View style={styles.dropSquare} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.stopMicroLabel}>DESTINATION</Text>
                <Text style={[styles.stopAddress, isDark && styles.textWhite]} numberOfLines={2}>
                  {booking.drop_area}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Metrics (Trip Distance & Estimated Time) */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricItem, isDark && styles.metricItemDark]}>
              <Navigation size={14} color="#F97316" />
              <Text style={[styles.metricText, isDark && styles.textWhite]}>
                {booking.distance_km} km trip
              </Text>
            </View>
            <View style={[styles.metricItem, isDark && styles.metricItemDark]}>
              <Clock size={14} color="#F97316" />
              <Text style={[styles.metricText, isDark && styles.textWhite]}>
                ~{booking.duration_min} mins
              </Text>
            </View>
            <View style={[styles.metricItem, isDark && styles.metricItemDark]}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={[styles.metricText, isDark && styles.textWhite]}>
                Zero Surge Locked
              </Text>
            </View>
          </View>

          {/* Action CTAs: Accept or Decline */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.declineBtn, isDark && styles.declineBtnDark]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                soundService.stopDispatchAlert();
                onDecline(booking);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                soundService.playAcceptChime();
                onAccept(booking);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.acceptBtnText}>ACCEPT RIDE · ₹{formatRupees(booking.estimated_fare)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  cardDark: {
    backgroundColor: '#0F172A',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#F97316',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dispatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  dispatchPillText: {
    color: '#F97316',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vehicleTag: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  fareAmount: {
    color: '#10B981',
    fontSize: 26,
    fontWeight: '900',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  paymentMethodText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  routeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  routeBoxDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  connectorLine: {
    width: 2,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginLeft: 4,
    marginVertical: 4,
  },
  dropSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#F97316',
    marginTop: 4,
  },
  stopMicroLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  stopAddress: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 10,
  },
  metricItemDark: {
    backgroundColor: '#1E293B',
  },
  metricText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnDark: {
    backgroundColor: '#1E293B',
  },
  declineBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  textWhite: {
    color: '#FFFFFF',
  },
});
