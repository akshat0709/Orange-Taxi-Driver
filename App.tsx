import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  Radio,
  Power,
  Shield,
  Calendar,
  Wallet,
  User,
  Navigation,
  Sparkles,
  PhoneCall,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  Zap,
} from 'lucide-react-native';

import { supabase } from './src/lib/supabase';
import { Driver, Booking, DriverStats } from './src/types';
import { DriverMap } from './src/components/DriverMap';
import { IncomingRideModal } from './src/components/IncomingRideModal';
import { ActiveRideSheet } from './src/components/ActiveRideSheet';
import { ScheduledRidesModal } from './src/components/ScheduledRidesModal';
import { DriverEarningsModal } from './src/components/DriverEarningsModal';
import { DriverProfileModal } from './src/components/DriverProfileModal';
import { InRideChatModal } from './src/components/InRideChatModal';

const { width } = Dimensions.get('window');

// Default Demo Chauffeur
const DEMO_DRIVER: Driver = {
  id: 'd0000000-0000-0000-0000-000000000001',
  user_id: 'u0000000-0000-0000-0000-000000000001',
  full_name: 'Ramesh Kumar',
  phone: '+91 98765 43210',
  vehicle_model: 'Mahindra BE 6 EV',
  vehicle_number: 'DL 01 AB 1234',
  vehicle_type: 'BE 6 VIP SUV',
  is_online: true,
  current_lat: 12.9716,
  current_lng: 77.5946,
  rating: 4.94,
  total_trips: 1420,
  status: 'active',
};

const INITIAL_STATS: DriverStats = {
  todayEarnings: 2850,
  todayTrips: 6,
  todayHours: 5.4,
  cashCollected: 650,
  rating: 4.94,
  acceptanceRate: 98,
};

export default function App() {
  // Authentication & Driver state
  const [driver, setDriver] = useState<Driver | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Online / Offline & GPS
  const [isOnline, setIsOnline] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
  }>({
    latitude: 12.9716,
    longitude: 77.5946,
    heading: 45,
  });

  // Ride Management
  const [incomingBooking, setIncomingBooking] = useState<Booking | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [declinedBookingIds, setDeclinedBookingIds] = useState<string[]>([]);
  const [claimedScheduledRides, setClaimedScheduledRides] = useState<Booking[]>([]);

  // Driver Statistics
  const [stats, setStats] = useState<DriverStats>(INITIAL_STATS);

  // Modals
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  // Refs
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const locationUpdateTimer = useRef<any>(null);

  // 1. Initialize Chauffeur Profile
  useEffect(() => {
    async function loadDriver() {
      try {
        const saved = await AsyncStorage.getItem('orange_taxi_driver');
        if (saved) {
          const parsed = JSON.parse(saved);
          setDriver(parsed);
          setIsOnline(parsed.is_online ?? true);
        } else {
          // Auto-load demo chauffeur for rapid development & demo access
          setDriver(DEMO_DRIVER);
          setIsOnline(true);
          await AsyncStorage.setItem('orange_taxi_driver', JSON.stringify(DEMO_DRIVER));
        }

        // Load stats
        const savedStats = await AsyncStorage.getItem('orange_driver_stats');
        if (savedStats) {
          setStats(JSON.parse(savedStats));
        }
      } catch (err) {
        console.warn('Failed loading driver state:', err);
        setDriver(DEMO_DRIVER);
      } finally {
        setAuthLoading(false);
      }
    }
    loadDriver();
  }, []);

  // 2. Start GPS Tracking when Online
  useEffect(() => {
    if (!isOnline) {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      return;
    }

    let isMounted = true;

    async function startLocationWatch() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission not granted, using simulated location.');
          return;
        }

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted && initial?.coords) {
          setDriverLocation({
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
            heading: initial.coords.heading || 0,
          });
        }

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 10,
          },
          (loc) => {
            if (!isMounted || !loc?.coords) return;
            setDriverLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading || 0,
            });
          }
        );
      } catch (err) {
        console.warn('GPS location tracking error:', err);
      }
    }

    startLocationWatch();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [isOnline]);

  // 3. Periodic Driver Telemetry Sync to Supabase
  useEffect(() => {
    if (!driver || !isOnline || !driverLocation) return;

    if (locationUpdateTimer.current) {
      clearInterval(locationUpdateTimer.current);
    }

    locationUpdateTimer.current = setInterval(async () => {
      try {
        await supabase
          .from('drivers')
          .update({
            current_lat: driverLocation.latitude,
            current_lng: driverLocation.longitude,
            is_online: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', driver.id);
      } catch (err) {
        // Silent fail for offline/network hiccups
      }
    }, 8000);

    return () => {
      if (locationUpdateTimer.current) {
        clearInterval(locationUpdateTimer.current);
      }
    };
  }, [driver, isOnline, driverLocation]);

  // 4. Supabase Realtime Channel for Incoming Dispatches
  useEffect(() => {
    if (!isOnline || !driver || activeBooking) return;

    const channel = supabase
      .channel('driver-booking-broadcasts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        (payload) => {
          const newBooking = payload.new as Booking;
          if (!newBooking) return;

          // If a new booking is searching and not declined
          if (
            newBooking.status === 'searching' &&
            !declinedBookingIds.includes(newBooking.id) &&
            !activeBooking
          ) {
            triggerIncomingBookingAlert(newBooking);
          }

          // If our active booking is cancelled by rider
          const currentActive = activeBooking as Booking | null;
          if (currentActive && newBooking.id === currentActive.id) {
            if (newBooking.status === 'cancelled') {
              Alert.alert('Trip Cancelled', 'The rider has cancelled this booking.');
              setActiveBooking(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, driver, activeBooking, declinedBookingIds]);

  // Helper: Trigger Incoming Ride
  const triggerIncomingBookingAlert = (booking: Booking) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setIncomingBooking(booking);
  };

  // Toggle Online/Offline
  const handleToggleOnline = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    if (driver) {
      const updated = { ...driver, is_online: nextState };
      setDriver(updated);
      await AsyncStorage.setItem('orange_taxi_driver', JSON.stringify(updated));

      // Update in Supabase
      await supabase
        .from('drivers')
        .update({ is_online: nextState, updated_at: new Date().toISOString() })
        .eq('id', driver.id);
    }
  };

  // Accept Ride Handler
  const handleAcceptRide = async (booking: Booking) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const { data } = await supabase
      .from('bookings')
      .update({
        status: 'accepted',
        driver_id: driver?.id || DEMO_DRIVER.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select()
      .single();

    const accepted: Booking = (data as Booking) || {
      ...booking,
      status: 'accepted',
      driver_id: driver?.id || DEMO_DRIVER.id,
      accepted_at: new Date().toISOString(),
    };

    setActiveBooking(accepted);
    setIncomingBooking(null);
  };

  // Decline Ride Handler
  const handleDeclineRide = (booking: Booking) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setDeclinedBookingIds((prev) => [...prev, booking.id]);
    setIncomingBooking(null);
  };

  // Status Transitions (Arrived, OTP Verify, Completed)
  const handleRideStatusUpdate = async (
    newStatus: 'arrived' | 'in_progress' | 'completed',
    extraUpdates?: Record<string, any>
  ) => {
    if (!activeBooking) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const updates: Partial<Booking> = {
      status: newStatus,
      ...extraUpdates,
    };

    if (newStatus === 'arrived') {
      updates.arrived_at = new Date().toISOString();
    } else if (newStatus === 'in_progress') {
      updates.started_at = new Date().toISOString();
    } else if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.final_fare = activeBooking.estimated_fare;
      updates.payment_status = 'completed';

      // Update Chauffeur stats
      const tripEarnings = Math.round(activeBooking.estimated_fare * 0.85); // 85% chauffeur share
      const newStats: DriverStats = {
        ...stats,
        todayEarnings: stats.todayEarnings + tripEarnings,
        todayTrips: stats.todayTrips + 1,
        cashCollected:
          activeBooking.payment_method === 'cash'
            ? stats.cashCollected + activeBooking.estimated_fare
            : stats.cashCollected,
      };
      setStats(newStats);
      await AsyncStorage.setItem('orange_driver_stats', JSON.stringify(newStats));
    }

    // Persist to Supabase
    await supabase.from('bookings').update(updates).eq('id', activeBooking.id);

    setActiveBooking((prev) => (prev ? { ...prev, ...updates } : null));
  };

  // Claim Scheduled Ride
  const handleClaimScheduledRide = (ride: Booking) => {
    setClaimedScheduledRides((prev) => [ride, ...prev]);
    Alert.alert(
      'Scheduled Trip Confirmed!',
      `You are assigned to pickup at ${ride.pickup_area} at ${new Date(
        ride.scheduled_at || ''
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    );
  };

  // Simulate Test Dispatch (for demo & verification)
  const handleSimulateTestDispatch = () => {
    const testBooking: Booking = {
      id: 'test-' + Date.now(),
      reference: 'OT-' + Math.floor(1000 + Math.random() * 9000),
      customer_id: 'cust-demo-1',
      driver_id: null,
      pickup_area: 'Indiranagar 100ft Road',
      pickup_address: '12th Main, HAL 2nd Stage, Indiranagar, Bengaluru',
      drop_area: 'Kempegowda International Airport (BLR)',
      drop_address: 'Terminal 2 Departures, Devanahalli, Bengaluru',
      distance_km: 38.4,
      duration_min: 52,
      vehicle_code: 'BE6',
      vehicle_name: 'Mahindra BE 6 VIP EV',
      base_fare: 450,
      distance_fare: 960,
      tax_amount: 70,
      estimated_fare: 1480,
      status: 'searching',
      payment_method: 'upi',
      payment_status: 'pending',
      ride_otp: '4829',
      customer_name: 'Ananya Sharma',
      customer_phone: '+91 98450 11223',
    };
    triggerIncomingBookingAlert(testBooking);
  };

  // Auth Screen if no driver
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Initializing Orange Chauffeur OS...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* Fullscreen Map Layer */}
        <DriverMap
          driverCoords={{
            lat: driverLocation.latitude,
            lng: driverLocation.longitude,
            heading: driverLocation.heading,
          }}
          targetCoords={
            activeBooking
              ? activeBooking.status === 'in_progress'
                ? { lat: 13.1986, lng: 77.7066, label: activeBooking.drop_area }
                : { lat: 12.9784, lng: 77.6408, label: activeBooking.pickup_area }
              : null
          }
          status={activeBooking?.status || (isOnline ? 'idle' : 'offline')}
          theme="dark"
        />

        {/* Top Header Controls Overlay */}
        <SafeAreaView edges={['top']} style={styles.topSafeArea}>
          <View style={styles.topHeaderBar}>
            {/* Online / Offline Switch Pill */}
            <TouchableOpacity
              style={[
                styles.onlinePill,
                isOnline ? styles.onlinePillActive : styles.onlinePillInactive,
              ]}
              onPress={handleToggleOnline}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.onlineIndicatorDot,
                  isOnline ? styles.dotGreen : styles.dotOffline,
                ]}
              />
              <Text
                style={[
                  styles.onlinePillText,
                  isOnline ? styles.onlineTextActive : styles.onlineTextInactive,
                ]}
              >
                {isOnline ? 'ONLINE' : 'GO ONLINE'}
              </Text>
              <Power size={14} color={isOnline ? '#10B981' : '#94A3B8'} style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* Right Action Icons: Scheduled, Earnings, Profile */}
            <View style={styles.headerRightGroup}>
              {/* Scheduled Rides */}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setShowScheduledModal(true)}
                activeOpacity={0.7}
              >
                <Calendar size={18} color="#F8FAFC" />
                {claimedScheduledRides.length > 0 && (
                  <View style={styles.badgeIndicator}>
                    <Text style={styles.badgeIndicatorText}>{claimedScheduledRides.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Earnings Shortcut */}
              <TouchableOpacity
                style={styles.earningsPill}
                onPress={() => setShowEarningsModal(true)}
                activeOpacity={0.7}
              >
                <Wallet size={15} color="#F97316" />
                <Text style={styles.earningsPillText}>₹{stats.todayEarnings}</Text>
              </TouchableOpacity>

              {/* Profile Avatar */}
              <TouchableOpacity
                style={styles.profileAvatarBtn}
                onPress={() => setShowProfileModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.avatarLetter}>
                  {driver?.full_name ? driver.full_name.charAt(0).toUpperCase() : 'R'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Idle Floating Bar when Online & No Active Trip */}
        {isOnline && !activeBooking && (
          <View style={styles.idleBottomCard}>
            <View style={styles.radarPulseRow}>
              <View style={styles.radarRadarBox}>
                <Radio size={20} color="#F97316" />
              </View>
              <View style={styles.idleStatusTextCol}>
                <Text style={styles.idleStatusTitle}>Searching for Premium Dispatches</Text>
                <Text style={styles.idleStatusSubtitle}>
                  Bengaluru Zone • Zero Surge Commission Fleet
                </Text>
              </View>
              <TouchableOpacity
                style={styles.testDispatchBtn}
                onPress={handleSimulateTestDispatch}
                activeOpacity={0.7}
              >
                <Zap size={14} color="#FFFFFF" />
                <Text style={styles.testDispatchBtnText}>Test</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Metrics Bar */}
            <View style={styles.quickMetricsRow}>
              <View style={styles.quickMetricCol}>
                <Text style={styles.quickMetricVal}>₹{stats.todayEarnings}</Text>
                <Text style={styles.quickMetricLbl}>Today's Net</Text>
              </View>
              <View style={styles.quickMetricDivider} />
              <View style={styles.quickMetricCol}>
                <Text style={styles.quickMetricVal}>{stats.todayTrips}</Text>
                <Text style={styles.quickMetricLbl}>Trips Done</Text>
              </View>
              <View style={styles.quickMetricDivider} />
              <View style={styles.quickMetricCol}>
                <Text style={styles.quickMetricVal}>{stats.todayHours} hrs</Text>
                <Text style={styles.quickMetricLbl}>Online Duty</Text>
              </View>
              <View style={styles.quickMetricDivider} />
              <View style={styles.quickMetricCol}>
                <Text style={styles.quickMetricVal}>★ {stats.rating.toFixed(2)}</Text>
                <Text style={styles.quickMetricLbl}>Chauffeur</Text>
              </View>
            </View>
          </View>
        )}

        {/* Offline Banner when Chauffeur is Offline */}
        {!isOnline && (
          <View style={styles.offlineBottomCard}>
            <View style={styles.offlineIconBox}>
              <Power size={24} color="#94A3B8" />
            </View>
            <View style={styles.offlineTextCol}>
              <Text style={styles.offlineCardTitle}>You are currently Offline</Text>
              <Text style={styles.offlineCardSubtitle}>
                Go online to start receiving executive dispatches and airport runs
              </Text>
            </View>
            <TouchableOpacity
              style={styles.goOnlineBigBtn}
              onPress={handleToggleOnline}
              activeOpacity={0.8}
            >
              <Text style={styles.goOnlineBigBtnText}>GO ONLINE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active Ride Bottom Sheet */}
        {activeBooking && (
          <ActiveRideSheet
            booking={activeBooking}
            onUpdateStatus={handleRideStatusUpdate}
            onOpenChat={() => setShowChatModal(true)}
            theme="dark"
          />
        )}

        {/* In-Ride Chauffeur <-> Rider Messaging Modal */}
        {activeBooking && (
          <InRideChatModal
            visible={showChatModal}
            onClose={() => setShowChatModal(false)}
            bookingId={activeBooking.id}
            bookingReference={activeBooking.reference}
            customerName={activeBooking.customer_name || 'Executive Passenger'}
            driverName={driver?.full_name || 'Ramesh Kumar'}
            driverPhone={driver?.phone || '+91 98765 43210'}
            currentUserLocation={{
              lat: driverLocation.latitude,
              lng: driverLocation.longitude,
            }}
            senderRole="driver"
          />
        )}

        {/* Incoming Dispatch Broadcast Modal */}
        <IncomingRideModal
          booking={incomingBooking}
          onAccept={handleAcceptRide}
          onDecline={handleDeclineRide}
          theme="dark"
        />

        {/* Scheduled Rides Modal */}
        <ScheduledRidesModal
          visible={showScheduledModal}
          onClose={() => setShowScheduledModal(false)}
          driverId={driver?.id || DEMO_DRIVER.id}
          onClaimScheduledRide={handleClaimScheduledRide}
          theme="dark"
        />

        {/* Driver Earnings & Payouts Modal */}
        <DriverEarningsModal
          visible={showEarningsModal}
          onClose={() => setShowEarningsModal(false)}
          driverId={driver?.id || DEMO_DRIVER.id}
          theme="dark"
        />

        {/* Chauffeur Profile & Vehicle Modal */}
        {driver && (
          <DriverProfileModal
            visible={showProfileModal}
            driver={driver}
            onClose={() => setShowProfileModal(false)}
            onLogout={async () => {
              await AsyncStorage.removeItem('orange_taxi_driver');
              setShowProfileModal(false);
              setIsOnline(false);
              setDriver(null);
              // Auto-reinitialize demo on reload
              setTimeout(() => setDriver(DEMO_DRIVER), 500);
            }}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 16,
    fontWeight: '600',
  },
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  onlinePillActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  onlinePillInactive: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#475569',
  },
  onlineIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#64748B',
  },
  onlinePillText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  onlineTextActive: {
    color: '#10B981',
  },
  onlineTextInactive: {
    color: '#94A3B8',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  badgeIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F97316',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  earningsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  earningsPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  profileAvatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  idleBottomCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 15,
  },
  radarPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  radarRadarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  idleStatusTextCol: {
    flex: 1,
  },
  idleStatusTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  idleStatusSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  testDispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F97316',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  testDispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  quickMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  quickMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  quickMetricVal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  quickMetricLbl: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  quickMetricDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#334155',
  },
  offlineBottomCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 15,
    alignItems: 'center',
  },
  offlineIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  offlineTextCol: {
    alignItems: 'center',
    marginBottom: 16,
  },
  offlineCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  offlineCardSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  goOnlineBigBtn: {
    backgroundColor: '#10B981',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  goOnlineBigBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
