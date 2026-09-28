import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Shield, Lock, Mail, Phone, User, Car, Zap, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { Driver } from '../types';

interface ChauffeurAuthModalProps {
  visible: boolean;
  onSuccess: (driver: Driver) => void;
  onContinueDemo: () => void;
}

export function ChauffeurAuthModal({
  visible,
  onSuccess,
  onContinueDemo,
}: ChauffeurAuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('Mahindra BE 6 EV');
  const [city, setCity] = useState('Bengaluru');
  const [loading, setLoading] = useState(false);

  // One-Tap Verified Chauffeur Quick Login
  const handleQuickChauffeurLogin = async () => {
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'chauffeur@orangetaxi.in',
        password: 'OrangeTaxi2026!',
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Fetch or build driver profile
        const { data: driverRow } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const driverProfile: Driver = {
          id: driverRow?.id || data.user.id,
          user_id: data.user.id,
          full_name: driverRow?.full_name || data.user.user_metadata?.full_name || 'Ramesh Kumar',
          phone: driverRow?.phone || data.user.user_metadata?.phone || '+91 98765 43210',
          city: driverRow?.city || 'Bengaluru',
          vehicle_model: driverRow?.vehicle_model || 'Mahindra BE 6 EV',
          vehicle_number: driverRow?.vehicle_number || 'DL 01 AB 1234',
          vehicle_type: 'BE 6 VIP SUV',
          is_online: true,
          current_lat: driverRow?.current_lat || 12.9716,
          current_lng: driverRow?.current_lng || 77.5946,
          rating: driverRow?.rating || 4.94,
          total_rides: driverRow?.total_rides || 1420,
          total_trips: driverRow?.total_rides || 1420,
          status: 'active',
        };

        onSuccess(driverProfile);
      }
    } catch (err: any) {
      Alert.alert('Chauffeur Authentication', err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Standard Email/Password Sign In
  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your Chauffeur email and password.');
      return;
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      if (data?.user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const { data: driverRow } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const driverProfile: Driver = {
          id: driverRow?.id || data.user.id,
          user_id: data.user.id,
          full_name: driverRow?.full_name || data.user.user_metadata?.full_name || 'Orange Chauffeur',
          phone: driverRow?.phone || data.user.user_metadata?.phone || '+91 98765 43210',
          city: driverRow?.city || city,
          vehicle_model: driverRow?.vehicle_model || 'Mahindra BE 6 EV',
          vehicle_number: driverRow?.vehicle_number || 'DL 01 AB 1234',
          vehicle_type: 'BE 6 VIP SUV',
          is_online: true,
          current_lat: driverRow?.current_lat || 12.9716,
          current_lng: driverRow?.current_lng || 77.5946,
          rating: driverRow?.rating || 4.94,
          total_rides: driverRow?.total_rides || 1420,
          total_trips: driverRow?.total_rides || 1420,
          status: 'active',
        };

        onSuccess(driverProfile);
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Sign Up New Chauffeur
  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !fullName.trim() || !phone.trim()) {
      Alert.alert('Required Fields', 'Please complete all chauffeur details.');
      return;
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: 'driver',
            vehicle_number: vehicleNumber.trim() || 'DL 01 EV 1001',
            vehicle_model: vehicleModel.trim() || 'Mahindra BE 6 EV',
            city,
          },
        },
      });

      if (error) throw error;

      if (data?.user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const driverProfile: Driver = {
          id: data.user.id,
          user_id: data.user.id,
          full_name: fullName.trim(),
          phone: phone.trim(),
          city,
          vehicle_model: vehicleModel.trim() || 'Mahindra BE 6 EV',
          vehicle_number: vehicleNumber.trim() || 'DL 01 EV 1001',
          vehicle_type: 'BE 6 VIP SUV',
          is_online: true,
          current_lat: 12.9716,
          current_lng: 77.5946,
          rating: 5.0,
          total_rides: 0,
          total_trips: 0,
          status: 'active',
        };

        onSuccess(driverProfile);
      }
    } catch (err: any) {
      Alert.alert('Registration Error', err.message || 'Could not register chauffeur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Brand Hero */}
          <View style={styles.brandHero}>
            <View style={styles.iconCircle}>
              <Shield size={32} color="#F97316" />
            </View>
            <Text style={styles.brandTitle}>Orange Chauffeur OS</Text>
            <Text style={styles.brandSubtitle}>
              Connected to Supabase Cloud Database • Live Fleet Node
            </Text>
          </View>

          {/* Quick 1-Tap Login Card */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={handleQuickChauffeurLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <View style={styles.quickCardHeader}>
              <View style={styles.quickZapCircle}>
                <Zap size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickCardTitle}>1-Tap Chauffeur Sign In</Text>
                <Text style={styles.quickCardSub}>Verified Ramesh Kumar • Mahindra BE 6 EV</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
              </View>
            </View>
            <Text style={styles.quickCardFooter}>
              Tap to authenticate instantly with live Supabase database credentials
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CUSTOM ACCOUNT</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, mode === 'signin' && styles.tabBtnActive]}
              onPress={() => setMode('signin')}
            >
              <Text style={[styles.tabBtnText, mode === 'signin' && styles.tabBtnTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, mode === 'signup' && styles.tabBtnActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.tabBtnText, mode === 'signup' && styles.tabBtnTextActive]}>
                Register Chauffeur
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {mode === 'signup' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputRow}>
                    <User size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Ramesh Kumar"
                      placeholderTextColor="#64748B"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Phone</Text>
                  <View style={styles.inputRow}>
                    <Phone size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="+91 98765 43210"
                      placeholderTextColor="#64748B"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Number Plate</Text>
                  <View style={styles.inputRow}>
                    <Car size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="DL 01 AB 1234"
                      placeholderTextColor="#64748B"
                      autoCapitalize="characters"
                      value={vehicleNumber}
                      onChangeText={setVehicleNumber}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Chauffeur Email</Text>
              <View style={styles.inputRow}>
                <Mail size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="chauffeur@orangetaxi.in"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputRow}>
                <Lock size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••••••"
                  placeholderTextColor="#64748B"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {/* Submit Action Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'signin' ? 'Sign In to Chauffeur Console' : 'Complete Registration'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Offline Demo Skip */}
            <TouchableOpacity
              style={styles.demoSkipBtn}
              onPress={onContinueDemo}
              activeOpacity={0.7}
            >
              <Text style={styles.demoSkipText}>Continue in Offline Simulator Mode</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1.5,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  quickCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#F97316',
    marginBottom: 20,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  quickCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickZapCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  quickCardSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  quickCardFooter: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginHorizontal: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#0F172A',
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#F97316',
    fontWeight: '900',
  },
  formContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#F97316',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  demoSkipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 6,
  },
  demoSkipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
