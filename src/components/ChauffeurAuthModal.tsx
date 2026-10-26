import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  StatusBar,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Shield, Lock, Mail, Phone, User, Car, Zap, CheckCircle2, Sun, Moon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { accountStatus } from '../lib/accountStatus';
import { resolveDriverRowForUser } from '../lib/driverIdentity';
import { Driver } from '../types';

interface ChauffeurAuthModalProps {
  visible: boolean;
  onSuccess: (driver: Driver) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export function ChauffeurAuthModal({
  visible,
  onSuccess,
  theme = 'dark',
  onToggleTheme,
}: ChauffeurAuthModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(theme);

  useEffect(() => {
    setCurrentTheme(theme);
  }, [theme]);

  const toggleTheme = async () => {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(nextTheme);
    await AsyncStorage.setItem('@orange_driver_theme', nextTheme);
    if (onToggleTheme) {
      onToggleTheme();
    }
  };

  const isLight = currentTheme === 'light';
  const iconColor = isLight ? '#64748B' : '#94A3B8';
  const placeholderColor = isLight ? '#94A3B8' : '#64748B';

  const [mode, setMode] = useState<'signin' | 'signup' | 'verify_otp'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpDigits, setOtpDigits] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpLockoutRemaining, setOtpLockoutRemaining] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cdlNumber, setCdlNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');

const handleAadhaarChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/\D/g, '');
    let masked = cleaned;
    
    // Mask first 8 digits as they are typed
    if (cleaned.length > 8) {
      masked = 'XXXX-XXXX-' + cleaned.substring(8, 12);
    } else if (cleaned.length > 4) {
      masked = 'XXXX-' + cleaned.substring(4, 8);
    }
    
    setAadhaarNumber(masked);
};

  const [yearsDriving, setYearsDriving] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [loading, setLoading] = useState(false);
  const [driverPhotoUrl, setDriverPhotoUrl] = useState('');
  const [documentsUrl, setDocumentsUrl] = useState('');
  const [ownsVehicle, setOwnsVehicle] = useState(false);
  const [showPartnerTermsModal, setShowPartnerTermsModal] = useState(false);
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [message, setMessage] = useState('');

  // KYC images go to the PRIVATE driver_kyc bucket under applications/ (the only prefix the
  // storage policy accepts before sign-up) and are stored as storage:// references that the admin
  // panel opens with signed URLs. The old code uploaded to the bucket root (now rejected) and saved
  // getPublicUrl() links, which do not work on a private bucket. Same scheme as the web form.
  const uploadKycImage = async (kind: 'photo' | 'dl'): Promise<string | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0]?.base64) return null;
    const random = Math.random().toString(36).slice(2, 10);
    const path = `applications/${Date.now()}_${kind}_${random}.jpg`;
    const { data, error } = await supabase.storage.from('driver_kyc').upload(path, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
    if (error || !data?.path) {
      Alert.alert('Upload Error', error?.message || 'Could not upload the image. Please try again.');
      return null;
    }
    return `storage://driver_kyc/${data.path}`;
  };

  const handleUploadDriverPhoto = async () => {
    const ref = await uploadKycImage('photo');
    if (ref) {
      setDriverPhotoUrl(ref);
      Alert.alert('Success', 'Driver photo uploaded successfully.');
    }
  };

  const handleUploadDocuments = async () => {
    const ref = await uploadKycImage('dl');
    if (ref) {
      setDocumentsUrl(ref);
      Alert.alert('Success', 'Documents uploaded successfully.');
    }
  };

  // Forgot Password
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email to reset your password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://orange-taxi.com/login?mode=reset',
      });
      if (error) throw error;
      Alert.alert('Reset Email Sent', 'Please check your email inbox for password reset instructions.');
    } catch (e: any) {
      Alert.alert('Reset Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  // 30-second Resend OTP Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Lockout countdown timer
  useEffect(() => {
    const checkLockout = async () => {
      try {
        const stored = await AsyncStorage.getItem('@orange_driver_otp_lockout');
        if (stored) {
          const diff = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
          if (diff > 0) {
            setOtpLockoutRemaining(diff);
          } else {
            setOtpLockoutRemaining(0);
            await AsyncStorage.removeItem('@orange_driver_otp_lockout');
          }
        }
      } catch {}
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyOtp = async () => {
    if (otpLockoutRemaining > 0) {
      Alert.alert('Verification Locked', `Too many failed attempts. Please wait ${otpLockoutRemaining} seconds.`);
      return;
    }
    const cleanOtp = otpDigits.trim();
    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanOtp,
        type: 'signup',
      });

      if (error) {
        const retry = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: cleanOtp,
          type: 'email',
        });
        if (!retry.error) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        const stored = await AsyncStorage.getItem('@orange_driver_otp_attempts');
        let attempts = stored ? parseInt(stored, 10) : 0;
        attempts++;
        if (attempts >= 5) {
          await AsyncStorage.setItem('@orange_driver_otp_lockout', (Date.now() + 60 * 1000).toString());
          await AsyncStorage.setItem('@orange_driver_otp_attempts', '0');
          setOtpLockoutRemaining(60);
          Alert.alert('Verification Locked', '5 unsuccessful attempts. Please wait 1 minute before trying again.');
        } else {
          await AsyncStorage.setItem('@orange_driver_otp_attempts', attempts.toString());
          Alert.alert('Verification Failed', `${error.message} (${5 - attempts} attempts remaining).`);
        }
        return;
      }

      await AsyncStorage.removeItem('@orange_driver_otp_attempts');
      await AsyncStorage.removeItem('@orange_driver_otp_lockout');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Email Verified!',
        'Your chauffeur account is verified. You can now sign in to access your Chauffeur Console.',
        [{ text: 'Continue to Sign In', onPress: () => setMode('signin') }]
      );
    } catch (err: any) {
      Alert.alert('Verification Error', err.message || 'Failed to verify code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !email.trim()) return;
    setLoading(true);
    try {
      let { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) {
        const retry = await supabase.auth.resend({
          type: 'email_change',
          email: email.trim(),
        });
        if (!retry.error) error = null;
      }
      if (error) throw error;
      setResendCooldown(30);
      Alert.alert('Code Sent', `A new 6-digit verification code has been sent to ${email.trim()}.`);
    } catch (err: any) {
      Alert.alert('Resend Failed', err.message || 'Could not resend verification code.');
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

      const storedLockout = await AsyncStorage.getItem('@orange_driver_lockout');
      if (storedLockout && parseInt(storedLockout) > Date.now()) {
        const remainingSeconds = Math.ceil((parseInt(storedLockout) - Date.now()) / 1000);
        Alert.alert('Account Locked', `Too many failed attempts. Please try again in ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}.`);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          setMode('verify_otp');
          setOtpDigits('');
          setResendCooldown(30);
          supabase.auth.resend({
            type: 'signup',
            email: email.trim(),
          }).catch(() => {});
          Alert.alert(
            'Email Verification Required',
            `A 6-digit verification code has been sent to ${email.trim()}. Please enter it below or tap the confirmation link in your email.`
          );
          setLoading(false);
          return;
        }

        // "Invalid login credentials" covers both a wrong password and no account at all.
        if (error.message?.toLowerCase().includes('invalid login credentials')) {
          const status = await accountStatus(email);
          if (status === 'none') {
            setMode('signup');
            Alert.alert('No Account Found', 'There is no chauffeur account with this email. Please create an account first.');
            setLoading(false);
            return;
          }
          if (status === 'unconfirmed') {
            setMode('verify_otp');
            setOtpDigits('');
            setResendCooldown(30);
            supabase.auth.resend({ type: 'signup', email: email.trim() }).catch(() => {});
            Alert.alert('Email Verification Required', `Please verify your email first. A new code has been sent to ${email.trim()}.`);
            setLoading(false);
            return;
          }
        }

        const storedAttempts = await AsyncStorage.getItem('@orange_driver_attempts');
        let attempts = storedAttempts ? parseInt(storedAttempts, 10) : 0;
        attempts++;
        if (attempts >= 5) {
          await AsyncStorage.setItem('@orange_driver_lockout', (Date.now() + 60 * 1000).toString());
          await AsyncStorage.setItem('@orange_driver_attempts', '0');
          Alert.alert('Account Locked', '5 unsuccessful attempts. Please wait 1 minute before trying again.');
        } else {
          await AsyncStorage.setItem('@orange_driver_attempts', attempts.toString());
          Alert.alert('Login Failed', `Incorrect credentials. ${5 - attempts} attempt${5 - attempts === 1 ? '' : 's'} remaining.`);
        }
        throw error;
      }

      await AsyncStorage.setItem('@orange_driver_attempts', '0');
      await AsyncStorage.removeItem('@orange_driver_lockout');

      if (data?.user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Bind only to a driver row linked to this account (or a legacy row matched on the
        // auth-verified phone). The old fallback trusted the phone typed in at sign-up.
        const driverRowFinal: any = await resolveDriverRowForUser(supabase, data.user);

        if (!driverRowFinal) {
          // No approved chauffeur profile: the app shows the "Pending Approval" screen via its
          // auth listener. Do not fabricate a profile and put the account online.
          Alert.alert(
            'Application Under Review',
            'Your chauffeur account has not been approved yet. You will be able to go online once Orange Taxi Admin approves it.'
          );
          return;
        }

        const driverProfile: Driver = {
          id: driverRowFinal?.id || data.user.id,
          user_id: data.user.id,
          full_name: driverRowFinal?.full_name || data.user.user_metadata?.full_name || 'Orange Chauffeur',
          phone: driverRowFinal?.phone || data.user.user_metadata?.phone || '',
          city: driverRowFinal?.city || city,
          vehicle_model: driverRowFinal?.vehicle_model || 'No Vehicle Assigned',
          vehicle_number: driverRowFinal?.vehicle_number || '',
          vehicle_type: driverRowFinal?.vehicle_type || '',
          is_online: true,
          current_lat: driverRowFinal?.current_lat || 12.9716,
          current_lng: driverRowFinal?.current_lng || 77.5946,
          rating: driverRowFinal?.rating || 0,
          total_rides: driverRowFinal?.total_rides || 0,
          total_trips: driverRowFinal?.total_rides || 0,
          status: driverRowFinal?.status || 'active',
          photo_url: driverRowFinal?.photo_url || undefined,
          dl_url: driverRowFinal?.dl_url || undefined,
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
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !fullName.trim() || !phone.trim() || !cdlNumber.trim() || !aadhaarNumber.trim() || !yearsDriving.trim() || !city.trim() || !driverPhotoUrl || !documentsUrl) {
      Alert.alert('Required Fields', 'Please complete all chauffeur details and upload your documents.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Please ensure both password fields match.');
      return;
    }

    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          // Only non-sensitive profile fields: user_metadata is embedded in every session JWT and
          // cached on the device. Aadhaar, licence number and KYC files go to driver_applications only.
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: 'driver_pending',
            city,
          },
        },
      });

      if (error) throw error;

      if (data?.user) {
        // Attempt to insert into driver_applications
        try {
          const metaData = {
            photo_url: driverPhotoUrl || '',
            driver_type: ownsVehicle ? "partner" : "company",
            vehicle_model: ownsVehicle ? vehicleModel.trim() : null,
            vehicle_number: ownsVehicle ? vehicleNumber.trim() : null,
            chassis_number: ownsVehicle ? chassisNumber.trim() : null,
            vehicle_year: ownsVehicle ? parseInt(vehicleYear) || null : null,
          };
          const metaJson = JSON.stringify(metaData);

          const fullPayload = {
            email: email.trim(),
            full_name: fullName.trim(),
            phone: phone.trim(),
            city: city || 'Unknown',
            licence_number: cdlNumber.trim(),
            aadhaar_number: aadhaarNumber.trim(),
            experience_years: parseInt(yearsDriving) || 0,
            photo_url: driverPhotoUrl || '',
            dl_url: documentsUrl || '',
            owns_vehicle: ownsVehicle,
            vehicle_model: ownsVehicle ? vehicleModel.trim() : null,
            vehicle_year: ownsVehicle ? parseInt(vehicleYear) || null : null,
            vehicle_number: ownsVehicle ? vehicleNumber.trim() : null,
            chassis_number: ownsVehicle ? chassisNumber.trim() : null,
            status: 'new',
            message: message.trim(),
            admin_notes: metaJson
          };

          let { error: insertErr } = await supabase.from('driver_applications').insert(fullPayload);

          if (insertErr) {
            // Fallback for strict schemas that don't have vehicle/photo columns yet
            console.warn("Retrying insert with base schema...", insertErr);
            const basePayload = {
              email: email.trim(),
              full_name: fullName.trim(),
              phone: phone.trim(),
              city: city || 'Unknown',
              licence_number: cdlNumber.trim(),
              aadhaar_number: aadhaarNumber.trim(),
              experience_years: parseInt(yearsDriving) || 0,
              dl_url: documentsUrl || '',
              owns_vehicle: ownsVehicle,
              status: 'new',
              message: message.trim(),
              admin_notes: metaJson
            };
            const retry = await supabase.from('driver_applications').insert(basePayload);
            if (retry.error) {
              Alert.alert('Database Error', retry.error.message || JSON.stringify(retry.error));
              return;
            }
          }
        } catch (e) {
          console.warn('Could not insert driver application', e);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMode('verify_otp');
        setOtpDigits('');
        setResendCooldown(30);
        Alert.alert(
          'Application Submitted & Verify Email',
          `Your application has been received! A 6-digit verification code has been sent to ${email.trim()}. Please enter it to verify your account, or tap the link in your email.`
        );
      }
    } catch (err: any) {
      Alert.alert('Registration Error', err.message || 'Could not register chauffeur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent={false}>
      <StatusBar
        barStyle={isLight ? 'dark-content' : 'light-content'}
        backgroundColor={isLight ? '#FFFFFF' : '#0F172A'}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, isLight && styles.containerLight]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isLight && styles.scrollContentLight,
            {
              paddingTop: topInset + 8,
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Actions: Dark / Light Mode Toggle */}
          <View style={styles.topActionsRow}>
            <TouchableOpacity
              style={[styles.themeToggleBtn, isLight && styles.themeToggleBtnLight]}
              onPress={toggleTheme}
              activeOpacity={0.8}
              accessibilityLabel="Switch theme"
              accessibilityRole="button"
            >
              {isLight ? (
                <Moon size={16} color="#0F172A" />
              ) : (
                <Sun size={16} color="#F97316" />
              )}
              <Text style={[styles.themeToggleText, isLight && styles.themeToggleTextLight]}>
                {isLight ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Brand Hero */}
          <View style={styles.brandHero}>
            <View style={styles.iconCircle}>
              <Shield size={32} color="#F97316" />
            </View>
            <Text style={[styles.brandTitle, isLight && styles.brandTitleLight]}>
              {mode === 'verify_otp' ? 'Verify Your Email' : 'Orange Chauffeur OS'}
            </Text>
            <Text style={[styles.brandSubtitle, isLight && styles.brandSubtitleLight]}>
              {mode === 'verify_otp'
                ? `Enter the 6-digit verification code sent to ${email || 'your email'}`
                : 'Connected to Supabase Cloud Database • Live Fleet Node'}
            </Text>
          </View>

          {/* Mode Switcher Tabs */}
          {mode !== 'verify_otp' && (
            <View style={[styles.tabContainer, isLight && styles.tabContainerLight]}>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  mode === 'signin' && (isLight ? styles.tabBtnActiveLight : styles.tabBtnActive),
                ]}
                onPress={() => setMode('signin')}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    isLight && styles.tabBtnTextLight,
                    mode === 'signin' && (isLight ? styles.tabBtnTextActiveLight : styles.tabBtnTextActive),
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  mode === 'signup' && (isLight ? styles.tabBtnActiveLight : styles.tabBtnActive),
                ]}
                onPress={() => setMode('signup')}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    isLight && styles.tabBtnTextLight,
                    mode === 'signup' && (isLight ? styles.tabBtnTextActiveLight : styles.tabBtnTextActive),
                  ]}
                >
                  Register Chauffeur
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form Fields */}
          <View style={[styles.formContainer, isLight && styles.formContainerLight]}>
            {mode === 'verify_otp' ? (
              <View style={{ marginTop: 8 }}>
                {otpLockoutRemaining > 0 && (
                  <View style={styles.lockoutBanner}>
                    <Text style={styles.lockoutText}>
                      Verification locked for 1 minute due to 5 unsuccessful attempts. Please wait {otpLockoutRemaining}s.
                    </Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>
                    6-Digit Verification Code
                  </Text>
                  <View style={[styles.inputRow, isLight && styles.inputRowLight, { justifyContent: 'center' }]}>
                    <TextInput
                      style={[
                        styles.textInput,
                        isLight && styles.textInputLight,
                        {
                          textAlign: 'center',
                          fontSize: 26,
                          fontWeight: '800',
                          letterSpacing: 8,
                          color: '#F97316',
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                        },
                      ]}
                      placeholder="• • • • • •"
                      placeholderTextColor={placeholderColor}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpDigits}
                      onChangeText={(val) => setOtpDigits(val.replace(/[^0-9]/g, '').slice(0, 6))}
                      autoFocus
                    />
                  </View>
                </View>

                {/* Email Confirmation Link Tip */}
                <View
                  style={{
                    backgroundColor: isLight ? '#F1F5F9' : '#1E293B',
                    borderRadius: 12,
                    padding: 12,
                    marginVertical: 14,
                    borderWidth: 1,
                    borderColor: isLight ? '#E2E8F0' : '#334155',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: isLight ? '#64748B' : '#94A3B8',
                      textAlign: 'center',
                      lineHeight: 18,
                    }}
                  >
                    Tip: You can also tap the confirmation link directly in the email to activate your account.
                  </Text>
                </View>

                {/* Resend 30s Cooldown */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 13, color: isLight ? '#64748B' : '#94A3B8' }}>
                    Didn't receive code?
                  </Text>
                  <TouchableOpacity
                    disabled={resendCooldown > 0 || loading}
                    onPress={handleResendOtp}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: resendCooldown > 0 ? '#94A3B8' : '#F97316',
                      }}
                    >
                      {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (loading || otpDigits.length !== 6 || otpLockoutRemaining > 0) && { opacity: 0.6 },
                  ]}
                  disabled={loading || otpDigits.length !== 6 || otpLockoutRemaining > 0}
                  onPress={handleVerifyOtp}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : otpLockoutRemaining > 0 ? (
                    <Text style={styles.submitBtnText}>Locked ({otpLockoutRemaining}s)</Text>
                  ) : (
                    <Text style={styles.submitBtnText}>Verify & Continue</Text>
                  )}
                </TouchableOpacity>

                {/* Switch back to sign in */}
                <TouchableOpacity
                  style={{ alignItems: 'center', marginTop: 18 }}
                  onPress={() => setMode('signin')}
                >
                  <Text style={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: 13, fontWeight: '600' }}>
                    ← Back to Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {mode === 'signup' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Full Name</Text>
                  <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                    <User size={18} color={iconColor} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight]}
                      placeholder="e.g. Ramesh Kumar"
                      placeholderTextColor={placeholderColor}
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Mobile Phone</Text>
                  <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                    <Phone size={18} color={iconColor} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight]}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={placeholderColor}
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>City</Text>
                  <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight]}
                      placeholder="e.g. Bengaluru"
                      placeholderTextColor={placeholderColor}
                      value={city}
                      onChangeText={setCity}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Years Driving</Text>
                  <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight]}
                      placeholder="e.g. 5"
                      placeholderTextColor={placeholderColor}
                      keyboardType="numeric"
                      value={yearsDriving}
                      onChangeText={setYearsDriving}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Commercial Driving Licence Number</Text>
                  <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                    <Car size={18} color={iconColor} style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight]}
                      placeholder="e.g. KA0120230000000"
                      placeholderTextColor={placeholderColor}
                      autoCapitalize="characters"
                      value={cdlNumber}
                      onChangeText={setCdlNumber}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Aadhaar Number</Text>
                  <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight]}
                      placeholder="e.g. 1234 5678 9012"
                      placeholderTextColor={placeholderColor}
                      keyboardType="numeric"
                      value={aadhaarNumber}
                      onChangeText={handleAadhaarChange}
                      maxLength={14}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Driver Photo</Text>
                  <TouchableOpacity
                    style={[
                      styles.inputRow,
                      isLight && styles.inputRowLight,
                      {
                        justifyContent: 'center',
                        backgroundColor: driverPhotoUrl
                          ? (isLight ? '#ECFDF5' : '#10B98120')
                          : (isLight ? '#F1F5F9' : '#0F172A'),
                        borderColor: driverPhotoUrl ? '#10B981' : (isLight ? '#CBD5E1' : '#334155'),
                      },
                    ]}
                    onPress={handleUploadDriverPhoto}
                  >
                    <Text
                      style={{
                        color: driverPhotoUrl ? '#059669' : '#F97316',
                        fontWeight: 'bold',
                      }}
                    >
                      {driverPhotoUrl ? '✓ Driver Photo Uploaded' : 'Upload Driver Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Documents (DL & Aadhaar)</Text>
                  <TouchableOpacity
                    style={[
                      styles.inputRow,
                      isLight && styles.inputRowLight,
                      {
                        justifyContent: 'center',
                        backgroundColor: documentsUrl
                          ? (isLight ? '#ECFDF5' : '#10B98120')
                          : (isLight ? '#F1F5F9' : '#0F172A'),
                        borderColor: documentsUrl ? '#10B981' : (isLight ? '#CBD5E1' : '#334155'),
                      },
                    ]}
                    onPress={handleUploadDocuments}
                  >
                    <Text
                      style={{
                        color: documentsUrl ? '#059669' : '#F97316',
                        fontWeight: 'bold',
                      }}
                    >
                      {documentsUrl ? '✓ Documents Uploaded' : 'Upload Documents (DL & Aadhaar)'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <TouchableOpacity
                    style={[
                      styles.inputRow,
                      isLight && styles.inputRowLight,
                      {
                        justifyContent: 'flex-start',
                        backgroundColor: ownsVehicle
                          ? (isLight ? '#ECFDF5' : '#10B98120')
                          : (isLight ? '#F1F5F9' : '#0F172A'),
                        borderColor: ownsVehicle ? '#10B981' : (isLight ? '#CBD5E1' : '#334155'),
                      },
                    ]}
                    onPress={() => {
                      if (!ownsVehicle) {
                        setShowPartnerTermsModal(true);
                      } else {
                        setOwnsVehicle(false);
                      }
                    }}
                  >
                    {ownsVehicle ? (
                      <CheckCircle2 size={20} color="#10B981" style={{ marginRight: 10 }} />
                    ) : (
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isLight ? '#94A3B8' : '#64748B',
                          marginRight: 10,
                        }}
                      />
                    )}
                    <Text style={{ color: isLight ? '#0F172A' : '#FFFFFF', fontSize: 13, flex: 1, fontWeight: '500' }}>
                      I bring my own Orange Standard Car (Partner Driver)
                    </Text>
                  </TouchableOpacity>
                </View>

                {ownsVehicle && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Vehicle Model</Text>
                      <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder="e.g. Mahindra BE 6 EV"
                          placeholderTextColor={placeholderColor}
                          value={vehicleModel}
                          onChangeText={setVehicleModel}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Vehicle Year</Text>
                      <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder="e.g. 2024"
                          placeholderTextColor={placeholderColor}
                          keyboardType="numeric"
                          value={vehicleYear}
                          onChangeText={setVehicleYear}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Vehicle Registration Number</Text>
                      <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder="e.g. DL 01 AB 1234"
                          placeholderTextColor={placeholderColor}
                          autoCapitalize="characters"
                          value={vehicleNumber}
                          onChangeText={setVehicleNumber}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Chassis Number</Text>
                      <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder="Enter chassis number"
                          placeholderTextColor={placeholderColor}
                          autoCapitalize="characters"
                          value={chassisNumber}
                          onChangeText={setChassisNumber}
                        />
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Message</Text>
                  <View
                    style={[
                      styles.inputRow,
                      isLight && styles.inputRowLight,
                      { height: 100, alignItems: 'flex-start', paddingTop: 10 },
                    ]}
                  >
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight, { textAlignVertical: 'top' }]}
                      placeholder="Anything else you'd like us to know?"
                      placeholderTextColor={placeholderColor}
                      multiline
                      numberOfLines={4}
                      value={message}
                      onChangeText={setMessage}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Chauffeur Email</Text>
              <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                <Mail size={18} color={iconColor} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.textInput, isLight && styles.textInputLight]}
                  placeholder="chauffeur@orangetaxi.in"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Password</Text>
              <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                <Lock size={18} color={iconColor} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.textInput, isLight && styles.textInputLight]}
                  placeholder="••••••••••••"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>Confirm Password</Text>
                <View style={[styles.inputRow, isLight && styles.inputRowLight]}>
                  <Lock size={18} color={iconColor} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.textInput, isLight && styles.textInputLight]}
                    placeholder="Re-enter your password"
                    placeholderTextColor={placeholderColor}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>
            )}

            {mode === 'signup' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.disclaimerText, isLight && styles.disclaimerTextLight]}>
                  By submitting this form, you consent to data processing under the Digital Personal Data Protection (DPDP) Act, 2023 and agree to our{' '}
                  <Text
                    style={{ color: '#F97316', fontWeight: '600', textDecorationLine: 'underline' }}
                    onPress={() => Linking.openURL('https://orange-taxi.com/privacy')}
                  >
                    Privacy Policy
                  </Text>
                  {' & '}
                  <Text
                    style={{ color: '#F97316', fontWeight: '600', textDecorationLine: 'underline' }}
                    onPress={() => Linking.openURL('https://orange-taxi.com/terms')}
                  >
                    Terms of Service
                  </Text>.
                </Text>
              </View>
            )}

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

            {mode === 'signin' && (
              <>
                <TouchableOpacity style={{ alignItems: 'center', marginTop: 15 }} onPress={handleForgotPassword}>
                  <Text style={{ color: '#F97316', fontSize: 14, fontWeight: '600' }}>Forgot Password?</Text>
                </TouchableOpacity>

                <View style={{ marginTop: 16, paddingHorizontal: 12 }}>
                  <Text style={[styles.disclaimerText, isLight && styles.disclaimerTextLight, { textAlign: 'center' }]}>
                    By signing in to Chauffeur Console, you agree to Orange Taxi&apos;s{' '}
                    <Text
                      style={{ color: '#F97316', fontWeight: '600', textDecorationLine: 'underline' }}
                      onPress={() => Linking.openURL('https://orange-taxi.com/privacy')}
                    >
                      Privacy Policy
                    </Text>
                    {' and '}
                    <Text
                      style={{ color: '#F97316', fontWeight: '600', textDecorationLine: 'underline' }}
                      onPress={() => Linking.openURL('https://orange-taxi.com/terms')}
                    >
                      Terms of Service
                    </Text>.
                  </Text>
                </View>
              </>
            )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPartnerTermsModal} animationType="slide" transparent={true}>
        <View style={styles.termsOverlay}>
          <View style={[styles.termsContainer, isLight && styles.termsContainerLight]}>
            <Text style={[styles.termsTitle, isLight && styles.termsTitleLight]}>Orange Standard Cab</Text>
            <Text style={[styles.termsSubtitle, isLight && styles.termsSubtitleLight]}>Vehicle Requirements</Text>
            
            <ScrollView style={styles.termsScroll}>
              <View style={[styles.termCard, isLight && styles.termCardLight]}>
                <Zap size={24} color="#F97316" style={styles.termIcon} />
                <View style={styles.termTextContainer}>
                  <Text style={[styles.termCardTitle, isLight && styles.termCardTitleLight]}>1. 100% Electric Vehicle (EV)</Text>
                  <Text style={[styles.termCardDesc, isLight && styles.termCardDescLight]}>Must be a fully electric vehicle. No hybrids or internal combustion engines allowed. We are committed to a zero-emission future.</Text>
                </View>
              </View>

              <View style={[styles.termCard, isLight && styles.termCardLight]}>
                <Car size={24} color="#F97316" style={styles.termIcon} />
                <View style={styles.termTextContainer}>
                  <Text style={[styles.termCardTitle, isLight && styles.termCardTitleLight]}>2. Signature Orange Exterior Color</Text>
                  <Text style={[styles.termCardDesc, isLight && styles.termCardDescLight]}>The vehicle must feature our signature Orange Standard exterior color to maintain brand consistency and visibility.</Text>
                </View>
              </View>

              <View style={[styles.termCard, isLight && styles.termCardLight]}>
                <CheckCircle2 size={24} color="#F97316" style={styles.termIcon} />
                <View style={styles.termTextContainer}>
                  <Text style={[styles.termCardTitle, isLight && styles.termCardTitleLight]}>3. Spotless Interior & Pre-Cooled AC</Text>
                  <Text style={[styles.termCardDesc, isLight && styles.termCardDescLight]}>Maintain an impeccably clean interior and ensure the AC is pre-cooled for maximum passenger comfort before every ride.</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.termsActions}>
              <TouchableOpacity 
                style={[styles.termsCancelBtn, isLight && styles.termsCancelBtnLight]} 
                onPress={() => {
                  setOwnsVehicle(false);
                  setShowPartnerTermsModal(false);
                }}
              >
                <Text style={[styles.termsCancelText, isLight && styles.termsCancelTextLight]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.termsAgreeBtn}
                onPress={() => {
                  setOwnsVehicle(true);
                  setShowPartnerTermsModal(false);
                }}
              >
                <Text style={styles.termsAgreeText}>I Agree & Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
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
  scrollContent: {
    paddingHorizontal: 20,
    backgroundColor: '#0F172A',
  },
  scrollContentLight: {
    backgroundColor: '#FFFFFF',
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  themeToggleBtnLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  themeToggleText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '700',
  },
  themeToggleTextLight: {
    color: '#0F172A',
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 24,
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
  brandTitleLight: {
    color: '#0F172A',
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  brandSubtitleLight: {
    color: '#64748B',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tabContainerLight: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  tabBtnActiveLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBtnTextLight: {
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#F97316',
    fontWeight: '900',
  },
  tabBtnTextActiveLight: {
    color: '#EA580C',
    fontWeight: '900',
  },
  formContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formContainerLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
  inputLabelLight: {
    color: '#334155',
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
  inputRowLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  textInputLight: {
    color: '#0F172A',
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
  disclaimerText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  disclaimerTextLight: {
    color: '#64748B',
  },
  termsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  termsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '80%',
  },
  termsContainerLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  termsTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  termsTitleLight: {
    color: '#0F172A',
  },
  termsSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  termsSubtitleLight: {
    color: '#64748B',
  },
  termsScroll: {
    marginBottom: 20,
  },
  termCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  termCardLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  termIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  termTextContainer: {
    flex: 1,
  },
  termCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  termCardTitleLight: {
    color: '#0F172A',
  },
  termCardDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  termCardDescLight: {
    color: '#475569',
  },
  termsActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  termsCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  termsCancelBtnLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  termsCancelText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  termsCancelTextLight: {
    color: '#475569',
  },
  termsAgreeBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  termsAgreeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  lockoutBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  lockoutText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});
