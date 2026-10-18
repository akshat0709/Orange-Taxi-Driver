import "./src/i18n";
import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
  Platform,
  Linking,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Device from 'expo-device';

import Constants from 'expo-constants';



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
  WifiOff,
  Coffee,
} from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';

import { supabase } from './src/lib/supabase';
import { Driver, Booking, DriverStats } from './src/types';
import { DriverMap } from './src/components/DriverMap';
import { IncomingRideModal } from './src/components/IncomingRideModal';
import { ActiveRideSheet } from './src/components/ActiveRideSheet';
import { ScheduledRidesModal } from './src/components/ScheduledRidesModal';
import { DriverEarningsModal } from './src/components/DriverEarningsModal';
import { DriverProfileModal } from './src/components/DriverProfileModal';
import { InRideChatModal } from './src/components/InRideChatModal';
import { ChauffeurAuthModal } from './src/components/ChauffeurAuthModal';
import { CoolCarSplashScreen } from './src/components/CoolCarSplashScreen';
import { formatRupees, round2 } from './src/lib/formatters';
import { soundService } from './src/lib/soundService';
import { resolveBookingTargetCoords } from './src/lib/locationResolver';
import { registerForDriverPushNotificationsAsync, sendDriverLocalNotification } from './src/lib/notificationService';
import { getTodayOnlineDutySeconds, recordChauffeurOnline, recordChauffeurOffline } from './src/lib/dutyTracker';

import * as TaskManager from 'expo-task-manager';




const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations[0];
    if (loc) {
      // Sync to supabase
      const saved = await AsyncStorage.getItem('orange_taxi_driver');
      if (saved) {
        const driver = JSON.parse(saved);
        if (driver.is_online) {
          try {
            await supabase.from('drivers').update({
              current_lat: loc.coords.latitude,
              current_lng: loc.coords.longitude,
              location_updated_at: new Date().toISOString(),
            }).eq('id', driver.id);
          } catch(e) {}
        }
      }
    }
  }
});


const { width } = Dimensions.get('window');

const INITIAL_STATS: DriverStats = {
  todayEarnings: 0,
  todayTrips: 0,
  todayHours: 0,
  cashCollected: 0,
  rating: 0,
  acceptanceRate: 0,
};




function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Orange Taxi Driver caught runtime error:", error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={driverErrorStyles.container}>
          <Text style={driverErrorStyles.emoji}>🚖</Text>
          <Text style={driverErrorStyles.title}>Orange Chauffeur</Text>
          <Text style={driverErrorStyles.subtitle}>
            An unexpected error occurred. Tap below to reload the app cleanly.
          </Text>
          <TouchableOpacity style={driverErrorStyles.button} onPress={this.handleRestart}>
            <Text style={driverErrorStyles.buttonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const driverErrorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D11',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F97316',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

function MainChauffeurApp() {
  // Splash & Authentication state
  const [showSplash, setShowSplash] = useState(true);
  const showSplashRef = useRef(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const driverRef = useRef<Driver | null>(null);
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const isAcceptingRideRef = useRef(false);

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

  // Driver Statistics (Calculated live from Supabase completed rides)
  const [stats, setStats] = useState<DriverStats>(INITIAL_STATS);

  // Modals
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  const [isNetworkOffline, setIsNetworkOffline] = useState(false);
  const [showRestAdvisory, setShowRestAdvisory] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<number>(Date.now());

  // Listen to network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsNetworkOffline(state.isConnected === false);
    });
    registerForDriverPushNotificationsAsync().catch(() => {});
    soundService.configureAudioMode().catch(() => {});
    return () => unsubscribe();
  }, []);

  // Tunnel Mode / Offline Action Queue Replay
  useEffect(() => {
    if (isNetworkOffline) return;

    const replayQueue = async () => {
      try {
        const stored = await AsyncStorage.getItem('@orange_offline_action_queue');
        if (!stored) return;
        const queue: Array<{ bookingId: string; updates: any }> = JSON.parse(stored);
        if (!Array.isArray(queue) || queue.length === 0) return;

        for (const item of queue) {
          try {
            await supabase.from('bookings').update(item.updates).eq('id', item.bookingId);
          } catch (e) {}
        }
        await AsyncStorage.removeItem('@orange_offline_action_queue');
      } catch (e) {}
    };

    replayQueue();
    const interval = setInterval(replayQueue, 8000);
    return () => clearInterval(interval);
  }, [isNetworkOffline]);

  // Track continuous online duty for fatigue prevention (MV Aggregator Guidelines)
  useEffect(() => {
    if (!isOnline) {
      setShiftStartTime(Date.now());
      return;
    }
    const interval = setInterval(() => {
      const elapsedHours = (Date.now() - shiftStartTime) / (1000 * 60 * 60);
      if (elapsedHours >= 8) {
        setShowRestAdvisory(true);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [isOnline, shiftStartTime]);

  // Live ticker for online duty hours (updates in real time while online)
  useEffect(() => {
    if (!isOnline) return;

    // Immediately calculate and update duty hours
    getTodayOnlineDutySeconds(true).then((sec) => {
      const hours = round2(sec / 3600);
      setStats((prev) => (prev ? { ...prev, todayHours: hours } : prev));
    });

    const interval = setInterval(async () => {
      const totalSec = await getTodayOnlineDutySeconds(true);
      const hours = round2(totalSec / 3600);
      setStats((prev) => {
        if (!prev) return prev;
        if (Math.abs((prev.todayHours || 0) - hours) >= 0.05) {
          return { ...prev, todayHours: hours };
        }
        return prev;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline]);

  // Load theme on mount
  useEffect(() => {
    AsyncStorage.getItem('@orange_driver_theme').then(saved => {
      if (saved === 'light' || saved === 'dark') setTheme(saved);
    });
  }, []);

  const handleToggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    await AsyncStorage.setItem('@orange_driver_theme', newTheme);
  };

  // Refs
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const locationUpdateTimer = useRef<any>(null);

  // Helper: Query driver's actual today's earnings & completed trips from Supabase
  const fetchTodayStats = async (driverId: string, currentDriver?: Driver | null) => {
    if (!driverId) return;
    try {
      const activeDriver = currentDriver || driver;
      const driverIds = [driverId];
      if (activeDriver?.id && !driverIds.includes(activeDriver.id)) {
        driverIds.push(activeDriver.id);
      }
      if (activeDriver?.user_id && !driverIds.includes(activeDriver.user_id)) {
        driverIds.push(activeDriver.user_id);
      }

      // Query completed bookings for this driver
      const { data: allBookings, error } = await supabase
        .from('bookings')
        .select('final_fare, estimated_fare, payment_method, completed_at, created_at, started_at, duration_min, status')
        .in('driver_id', driverIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch bookings from Supabase:', error);
      }

      const completed = allBookings || [];

      // Calculate start of today in local date
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

      // Filter today's completed rides
      const todayBookings = completed.filter((b) => {
        const timeStr = b.completed_at || b.created_at;
        if (!timeStr) return false;
        const bookingDate = new Date(timeStr);
        return bookingDate >= startOfToday;
      });

      const todayTrips = todayBookings.length;
      const todayRawTotal = todayBookings.reduce(
        (sum, b) => sum + (Number(b.final_fare) || Number(b.estimated_fare) || 0),
        0
      );
      // Net chauffeur earnings: 85% share
      const todayNetEarnings = round2(todayRawTotal * 0.85);

      const cashTotal = round2(
        todayBookings
          .filter((b) => b.payment_method === 'cash')
          .reduce((sum, b) => sum + (Number(b.final_fare) || Number(b.estimated_fare) || 0), 0)
      );

      // Lifetime completed trips count from bookings or driver profile
      const totalTripsCount = Math.max(
        completed.length,
        Number(activeDriver?.total_rides) || 0,
        Number(activeDriver?.total_trips) || 0
      );

      // All-time net earnings if driver has completed rides overall
      const allRawTotal = completed.reduce(
        (sum, b) => sum + (Number(b.final_fare) || Number(b.estimated_fare) || 0),
        0
      );
      const allNetEarnings = round2(allRawTotal * 0.85);

      // Calculate today's online duty hours accurately from duty tracker and verified rides
      const dutySec = await getTodayOnlineDutySeconds(isOnline);

      // Verify against actual passenger trip durations completed today
      const tripMinSum = todayBookings.reduce((sum, b) => {
        let mins = Number(b.duration_min) || 0;
        if (mins <= 0 && b.started_at && b.completed_at) {
          mins = Math.max(0, Math.round((new Date(b.completed_at).getTime() - new Date(b.started_at).getTime()) / 60000));
        }
        return sum + mins;
      }, 0);
      const tripSec = tripMinSum * 60;

      // Online duty cannot be less than time actually spent in passenger trips today
      const finalDutySec = Math.max(dutySec, tripSec);
      const dutyHours = round2(finalDutySec / 3600);

      // Strictly separate today's stats from all-time stats
      const updatedStats: DriverStats = {
        todayEarnings: todayNetEarnings, // Strictly earnings completed today!
        todayTrips: todayTrips,         // Strictly trips completed today!
        todayHours: dutyHours,
        cashCollected: cashTotal,
        rating: activeDriver?.rating || 5.0,
        acceptanceRate: 98,
        totalEarnings: allNetEarnings,  // Lifetime net earnings
        totalTrips: totalTripsCount,    // Lifetime total trips
      };

      setStats(updatedStats);
      await AsyncStorage.setItem('orange_driver_stats', JSON.stringify(updatedStats));
    } catch (err) {
      console.warn('Could not fetch today stats from Supabase:', err);
    }
  };

  // 1. Initialize Supabase Auth & Chauffeur Profile
  useEffect(() => {
    async function initAuth() {
      try {
        // Load cached stats first so UI has immediate data
        const savedStats = await AsyncStorage.getItem('orange_driver_stats');
        if (savedStats) {
          try {
            const parsed = JSON.parse(savedStats);
            if (parsed.todayEarnings === 2850) {
              parsed.todayEarnings = 0;
              parsed.todayTrips = 0;
              parsed.cashCollected = 0;
            }
            setStats(parsed);
          } catch {}
        }

        // 1. Immediately restore cached driver from storage
        const saved = await AsyncStorage.getItem('orange_taxi_driver');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.id) {
              setDriver(parsed);
              driverRef.current = parsed;
              const onlineState = parsed.is_online ?? true;
              setIsOnline(onlineState);
              if (onlineState) {
                recordChauffeurOnline().catch(() => {});
              } else {
                recordChauffeurOffline().catch(() => {});
              }
              fetchTodayStats(parsed.id, parsed).catch(() => {});
            }
          } catch {}
        }

        // 2. Refresh active session from Supabase in background
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadDriverFromSupabaseUser(session.user);
        } else if (!saved) {
          setDriver(null);
          driverRef.current = null;
        }
      } catch (err) {
        console.warn('Failed initializing Supabase session:', err);
      } finally {
        setAuthLoading(false);
      }
    }

    initAuth();

    // Listen to Supabase Auth State changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadDriverFromSupabaseUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setDriver(null);
        driverRef.current = null;
        await AsyncStorage.removeItem('orange_taxi_driver');
        setActiveBooking(null);
        setShowAuthModal(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSplashFinish = async () => {
    showSplashRef.current = false;
    setShowSplash(false);

    let activeDriver = driverRef.current;
    if (!activeDriver) {
      try {
        const saved = await AsyncStorage.getItem('orange_taxi_driver');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            activeDriver = parsed;
            setDriver(parsed);
            driverRef.current = parsed;
          }
        }
      } catch {}
    }

    if (!activeDriver) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadDriverFromSupabaseUser(session.user);
          return;
        }
      } catch {}
    }

    // Only show auth modal if chauffeur is truly not authenticated
    if (!activeDriver) {
      setShowAuthModal(true);
    }
  };

  // Helper: Load driver record and active rides from Supabase
  const loadDriverFromSupabaseUser = async (user: any) => {
    try {
      let driverProfile: Driver | null = null;

      // Primary: look up by user_id
      const { data: driverRow } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fallback: driver was approved before user_id was stored — match by email or phone
      let resolvedRow = driverRow;
      if (!resolvedRow) {
        const userEmail = user.email || '';
        const userPhone = user.phone || user.user_metadata?.phone || '';

        // Try match by email via profiles table first
        if (userEmail) {
          const { data: byEmail } = await supabase
            .from('drivers')
            .select('*')
            .ilike('phone', userPhone ? userPhone.replace(/\D/g, '') + '%' : '')
            .maybeSingle();
          // Also try joining through profiles
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', userEmail)
            .maybeSingle();
          if (profileRow) {
            const { data: byProfileId } = await supabase
              .from('drivers')
              .select('*')
              .eq('user_id', profileRow.id)
              .maybeSingle();
            if (byProfileId) resolvedRow = byProfileId;
          }
        }

        // Try match by phone number digits
        if (!resolvedRow && userPhone) {
          const digits = userPhone.replace(/\D/g, '');
          const { data: allDrivers } = await supabase
            .from('drivers')
            .select('*')
            .limit(200);
          if (allDrivers) {
            resolvedRow = allDrivers.find((d: any) =>
              d.phone && d.phone.replace(/\D/g, '').endsWith(digits.slice(-10))
            ) || null;
          }
        }

        // Self-heal: write user_id back so next login works instantly
        if (resolvedRow && !resolvedRow.user_id) {
          await supabase
            .from('drivers')
            .update({ user_id: user.id })
            .eq('id', resolvedRow.id);
          resolvedRow.user_id = user.id;
        }
      }

      const driverRowFinal = resolvedRow;

      if (driverRowFinal) {
        driverProfile = {
          id: driverRowFinal.id,
          user_id: user.id,
          full_name: driverRowFinal.full_name || 'Orange Chauffeur',
          phone: driverRowFinal.phone || user.phone || '',
          city: driverRowFinal.city || 'Bengaluru',
          vehicle_model: driverRowFinal.vehicle_model || 'No Vehicle Assigned',
          vehicle_number: driverRowFinal.vehicle_number || '',
          vehicle_type: driverRowFinal.vehicle_type || '',
          driver_type: driverRowFinal.driver_type || (driverRowFinal.vehicle_code?.includes('"type":"partner"') ? 'partner' : 'company'),
          vehicle_code: driverRowFinal.vehicle_code || '',
          is_online: driverRowFinal.is_online ?? true,
          current_lat: driverRowFinal.current_lat || 12.9716,
          current_lng: driverRowFinal.current_lng || 77.5946,
          rating: driverRowFinal.rating || 0,
          total_rides: driverRowFinal.total_rides || 0,
          total_trips: driverRowFinal.total_rides || 0,
          status: driverRowFinal.status || 'active',
          photo_url: driverRowFinal.photo_url || undefined,
          dl_url: driverRowFinal.dl_url || undefined,
        };
      } else {
        setIsPendingApproval(true);
        setAuthLoading(false);
        return;
      }

      setDriver(driverProfile);
      driverRef.current = driverProfile;
      setIsPendingApproval(false);
      setIsOnline(driverProfile.is_online);
      if (driverProfile.is_online) {
        await recordChauffeurOnline();
      } else {
        await recordChauffeurOffline();
      }
      setShowAuthModal(false);
      await AsyncStorage.setItem('orange_taxi_driver', JSON.stringify(driverProfile));

      // Calculate real today's earnings directly from Supabase
      await fetchTodayStats(driverProfile.id, driverProfile);

      // Check for any currently active ride assigned to this chauffeur in Supabase
      const { data: existingActive } = await supabase
        .from('bookings')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .in('status', ['accepted', 'arrived', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingActive) {
        setActiveBooking(existingActive as Booking);
      }
    } catch (err) {
      console.warn('Error loading driver profile from Supabase:', err);
    }
  };

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
        
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus === 'granted') {
          try {
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
          } catch (posErr) {
            console.log('Initial location fetch failed, waiting for watch updates:', posErr);
          }

          // Single active location watch
          locationSubscription.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
            async (loc) => {
              if (!isMounted || !loc?.coords) return;
              setDriverLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                heading: loc.coords.heading || 0,
              });
              try {
                const saved = await AsyncStorage.getItem('orange_taxi_driver');
                if (saved) {
                  const d = JSON.parse(saved);
                  if (d?.id) {
                    await supabase.from('drivers').update({
                      current_lat: loc.coords.latitude,
                      current_lng: loc.coords.longitude,
                      location_updated_at: new Date().toISOString(),
                    }).eq('id', d.id);
                  }
                }
              } catch (e) {}
            }
          );
          
          try {
            if (Platform.OS === 'android' && __DEV__) {
              console.log('Skipping background location in Expo Go Android to avoid warnings.');
            } else {
              const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
              if (bgStatus === 'granted') {
                await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                  accuracy: Location.Accuracy.Balanced,
                  timeInterval: 15000,
                  distanceInterval: 20,
                  showsBackgroundLocationIndicator: true,
                  foregroundService: {
                    notificationTitle: 'Orange Chauffeur Active',
                    notificationBody: 'Broadcasting live location for dispatches.',
                    notificationColor: '#F97316',
                  }
                });
              }
            }
          } catch (e) {
            console.log('Background location error, falling back to foreground only', e);
          }
        }
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

  // 3. Periodic Driver Telemetry Sync to Supabase Database
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
            location_updated_at: new Date().toISOString(),
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

  // Helper: Trigger Incoming Ride with Passenger Profile Enrichment and Dispatch Sound
  const triggerIncomingBookingAlert = async (booking: Booking) => {
    // Avoid double triggering if already ringing for the same booking
    if (incomingBooking?.id === booking.id) return;

    let enrichedBooking: Booking = { ...booking };

    // Fetch passenger profile from Supabase profiles table if customer_id exists
    if (booking.customer_id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', booking.customer_id)
          .maybeSingle();

        if (profile) {
          if (profile.full_name) enrichedBooking.customer_name = profile.full_name;
          if (profile.phone) enrichedBooking.customer_phone = profile.phone;
        }
      } catch (err) {
        console.warn('Could not enrich passenger profile:', err);
      }
    }

    if (!enrichedBooking.customer_name) enrichedBooking.customer_name = 'Executive Passenger';
    if (!enrichedBooking.customer_phone) enrichedBooking.customer_phone = '+91 98450 00000';

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    // Play energetic alert chime immediately
    await soundService.playDispatchAlert();
    setIncomingBooking(enrichedBooking);

    // Send local push notification
    sendDriverLocalNotification(
      '⚡ New Passenger Ride Request!',
      `${enrichedBooking.pickup_area} ➔ ${enrichedBooking.drop_area} (₹${formatRupees(enrichedBooking.estimated_fare)})`,
      { bookingId: enrichedBooking.id }
    );
  };

  // 4. Supabase Realtime Channel & Polling Fallback for Incoming Passenger Dispatches
  useEffect(() => {
    if (!isOnline || !driver) return;

    // Check for pending unassigned dispatches from Supabase
    const checkForPendingDispatches = async () => {
      if (activeBooking || incomingBooking) return;
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: searchingBookings, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('status', 'searching')
          .is('driver_id', null)
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && searchingBookings && searchingBookings.length > 0) {
          const now = Date.now();
          const declinesStr = await AsyncStorage.getItem("orange_declines");
          let declines: Record<string, any> = {};
          try {
            if (declinesStr) declines = JSON.parse(declinesStr);
          } catch(e) {}

          for (const cand of searchingBookings) {
            const candidate = cand as Booking;
            // 5km check
            const cleanAddress = candidate.pickup_address ? candidate.pickup_address.split('|')[0] : '';
            const [pLat, pLng] = cleanAddress ? cleanAddress.split(',').map(Number) : [null, null];
            
            const effectiveLat = driverLocation?.latitude || driver.current_lat;
            const effectiveLng = driverLocation?.longitude || driver.current_lng;
            
            if (effectiveLat && effectiveLng && pLat && !isNaN(pLng as number)) {
              const d = getDistanceInKm(effectiveLat, effectiveLng, pLat, pLng as number);
              if (d > 5) continue;
            }

            // Decline check
            const dec = declines[candidate.id];
            if (dec) {
              if (dec.count >= 2) continue;
              if (dec.count === 1 && (now - dec.lastDeclinedAt < 30000)) continue;
            }

            if (!activeBooking && !incomingBooking) {
              await triggerIncomingBookingAlert(candidate);
              break;
            }
          }
        }
      } catch (err) {
        // Silent catch for network hiccups
      }
    };

    // Run check immediately on going online
    checkForPendingDispatches();

    // Polling fallback every 3 seconds to guarantee no missed rides
    const pollTimer = setInterval(checkForPendingDispatches, 15000);

    // Supabase Realtime Channel for Instant Broadcasts
    const channel = supabase
      .channel('driver-booking-broadcasts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        async (payload) => {
          const newBooking = payload.new as Booking;
          if (!newBooking) return;

          // If a new booking is searching and not assigned
          if (
            newBooking.status === 'searching' &&
            !newBooking.driver_id &&
            !activeBooking &&
            !incomingBooking
          ) {
            let skip = false;
            const cleanAddress = newBooking.pickup_address ? newBooking.pickup_address.split('|')[0] : '';
            const [nLat, nLng] = cleanAddress ? cleanAddress.split(',').map(Number) : [null, null];
            
            const effectiveLat = driverLocation?.latitude || driver.current_lat;
            const effectiveLng = driverLocation?.longitude || driver.current_lng;
            
            if (effectiveLat && effectiveLng && nLat && !isNaN(nLng as number)) {
              const d = getDistanceInKm(effectiveLat, effectiveLng, nLat, nLng as number);
              if (d > 5) skip = true;
            }
            if (!skip) {
              try {
                const decsStr = await AsyncStorage.getItem("orange_declines");
                const decs = decsStr ? JSON.parse(decsStr) : {};
                const dec = decs[newBooking.id];
                const now = Date.now();
                if (dec) {
                  if (dec.count >= 2) skip = true;
                  else if (dec.count === 1 && (now - dec.lastDeclinedAt < 30000)) skip = true;
                }
              } catch (e) {}
            }
            if (!skip && !declinedBookingIds.includes(newBooking.id)) {
              await triggerIncomingBookingAlert(newBooking);
            }
          }

          // If active or incoming booking is cancelled by rider
          if (newBooking.status === 'cancelled') {
            if (incomingBooking && newBooking.id === incomingBooking.id) {
              await soundService.stopDispatchAlert();
              setIncomingBooking(null);
              Alert.alert('Trip Cancelled', 'The passenger has cancelled this request.');
            }
            if (activeBooking && newBooking.id === activeBooking.id) {
              Alert.alert('Trip Cancelled', 'The passenger has cancelled this booking.');
              setActiveBooking(null);
            }
          }

          // If incoming booking was accepted by another driver in real-time
          if (
            incomingBooking &&
            newBooking.id === incomingBooking.id &&
            newBooking.status === 'accepted' &&
            newBooking.driver_id &&
            newBooking.driver_id !== driver?.id
          ) {
            await soundService.stopDispatchAlert();
            setIncomingBooking(null);
            setDeclinedBookingIds((prev) => [...prev, newBooking.id]);
            Alert.alert(
              'Ride Taken',
              'Another chauffeur accepted this request. Returning to dispatch radar...'
            );
          }
          
          // Update active booking live (e.g. if passenger pays mid-ride)
          if (activeBooking && newBooking.id === activeBooking.id && newBooking.status !== 'cancelled') {
            setActiveBooking((prev) => prev ? { ...prev, ...newBooking } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [isOnline, driver, driverLocation, activeBooking, incomingBooking, declinedBookingIds]);

  // Toggle Online/Offline in Supabase
  const handleToggleOnline = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    if (nextState) {
      await recordChauffeurOnline();
    } else {
      await recordChauffeurOffline();
      await soundService.stopDispatchAlert();
      setIncomingBooking(null);
    }

    if (driver) {
      const updated = { ...driver, is_online: nextState };
      setDriver(updated);
      await AsyncStorage.setItem('orange_taxi_driver', JSON.stringify(updated));

      // Update directly in Supabase database
      await supabase
        .from('drivers')
        .update({
          is_online: nextState,
          location_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.id);

      await fetchTodayStats(driver.id, updated);
    }
  };

  const handleRideAlreadyClaimed = async (bookingId: string) => {
    await soundService.stopDispatchAlert();
    setIncomingBooking(null);
    setDeclinedBookingIds((prev) => [...prev, bookingId]);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
    Alert.alert(
      'Ride Already Claimed',
      'Another chauffeur accepted this ride just before you. Your console is active and ready for the next dispatch.'
    );
  };

  // Accept Ride Handler in Supabase with Atomic Concurrency Lock
  const handleAcceptRide = async (booking: Booking) => {
    if (isAcceptingRideRef.current) return;
    isAcceptingRideRef.current = true;

    try {
      const driverId = driver?.id;
      if (!driverId) {
        Alert.alert('Notice', 'Chauffeur profile not ready. Please try again.');
        return;
      }

      // Atomic conditional update: only locks if status is STILL 'searching' and unassigned
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'accepted',
          driver_id: driverId,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .eq('status', 'searching')
        .is('driver_id', null)
        .select()
        .maybeSingle();

      if (error && error.code === '23503') {
        // FK edge-case fallback with the same atomic row-locking constraint
        const { data: fallbackData } = await supabase
          .from('bookings')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', booking.id)
          .eq('status', 'searching')
          .is('driver_id', null)
          .select()
          .maybeSingle();

        if (!fallbackData) {
          await handleRideAlreadyClaimed(booking.id);
          return;
        }

        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        await soundService.playAcceptChime();
        setActiveBooking(fallbackData as Booking);
        setIncomingBooking(null);
        sendDriverLocalNotification(
          '🚗 Ride Confirmed!',
          `Proceed to pickup bay: ${booking.pickup_area}`,
          { bookingId: booking.id }
        );
        return;
      }

      if (!data) {
        // 0 rows updated: another chauffeur acquired the lock first!
        await handleRideAlreadyClaimed(booking.id);
        return;
      }

      // Lock successfully acquired! Sole winner.
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      await soundService.playAcceptChime();

      setActiveBooking(data as Booking);
      setIncomingBooking(null);
      sendDriverLocalNotification(
        '🚗 Ride Confirmed!',
        `Proceed to pickup bay: ${booking.pickup_area}`,
        { bookingId: booking.id }
      );
    } catch (err: any) {
      console.warn('Error accepting ride:', err);
      Alert.alert('Notice', 'Unable to accept ride. Please check network.');
    } finally {
      isAcceptingRideRef.current = false;
    }
  };

  // Decline Ride Handler
  const handleDeclineRide = async (booking: Booking) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await soundService.stopDispatchAlert();
    setDeclinedBookingIds((prev) => [...prev, booking.id]);
    
    try {
      const decsStr = await AsyncStorage.getItem("orange_declines");
      const decs = decsStr ? JSON.parse(decsStr) : {};
      const count = decs[booking.id]?.count || 0;
      decs[booking.id] = {
        count: count + 1,
        lastDeclinedAt: Date.now()
      };
      await AsyncStorage.setItem("orange_declines", JSON.stringify(decs));
    } catch(e) {}

    setIncomingBooking(null);
  };

  // Status Transitions (Arrived, OTP Verify, Completed) in Supabase
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

    const enqueueOffline = async (bookingId: string, upd: Partial<Booking>) => {
      try {
        const stored = await AsyncStorage.getItem('@orange_offline_action_queue');
        const queue = stored ? JSON.parse(stored) : [];
        queue.push({ bookingId, updates: upd, timestamp: Date.now() });
        await AsyncStorage.setItem('@orange_offline_action_queue', JSON.stringify(queue));
      } catch (e) {}
    };

    if (newStatus === 'arrived') {
      updates.arrived_at = new Date().toISOString();
      if (isNetworkOffline) {
        await enqueueOffline(activeBooking.id, updates);
      } else {
        try {
          await supabase.from('bookings').update(updates).eq('id', activeBooking.id);
        } catch {
          await enqueueOffline(activeBooking.id, updates);
        }
      }
    } else if (newStatus === 'in_progress') {
      updates.started_at = new Date().toISOString();
      if (isNetworkOffline) {
        await enqueueOffline(activeBooking.id, updates);
      } else {
        try {
          await supabase.from('bookings').update(updates).eq('id', activeBooking.id);
        } catch {
          await enqueueOffline(activeBooking.id, updates);
        }
      }
    } else if (newStatus === 'completed') {
      const finalFare = round2(activeBooking.final_fare || activeBooking.estimated_fare);
      updates.completed_at = new Date().toISOString();
      updates.final_fare = finalFare;

      const rawPaymentMade = String(activeBooking.payment_made ?? extraUpdates?.payment_made ?? '').trim().toLowerCase();
      const isExplicitlyNo = rawPaymentMade === 'no' || activeBooking.payment_made === false || extraUpdates?.payment_made === false;
      const isExplicitlyYes = rawPaymentMade === 'yes' || activeBooking.payment_made === true || extraUpdates?.payment_made === true;

      const isPaidOnline = isExplicitlyNo
        ? false
        : isExplicitlyYes
        ? true
        : activeBooking.payment_method === 'cash' || activeBooking.payment_method === 'driver_upi'
        ? false
        : activeBooking.payment_status === 'paid' || activeBooking.payment_status === 'paid_online' || activeBooking.payment_method === 'wallet';

      updates.payment_status = isPaidOnline ? 'paid' : (extraUpdates?.payment_status || 'pending');
      updates.payment_made = isPaidOnline ? 'yes' : 'no';

      if (isNetworkOffline) {
        await enqueueOffline(activeBooking.id, updates);
      } else {
        // Deduct from customer wallet if payment method is wallet
        if (activeBooking.payment_method === 'wallet' && activeBooking.customer_id) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('wallet_balance')
              .eq('id', activeBooking.customer_id)
              .single();
            if (profile) {
              const currentBal = profile.wallet_balance || 0;
              await supabase
                .from('profiles')
                .update({ wallet_balance: Math.max(0, currentBal - finalFare) })
                .eq('id', activeBooking.customer_id);
            }
          } catch (err) {
            console.warn('Wallet deduction failed:', err);
          }
        }

        // Persist directly to Supabase bookings table
        try {
          const { error: updErr } = await supabase.from('bookings').update(updates).eq('id', activeBooking.id);
          if (updErr && updErr.message && updErr.message.includes('payment_made')) {
            const safeUpdates = { ...updates };
            delete safeUpdates.payment_made;
            await supabase.from('bookings').update(safeUpdates).eq('id', activeBooking.id);
          }
        } catch {
          await enqueueOffline(activeBooking.id, updates);
        }

        // Re-fetch driver's real today stats directly from Supabase
        const currentDriverId = activeBooking.driver_id || driver?.id;
        if (currentDriverId) await fetchTodayStats(currentDriverId, driver);
      }
    }

    setActiveBooking((prev) => (prev ? { ...prev, ...updates } : null));
  };

  // Finish Ride Handler (called when chauffeur taps "READY FOR NEXT RIDE")
  const handleFinishRide = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setActiveBooking(null);
    const currentDriverId = driver?.id;
    if (currentDriverId) await fetchTodayStats(currentDriverId, driver);
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



  // Cool Car Animated Splash Screen (Renders immediately on startup)
  if (showSplash) {
    return (
      <SafeAreaProvider>
        <CoolCarSplashScreen
          appType="driver"
          onFinish={handleSplashFinish}
        />
      </SafeAreaProvider>
    );
  }

  // Loading State
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Connecting to Supabase Fleet Node...</Text>
      </View>
    );
  }

  if (isPendingApproval) {
    const isLight = theme === 'light';
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={isLight ? '#FFFFFF' : '#0F172A'} />
        <View style={[styles.container, isLight && styles.containerLight, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
          <Shield size={64} color="#F97316" style={{ marginBottom: 24 }} />
          <Text style={[{ color: '#FFF', fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' }, isLight && { color: '#0F172A' }]}>
            Pending Approval
          </Text>
          <Text style={[{ color: '#94A3B8', fontSize: 16, textAlign: 'center', marginBottom: 48, lineHeight: 24 }, isLight && { color: '#64748B' }]}>
            Your application is currently under review by Orange Taxi Admin. Please check back later.
          </Text>
          <TouchableOpacity
            style={styles.goOnlineBigBtn}
            onPress={async () => {
              await supabase.auth.signOut();
              await AsyncStorage.removeItem('orange_taxi_driver');
              setIsPendingApproval(false);
              setShowAuthModal(true);
            }}
          >
            <Text style={styles.goOnlineBigBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={[styles.container, theme === 'light' && { backgroundColor: '#F8FAFC' }]}>
        <StatusBar barStyle={theme === 'dark' ? "light-content" : "dark-content"} backgroundColor={theme === 'dark' ? "#0F172A" : "#F8FAFC"} />

        {/* Fullscreen Map Layer */}
        <DriverMap
          driverCoords={{
            lat: driverLocation.latitude,
            lng: driverLocation.longitude,
            heading: driverLocation.heading,
          }}
          targetCoords={
            activeBooking
              ? resolveBookingTargetCoords(activeBooking, {
                  lat: driverLocation.latitude,
                  lng: driverLocation.longitude,
                })
              : null
          }
          status={activeBooking?.status || (isOnline ? 'idle' : 'offline')}
          theme={theme}
        />

        {/* Top Header Controls Overlay */}
        <SafeAreaView edges={['top']} style={styles.topSafeArea}>
          {isNetworkOffline && (
            <View style={styles.offlineBanner}>
              <WifiOff size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.offlineBannerText}>
                Cellular Signal Lost · Reconnecting to Dispatch Network...
              </Text>
            </View>
          )}
          <View style={styles.topHeaderBar}>
            {/* Online / Offline Switch Pill */}
            <TouchableOpacity
              style={[
                styles.onlinePill, theme === 'light' && styles.onlinePillLight,
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
                style={[styles.headerIconBtn, theme === 'light' && styles.headerIconBtnLight]}
                onPress={() => setShowScheduledModal(true)}
                activeOpacity={0.7}
              >
                <Calendar size={18} color={theme === 'light' ? "#0F172A" : "#F8FAFC"} />
                {claimedScheduledRides.length > 0 && (
                  <View style={styles.badgeIndicator}>
                    <Text style={styles.badgeIndicatorText}>{claimedScheduledRides.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Earnings Shortcut - Formatted strictly to 2 decimal places */}
              <TouchableOpacity
                style={[styles.earningsPill, theme === 'light' && styles.earningsPillLight]}
                onPress={() => setShowEarningsModal(true)}
                activeOpacity={0.7}
              >
                <Wallet size={15} color="#F97316" />
                <Text style={[styles.earningsPillText, theme === 'light' && styles.textDark]}>₹{formatRupees(stats.todayEarnings)}</Text>
              </TouchableOpacity>

              

              {/* Profile Avatar */}
              <TouchableOpacity
                style={[styles.profileAvatarBtn, { overflow: 'hidden' }]}
                onPress={() => setShowProfileModal(true)}
                activeOpacity={0.7}
              >
                {driver?.photo_url ? (
                  <Image source={{ uri: driver.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarLetter}>
                    {driver?.full_name ? driver.full_name.charAt(0).toUpperCase() : 'R'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Offline / Tunnel Mode Indicator */}
        {isNetworkOffline && (
          <View style={{
            position: 'absolute',
            top: 100,
            left: 16,
            right: 16,
            backgroundColor: '#B45309',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 9,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            zIndex: 9999,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 8,
          }}>
            <WifiOff size={18} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                Offline Tunnel Mode Active
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}>
                Status updates queue locally and sync automatically when signal returns.
              </Text>
            </View>
          </View>
        )}

        {/* Idle Floating Bar when Online & No Active Trip */}
        {isOnline && !activeBooking && (
          <View style={[styles.idleBottomCard, theme === 'light' && styles.idleBottomCardLight]}>
            <View style={styles.radarPulseRow}>
              <View style={styles.radarRadarBox}>
                <Radio size={20} color="#F97316" />
              </View>
              <View style={styles.idleStatusTextCol}>
                <Text style={[styles.idleStatusTitle, theme === 'light' && styles.textDark]}>Searching for Premium Dispatches</Text>
                <Text style={styles.idleStatusSubtitle}>
                  Connected to Supabase • Realtime Fleet Dispatch Active
                </Text>
              </View>
            </View>

            {/* Quick Metrics Bar - Today's Performance */}
            <View style={[styles.quickMetricsRow, theme === 'light' && styles.quickMetricsRowLight]}>
              <View style={styles.quickMetricCol}>
                <Text style={[styles.quickMetricVal, theme === 'light' && styles.textDark]}>₹{formatRupees(stats.todayEarnings)}</Text>
                <Text style={styles.quickMetricLbl}>Today's Net</Text>
              </View>
              <View style={styles.quickMetricDivider} />
              <View style={styles.quickMetricCol}>
                <Text style={[styles.quickMetricVal, theme === 'light' && styles.textDark]}>{stats.todayTrips}</Text>
                <Text style={styles.quickMetricLbl}>Today's Trips</Text>
              </View>
              <View style={styles.quickMetricDivider} />
              <View style={styles.quickMetricCol}>
                <Text style={[styles.quickMetricVal, theme === 'light' && styles.textDark]}>{Number(stats.todayHours || 0).toFixed(1)} hrs</Text>
                <Text style={styles.quickMetricLbl}>Online Duty</Text>
              </View>
              <View style={styles.quickMetricDivider} />
              <View style={styles.quickMetricCol}>
                <Text style={[styles.quickMetricVal, theme === 'light' && styles.textDark]}>★ {(driver?.rating || stats.rating || 5.0).toFixed(1)}</Text>
                <Text style={styles.quickMetricLbl}>Rating</Text>
              </View>
            </View>
          </View>
        )}

        {/* Offline Banner when Chauffeur is Offline */}
        {!isOnline && (
          <View style={[styles.offlineBottomCard, theme === 'light' && styles.offlineCardLight]}>
            <View style={styles.offlineIconBox}>
              <Power size={24} color={theme === 'light' ? "#64748B" : "#94A3B8"} />
            </View>
            <View style={styles.offlineTextCol}>
              <Text style={[styles.offlineCardTitle, theme === 'light' && styles.textDark]}>You are currently Offline</Text>
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
            onFinishRide={handleFinishRide}
            onOpenChat={() => setShowChatModal(true)}
            theme={theme}
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
            theme={theme}
          />
        )}

        {/* Incoming Dispatch Broadcast Modal */}
        <IncomingRideModal
          booking={incomingBooking}
          onAccept={handleAcceptRide}
          onDecline={handleDeclineRide}
          theme={theme}
        />

        {/* Scheduled Rides Modal */}
        <ScheduledRidesModal
          visible={showScheduledModal}
          onClose={() => setShowScheduledModal(false)}
          driverId={driver?.id!}
          onClaimScheduledRide={handleClaimScheduledRide}
          theme={theme}
        />

        {/* Driver Earnings & Payouts Modal */}
        <DriverEarningsModal
          visible={showEarningsModal}
          onClose={() => setShowEarningsModal(false)}
          driverId={driver?.id!}
          driver={driver}
          theme={theme}
        />

        {/* Chauffeur Profile & Vehicle Modal */}
        {driver && (
          <DriverProfileModal
            visible={showProfileModal}
            driver={driver}
            stats={stats}
            onClose={() => setShowProfileModal(false)}
            onLogout={async () => {
              await supabase.auth.signOut();
              await AsyncStorage.removeItem('orange_taxi_driver');
              setShowProfileModal(false);
              setIsOnline(false);
              setDriver(null);
              setShowAuthModal(true);
            }}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {/* Chauffeur Authentication Modal */}
        <ChauffeurAuthModal
          visible={showAuthModal}
          onSuccess={async (authenticatedDriver) => {
            setDriver(authenticatedDriver);
            driverRef.current = authenticatedDriver;
            setIsOnline(true);
            setShowAuthModal(false);
            await AsyncStorage.setItem('orange_taxi_driver', JSON.stringify(authenticatedDriver));
            await recordChauffeurOnline();
            await fetchTodayStats(authenticatedDriver.id, authenticatedDriver);
          }}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Driver Fatigue Rest Advisory Modal (MV Aggregator Guidelines 2025) */}
        <Modal visible={showRestAdvisory} animationType="slide" transparent>
          <View style={styles.advisoryOverlay}>
            <View style={[styles.advisoryCard, theme === 'light' && styles.advisoryCardLight]}>
              <View style={styles.advisoryIconWrap}>
                <Coffee size={32} color="#F97316" />
              </View>
              <Text style={[styles.advisoryTitle, theme === 'light' && { color: '#0F172A' }]}>
                Chauffeur Safety Rest Advisory
              </Text>
              <Text style={[styles.advisoryDesc, theme === 'light' && { color: '#64748B' }]}>
                You have been online for over 8 continuous hours. Under the Motor Vehicle Aggregator Guidelines, chauffeurs must take a 30-minute rest break to prevent driving fatigue and ensure road safety.
              </Text>
              <TouchableOpacity
                style={styles.advisoryRestBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsOnline(false);
                  setShowRestAdvisory(false);
                  setShiftStartTime(Date.now());
                }}
              >
                <Text style={styles.advisoryRestBtnText}>GO OFFLINE & TAKE A BREAK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginTop: 14, paddingVertical: 8 }}
                onPress={() => {
                  setShowRestAdvisory(false);
                  setShiftStartTime(Date.now());
                }}
              >
                <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', fontWeight: '600' }}>
                  Dismiss (I have already rested)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  offlineBanner: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  offlineBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  advisoryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  advisoryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  advisoryCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  advisoryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  advisoryTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  advisoryDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  advisoryRestBtn: {
    backgroundColor: '#F97316',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisoryRestBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
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
    overflow: 'hidden',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'center',
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
  textDark: { color: '#0F172A' },
  headerIconBtnLight: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  idleBottomCardLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
  offlineCardLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
  onlinePillLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
  earningsPillLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
  quickMetricsRowLight: { backgroundColor: '#F1F5F9' },
});

export default function App() {
  return (
    <AppErrorBoundary>
      <MainChauffeurApp />
    </AppErrorBoundary>
  );
}