import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Platform,
  Keyboard, KeyboardAvoidingView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import {
  Phone,
  MessageSquare,
  Navigation,
  CheckCircle,
  MapPin,
  Snowflake,
  VolumeX,
  Shield,
  Banknote,
  ExternalLink,
} from 'lucide-react-native';
import { Booking } from '../types';
import { formatRupees } from '../lib/formatters';
import { openGoogleMaps, resolveBookingTargetCoords } from '../lib/locationResolver';

interface ActiveRideSheetProps {
  booking: Booking;
  onUpdateStatus: (newStatus: 'arrived' | 'in_progress' | 'completed', extraUpdates?: Record<string, any>) => void;
  onFinishRide?: () => void;
  onOpenChat: () => void;
  theme?: 'light' | 'dark';
}

export function ActiveRideSheet({
  booking,
  onUpdateStatus,
  onFinishRide,
  onOpenChat,
  theme = 'dark',
}: ActiveRideSheetProps) {
  const isDark = theme === 'dark';
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [cashConfirmed, setCashConfirmed] = useState(false);

  const status = booking.status;

  function handleOpenGmaps() {
    const coords = resolveBookingTargetCoords(booking);
    if (coords) {
      openGoogleMaps(coords.lat, coords.lng, coords.label);
    }
  }

  function handleCallPassenger() {
    Haptics.selectionAsync();
    const phone = booking.customer_phone || '9876543210';
    Alert.alert(
      'Passenger Voice Relay',
      'Connecting call through Orange Privacy Voice Relay. Phone numbers are protected under the DPDP Act, 2023.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Passenger',
          onPress: () => {
            Linking.openURL(`tel:${phone}`).catch(() => {
              Alert.alert('Phone Unavailable', `Passenger phone: ${phone}`);
            });
          },
        },
      ]
    );
  }

  async function handleVerifyOtp() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const cleanOtp = enteredOtp.trim();
    if (cleanOtp.length !== 4) {
      setOtpError(true);
      return;
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id);
      if (isUuid) {
        const { data, error } = await supabase.rpc('verify_ride_otp', {
          _booking_id: booking.id,
          _otp: cleanOtp,
        });

        if (error || !data?.success) {
          setOtpError(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Verification Failed', data?.error || error?.message || 'The 4-digit OTP does not match the passenger’s ride code.');
          return;
        }
      } else {
        const expectedOtp = booking.ride_otp?.trim() || '';
        if (cleanOtp !== expectedOtp) {
          setOtpError(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Invalid OTP', 'The 4-digit OTP does not match the passenger’s ride code.');
          return;
        }
      }

      setOtpError(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdateStatus('in_progress', {
        started_at: new Date().toISOString(),
      });
    } catch (err: any) {
      setOtpError(true);
      Alert.alert('Error', err?.message || 'Could not verify OTP with server.');
    }
  }

  function handleArrivedAtPickup() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onUpdateStatus('arrived', {
      arrived_at: new Date().toISOString(),
    });
  }

  function handleCompleteTrip() {
    Alert.alert(
      'Complete Trip?',
      `Are you sure you have arrived at the passenger's destination?\n\nTotal Fare: ₹${formatRupees(booking.estimated_fare)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Complete',
          style: 'default',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onUpdateStatus('completed', {
              completed_at: new Date().toISOString(),
              final_fare: booking.estimated_fare,
              payment_status: booking.payment_method === 'cash' ? 'pending' : 'completed',
            });
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.sheetContainer, isDark && styles.sheetContainerDark]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Handle */}
      <View style={styles.handleWrap}>
        <View style={[styles.handleBar, isDark && styles.handleBarDark]} />
      </View>

      {/* Stage 1: En Route to Pickup */}
      {status === 'accepted' && (
        <View>
          <View style={styles.statusHeaderRow}>
            <View>
              <View style={styles.statusPillEnRoute}>
                <Text style={styles.statusPillText}>EN ROUTE TO PICKUP</Text>
              </View>
              <Text style={[styles.targetAddressTitle, isDark && styles.textWhite]} numberOfLines={2}>
                {booking.pickup_area}
              </Text>
            </View>

            {/* Quick Contact & Navigation Actions */}
            <View style={styles.contactActions}>
              <TouchableOpacity
                style={[styles.actionCircleBtn, styles.actionNavBtn]}
                onPress={handleOpenGmaps}
              >
                <Navigation size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCircleBtn} onPress={handleCallPassenger}>
                <Phone size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCircleBtn} onPress={onOpenChat}>
                <MessageSquare size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Turn-by-turn Navigation Button */}
          <TouchableOpacity
            style={styles.navBarButton}
            onPress={handleOpenGmaps}
            activeOpacity={0.88}
          >
            <Navigation size={18} color="#38BDF8" />
            <Text style={styles.navBarButtonText}>START NAVIGATION TO PICKUP IN MAPS</Text>
          </TouchableOpacity>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={handleArrivedAtPickup}
            activeOpacity={0.88}
          >
            <MapPin size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>I HAVE ARRIVED AT PICKUP BAY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stage 2: Arrived at Pickup (Enter OTP) */}
      {status === 'arrived' && (
        <View>
          <View style={styles.statusHeaderRow}>
            <View>
              <View style={styles.statusPillArrived}>
                <Text style={styles.statusPillText}>AT PICKUP BAY</Text>
              </View>
              <Text style={[styles.targetAddressTitle, isDark && styles.textWhite]}>
                Passenger Boarding
              </Text>
              <Text style={styles.otpInstructions}>
                Ask passenger for the 4-digit start OTP shown on their phone.
              </Text>
            </View>

            <View style={styles.contactActions}>
              <TouchableOpacity style={styles.actionCircleBtn} onPress={handleCallPassenger}>
                <Phone size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 4-Digit OTP Input Box */}
          <View style={styles.otpInputContainer}>
            <TextInput
              style={[
                styles.otpInput,
                isDark && styles.otpInputDark,
                otpError && styles.otpInputError,
              ]}
              placeholder="ENTER 4-DIGIT OTP"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="number-pad"
              maxLength={4}
              value={enteredOtp}
              onChangeText={(text) => {
                setEnteredOtp(text);
                setOtpError(false);
                if (text.length === 4) {
                  Keyboard.dismiss();
                }
              }}
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <TouchableOpacity
              style={[
                styles.verifyOtpBtn,
                enteredOtp.length !== 4 && styles.verifyOtpBtnDisabled,
              ]}
              disabled={enteredOtp.length !== 4}
              onPress={handleVerifyOtp}
            >
              <CheckCircle size={18} color="#FFFFFF" />
              <Text style={styles.verifyOtpText}>START RIDE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Stage 3: Trip In Progress */}
      {status === 'in_progress' && (
        <View>
          <View style={styles.statusHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.statusPillInProgress}>
                <Text style={styles.statusPillText}>RIDE IN PROGRESS · ZERO EMISSION</Text>
              </View>
              <Text style={[styles.targetAddressTitle, isDark && styles.textWhite]} numberOfLines={2}>
                {booking.drop_area}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={[styles.actionCircleBtn, styles.actionNavBtn]}
                onPress={handleOpenGmaps}
              >
                <Navigation size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.comfortPills}>
                <View style={styles.comfortBadge}>
                  <Snowflake size={12} color="#0284C7" />
                  <Text style={styles.comfortBadgeText}>22°C</Text>
                </View>
                <View style={styles.comfortBadge}>
                  <VolumeX size={12} color="#7C3AED" />
                  <Text style={styles.comfortBadgeText}>Quiet</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Turn-by-turn Navigation Button */}
          <TouchableOpacity
            style={styles.navBarButton}
            onPress={handleOpenGmaps}
            activeOpacity={0.88}
          >
            <Navigation size={18} color="#38BDF8" />
            <Text style={styles.navBarButtonText}>START NAVIGATION TO DESTINATION IN MAPS</Text>
          </TouchableOpacity>

          {/* Complete Trip CTA Button */}
          <TouchableOpacity
            style={styles.completeTripButton}
            onPress={handleCompleteTrip}
            activeOpacity={0.88}
          >
            <CheckCircle size={18} color="#FFFFFF" />
            <Text style={styles.completeTripText}>ARRIVED AT DESTINATION · COMPLETE TRIP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stage 4: Trip Completed & Payment Collection */}
      {status === 'completed' && (
        <View>
          <View style={styles.completedHeader}>
            <CheckCircle size={28} color="#10B981" />
            <Text style={[styles.completedTitle, isDark && styles.textWhite]}>
              Trip Completed Successfully!
            </Text>
          </View>

          {/* Fare Summary Box */}
          <View style={[styles.settlementCard, isDark && styles.settlementCardDark]}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Trip Fare (Zero Surge)</Text>
              <Text style={[styles.fareValue, isDark && styles.textWhite]}>₹{formatRupees(booking.estimated_fare)}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Payment Mode</Text>
              <Text style={[styles.fareValue, { color: '#10B981' }]}>
                {booking.payment_method === 'cash' ? 'Cash on Arrival' : 'Prepaid (Wallet/UPI)'}
              </Text>
            </View>

            {(booking.payment_method === 'cash' || booking.payment_method === 'driver_upi') ? (
              <View style={styles.cashNoticeBox}>
                <Banknote size={18} color="#F97316" />
                <Text style={styles.cashNoticeText}>
                  Please collect ₹{formatRupees(booking.estimated_fare)} directly from the passenger.
                </Text>
              </View>
            ) : (
              <View style={styles.digitalNoticeBox}>
                <CheckCircle size={18} color="#10B981" />
                <Text style={styles.digitalNoticeText}>
                  Paid Online via Razorpay. Do NOT collect cash.
                </Text>
              </View>
            )}
          </View>

          {(booking.payment_method === 'cash' || booking.payment_method === 'driver_upi') && !cashConfirmed ? (
            <View style={{ gap: 10 }}>
              <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: 'bold', marginBottom: 5, color: isDark ? '#9CA3AF' : '#6B7280' }}>
                How did the passenger pay?
              </Text>
              <TouchableOpacity
                style={[styles.confirmCashBtn, { backgroundColor: '#10B981' }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setCashConfirmed(true);
                  supabase.from('bookings').update({ payment_method: 'cash' }).eq('id', booking.id);
                }}
              >
                <Text style={styles.confirmCashBtnText}>CASH RECEIVED (₹{formatRupees(booking.estimated_fare)})</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmCashBtn, { backgroundColor: '#3B82F6' }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setCashConfirmed(true);
                  supabase.from('bookings').update({ payment_method: 'driver_upi' }).eq('id', booking.id);
                }}
              >
                <Text style={styles.confirmCashBtnText}>MY PERSONAL UPI (₹{formatRupees(booking.estimated_fare)})</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.doneTripBtn}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (onFinishRide) {
                  onFinishRide();
                } else {
                  onUpdateStatus('completed');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.doneTripBtnText}>READY FOR NEXT RIDE</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetContainerDark: {
    backgroundColor: '#0F172A',
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  handleBarDark: {
    backgroundColor: '#334155',
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  statusPillEnRoute: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusPillArrived: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusPillInProgress: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusPillText: {
    color: '#F97316',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  targetAddressTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
    maxWidth: 240,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionNavBtn: {
    backgroundColor: '#0284C7',
    borderColor: '#0369A1',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  otpInstructions: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  otpInputContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  otpInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#0F172A',
    textAlign: 'center',
  },
  otpInputDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    color: '#FFFFFF',
  },
  otpInputError: {
    borderColor: '#EF4444',
  },
  verifyOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  verifyOtpBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  verifyOtpText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  comfortPills: {
    flexDirection: 'row',
    gap: 6,
  },
  comfortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comfortBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  navBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    marginBottom: 10,
  },
  navBarButtonText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  completeTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F97316',
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  completeTripText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  settlementCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  settlementCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  fareLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  fareValue: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  cashNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  cashNoticeText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  digitalNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  digitalNoticeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  confirmCashBtn: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCashBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  doneTripBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTripBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  textWhite: {
    color: '#FFFFFF',
  },
});
