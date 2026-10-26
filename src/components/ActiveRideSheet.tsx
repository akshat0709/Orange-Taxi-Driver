import React, { useEffect, useState } from 'react';
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
  Image,
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
  Sparkles,
  Music2,
  Briefcase,
  MonitorPlay,
  Droplets,
} from 'lucide-react-native';
import { Booking } from '../types';
import { formatRupees } from '../lib/formatters';
import { openGoogleMaps, resolveBookingTargetCoords } from '../lib/locationResolver';
import { clearReturnToAppNotification } from '../lib/notificationService';
import { UpiQrModal } from './UpiQrModal';
import { prepareRideQr } from '../lib/upiQr';

export interface CabinPreferences {
  temperature: '19°C' | '21°C' | '23°C';
  music: 'lofi' | 'bollywood' | 'jazz' | 'quiet';
  luggageHelp: boolean;
  noHonking: boolean;
  screenOn: boolean;
  waterBottle: boolean;
}

export function parseCabinPreferences(booking: Booking): CabinPreferences {
  if (booking.pickup_address && booking.pickup_address.includes('CABIN:')) {
    try {
      const jsonStr = booking.pickup_address.split('CABIN:')[1].trim();
      const parsed = JSON.parse(jsonStr);
      return {
        temperature: parsed.temperature || '21°C',
        music: parsed.music || 'lofi',
        luggageHelp: Boolean(parsed.luggageHelp),
        noHonking: parsed.noHonking !== undefined ? Boolean(parsed.noHonking) : true,
        screenOn: parsed.screenOn !== undefined ? Boolean(parsed.screenOn) : true,
        waterBottle: parsed.waterBottle !== undefined ? Boolean(parsed.waterBottle) : true,
      };
    } catch {}
  }
  return {
    temperature: '21°C',
    music: 'lofi',
    luggageHelp: false,
    noHonking: true,
    screenOn: true,
    waterBottle: true,
  };
}

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
  // UPI: a Razorpay QR that pays Orange Taxi directly (recorded by the server, not by this app).
  const [qrBookingId, setQrBookingId] = useState<string | null>(null);
  const [paidByQr, setPaidByQr] = useState(false);

  const status = booking.status;
  const cabin = parseCabinPreferences(booking);

  // As soon as the trip ends unpaid, get the UPI QR ready in the background so "Show QR"
  // opens instantly instead of waiting for Razorpay.
  const unpaidAtEnd =
    status === 'completed' &&
    booking.payment_status !== 'paid' &&
    booking.payment_status !== 'paid_online' &&
    String(booking.payment_made ?? '').toLowerCase() !== 'yes' &&
    booking.payment_made !== true;
  useEffect(() => {
    if (!unpaidAtEnd) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const token = data.session?.access_token;
        if (token) prepareRideQr(booking.id, token, (url) => Image.prefetch(url));
      })
      .catch(() => {});
  }, [unpaidAtEnd, booking.id]);

  function handleOpenGmaps() {
    const coords = resolveBookingTargetCoords(booking);
    if (coords) {
      openGoogleMaps(coords.lat, coords.lng, coords.label);
    }
  }

  function handleCallPassenger() {
    Haptics.selectionAsync();
    const phone = booking.customer_phone || '';
    if (!phone) {
      Alert.alert('Number Not Available', "The passenger hasn't added a phone number. Use in-app chat instead.");
      return;
    }
    Alert.alert(
      'Call Passenger?',
      'Please use the passenger\'s number only for this ride.',
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
    if (cleanOtp.length < 4) {
      setOtpError(true);
      return;
    }

    try {
      let verified = false;

      // Server-side OTP verification only. This used to fail OPEN: if the RPC was missing
      // ("schema cache" error) any code was accepted and the ride started without the passenger.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id);
      if (isUuid) {
        const { data, error } = await supabase.rpc('verify_ride_otp', {
          _booking_id: booking.id,
          _otp: cleanOtp,
        });

        if (!error && data?.success) {
          verified = true;
        } else if (error) {
          setOtpError(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Verification Unavailable', 'The OTP could not be verified with the server. Check your connection and try again.');
          return;
        } else if (data?.error) {
          setOtpError(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Verification Failed', data.error);
          return;
        }
      }

      if (!verified) {
        setOtpError(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Invalid OTP', 'The 4-digit OTP does not match the passenger’s ride code.');
        return;
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

  // Records money the chauffeur collected directly. Errors used to be swallowed after the button
  // had already switched to "READY FOR NEXT RIDE", leaving the booking unpaid in the database.
  async function recordDirectPayment(method: 'cash') {
    try {
      let { error } = await supabase
        .from('bookings')
        .update({ payment_method: method, payment_status: 'paid', payment_made: 'yes' })
        .eq('id', booking.id);
      if (error && error.message && error.message.includes('payment_made')) {
        ({ error } = await supabase
          .from('bookings')
          .update({ payment_method: method, payment_status: 'paid' })
          .eq('id', booking.id));
      }
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Payment Not Recorded', error.message || 'Please check your connection and try again.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCashConfirmed(true);
    } catch (e: any) {
      Alert.alert('Payment Not Recorded', e?.message || 'Please check your connection and try again.');
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
            clearReturnToAppNotification().catch(() => {});
            const rawPaymentMade = String(booking.payment_made ?? '').trim().toLowerCase();
            const isExplicitlyNo = rawPaymentMade === 'no' || booking.payment_made === false;
            const isExplicitlyYes = rawPaymentMade === 'yes' || booking.payment_made === true;
            const isAlreadyPaid = isExplicitlyNo
              ? false
              : isExplicitlyYes
              ? true
              : booking.payment_method === 'cash' || booking.payment_method === 'driver_upi' || booking.payment_method === 'wallet'
              ? false
              : booking.payment_status === 'paid' || booking.payment_status === 'paid_online';

            onUpdateStatus('completed', {
              completed_at: new Date().toISOString(),
              final_fare: booking.estimated_fare,
              payment_status: isAlreadyPaid ? 'paid' : 'pending',
              payment_made: isAlreadyPaid ? 'yes' : 'no',
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

      {/* Mahindra BE.6 Guest Cabin Preferences Banner */}
      {status !== 'completed' && (
        <View style={[styles.cabinCard, isDark && styles.cabinCardDark]}>
          <View style={styles.cabinHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} color="#F97316" />
              <Text style={[styles.cabinCardTitle, isDark && styles.textWhite]}>
                MAHINDRA BE.6 GUEST CABIN PREFERENCES
              </Text>
            </View>
            <View style={styles.be6Pill}>
              <Text style={styles.be6PillText}>EV LUXURY</Text>
            </View>
          </View>

          <View style={styles.cabinBadgesRow}>
            {/* Climate Badge */}
            <View style={[styles.cabinBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)', borderColor: '#38BDF8' }]}>
              <Snowflake size={12} color="#38BDF8" />
              <Text style={[styles.cabinBadgeText, { color: '#38BDF8' }]}>Pre-Cool: {cabin.temperature}</Text>
            </View>

            {/* Acoustic Mood Badge */}
            <View style={[styles.cabinBadge, { backgroundColor: 'rgba(249, 115, 22, 0.12)', borderColor: '#F97316' }]}>
              <Music2 size={12} color="#F97316" />
              <Text style={[styles.cabinBadgeText, { color: '#F97316' }]}>
                {cabin.music === 'lofi' ? 'Lo-Fi Lounge' : cabin.music === 'bollywood' ? 'Bollywood Gold' : cabin.music === 'jazz' ? 'Smooth Jazz' : 'Quiet Cabin'}
              </Text>
            </View>

            {/* Quiet Journey / No Honking */}
            {cabin.noHonking && (
              <View style={[styles.cabinBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }]}>
                <VolumeX size={12} color="#10B981" />
                <Text style={[styles.cabinBadgeText, { color: '#10B981' }]}>Do Not Honk</Text>
              </View>
            )}

            {/* Luggage Assistance */}
            {cabin.luggageHelp && (
              <View style={[styles.cabinBadge, { backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: '#A855F7' }]}>
                <Briefcase size={12} color="#A855F7" />
                <Text style={[styles.cabinBadgeText, { color: '#A855F7' }]}>Luggage Assist</Text>
              </View>
            )}

            {/* HD Screen */}
            {cabin.screenOn && (
              <View style={[styles.cabinBadge, { backgroundColor: 'rgba(236, 72, 153, 0.12)', borderColor: '#EC4899' }]}>
                <MonitorPlay size={12} color="#EC4899" />
                <Text style={[styles.cabinBadgeText, { color: '#EC4899' }]}>In-Seat Screen On</Text>
              </View>
            )}

            {/* Water Bottle */}
            {cabin.waterBottle && (
              <View style={[styles.cabinBadge, { backgroundColor: 'rgba(6, 182, 212, 0.12)', borderColor: '#06B6D4' }]}>
                <Droplets size={12} color="#06B6D4" />
                <Text style={[styles.cabinBadgeText, { color: '#06B6D4' }]}>Water Ready</Text>
              </View>
            )}
          </View>
        </View>
      )}

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
                Ask passenger for the start OTP shown on their phone.
              </Text>
            </View>

            <View style={styles.contactActions}>
              <TouchableOpacity style={styles.actionCircleBtn} onPress={handleCallPassenger}>
                <Phone size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* OTP Input Box */}
          <View style={styles.otpInputContainer}>
            <TextInput
              style={[
                styles.otpInput,
                isDark && styles.otpInputDark,
                otpError && styles.otpInputError,
              ]}
              placeholder="ENTER START OTP"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="number-pad"
              maxLength={6}
              value={enteredOtp}
              onChangeText={(text) => {
                setEnteredOtp(text);
                setOtpError(false);
                if (text.length >= 4) {
                  Keyboard.dismiss();
                }
              }}
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <TouchableOpacity
              style={[
                styles.verifyOtpBtn,
                enteredOtp.length < 4 && styles.verifyOtpBtnDisabled,
              ]}
              disabled={enteredOtp.length < 4}
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
                  <Text style={styles.comfortBadgeText}>{cabin.temperature}</Text>
                </View>
                <View style={styles.comfortBadge}>
                  <VolumeX size={12} color="#7C3AED" />
                  <Text style={styles.comfortBadgeText}>
                    {cabin.music === 'quiet' ? 'Quiet' : (cabin.music.charAt(0).toUpperCase() + cabin.music.slice(1))}
                  </Text>
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
      <UpiQrModal
        bookingId={qrBookingId}
        onClose={() => setQrBookingId(null)}
        onPaid={() => {
          setPaidByQr(true);
          setCashConfirmed(true);
        }}
      />
      {status === 'completed' && (
        <View>
          <View style={styles.completedHeader}>
            <CheckCircle size={28} color="#10B981" />
            <Text style={[styles.completedTitle, isDark && styles.textWhite]}>
              Trip Completed Successfully!
            </Text>
          </View>

          {/* Fare Summary Box */}
          {(() => {
            // How the fare was settled. "Cash received" used to show as "Payment was made online"
            // because payment_made = 'yes' was checked before the payment method.
            const rawPaymentMade = String(booking.payment_made ?? '').trim().toLowerCase();
            const isExplicitlyNo = rawPaymentMade === 'no' || booking.payment_made === false;
            const isExplicitlyYes = rawPaymentMade === 'yes' || booking.payment_made === true;
            const isMarkedPaid = isExplicitlyNo
              ? false
              : isExplicitlyYes || booking.payment_status === 'paid' || booking.payment_status === 'paid_online';
            const paidQr = paidByQr || booking.payment_method === 'upi_qr';
            const isDirect = booking.payment_method === 'cash' || booking.payment_method === 'driver_upi';
            const cashCollected = !paidQr && (cashConfirmed || (isDirect && isMarkedPaid));
            const isPaidOnline = paidQr || (!isDirect && isMarkedPaid);
            const isSettled = isPaidOnline || cashCollected;
            const statusLabel = paidQr
              ? 'Paid by UPI QR'
              : cashCollected
              ? 'Cash received'
              : isPaidOnline
              ? 'Payment was made online'
              : 'Payment to be collected';

            return (
              <>
                <View style={[styles.settlementCard, isDark && styles.settlementCardDark]}>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Trip Fare</Text>
                    <Text style={[styles.fareValue, isDark && styles.textWhite]}>₹{formatRupees(booking.estimated_fare)}</Text>
                  </View>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Payment Status</Text>
                    <Text style={[styles.fareValue, { color: isSettled ? '#10B981' : '#F97316' }]}>
                      {statusLabel}
                    </Text>
                  </View>

                  {!isSettled ? (
                    <View style={styles.cashNoticeBox}>
                      <Banknote size={18} color="#F97316" />
                      <Text style={styles.cashNoticeText}>
                        Payment to be collected: ₹{formatRupees(booking.estimated_fare)} directly from the passenger.{Number((booking as any).dues_amount) > 0 ? ` Includes ₹${formatRupees((booking as any).dues_amount)} cancellation fee from the passenger's earlier ride.` : ''}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.digitalNoticeBox}>
                      <CheckCircle size={18} color="#10B981" />
                      <Text style={styles.digitalNoticeText}>
                        {cashCollected
                          ? `Cash of ₹${formatRupees(booking.estimated_fare)} recorded. Hand it in from Earnings.`
                          : 'Payment was made online. Do NOT collect cash.'}
                      </Text>
                    </View>
                  )}
                </View>

                {!isSettled ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: 'bold', marginBottom: 5, color: isDark ? '#9CA3AF' : '#6B7280' }}>
                      How did the passenger pay?
                    </Text>
                    <TouchableOpacity
                      style={[styles.confirmCashBtn, { backgroundColor: '#10B981' }]}
                      onPress={() => recordDirectPayment('cash')}
                    >
                      <Text style={styles.confirmCashBtnText}>CASH RECEIVED (₹{formatRupees(booking.estimated_fare)})</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.confirmCashBtn, { backgroundColor: '#3B82F6' }]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setQrBookingId(booking.id);
                      }}
                    >
                      <Text style={styles.confirmCashBtnText}>UPI – SHOW QR (₹{formatRupees(booking.estimated_fare)})</Text>
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
              </>
            );
          })()}
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
  cabinCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  cabinCardDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  cabinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cabinCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  be6Pill: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  be6PillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F97316',
    textTransform: 'uppercase',
  },
  cabinBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cabinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  cabinBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
