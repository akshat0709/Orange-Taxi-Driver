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
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { Driver } from '../types';

interface ChauffeurAuthModalProps {
  visible: boolean;
  onSuccess: (driver: Driver) => void;
}

export function ChauffeurAuthModal({
  visible,
  onSuccess,
}: ChauffeurAuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cdlNumber, setCdlNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
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

  const handleUploadDriverPhoto = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      const base64 = result.assets[0].base64;
      const fileName = `photo_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from('driver_kyc').upload(fileName, decode(base64), { contentType: 'image/jpeg' });
      if (error) {
        Alert.alert('Upload Error', error.message);
      } else if (data) {
        const { data: publicData } = supabase.storage.from('driver_kyc').getPublicUrl(data.path);
        setDriverPhotoUrl(publicData.publicUrl);
        Alert.alert('Success', 'Driver photo uploaded successfully.');
      }
    }
  };

  const handleUploadDocuments = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      const base64 = result.assets[0].base64;
      const fileName = `doc_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from('driver_kyc').upload(fileName, decode(base64), { contentType: 'image/jpeg' });
      if (error) {
        Alert.alert('Upload Error', error.message);
      } else if (data) {
        const { data: publicData } = supabase.storage.from('driver_kyc').getPublicUrl(data.path);
        setDocumentsUrl(publicData.publicUrl);
        Alert.alert('Success', 'Documents uploaded successfully.');
      }
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
    if (!email.trim() || !password.trim() || !fullName.trim() || !phone.trim() || !cdlNumber.trim() || !aadhaarNumber.trim() || !yearsDriving.trim() || !city.trim() || !driverPhotoUrl || !documentsUrl) {
      Alert.alert('Required Fields', 'Please complete all chauffeur details and upload your documents.');
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
            role: 'driver_pending',
            city,
            cdl_number: cdlNumber.trim(),
            aadhaar_number: aadhaarNumber.trim(),
            years_driving: yearsDriving.trim(),
            driver_photo_url: driverPhotoUrl,
            documents_url: documentsUrl,
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
        Alert.alert('Application Submitted', 'Your application has been submitted and is pending admin approval.');
        setMode('signin');
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
                  <Text style={styles.inputLabel}>City</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Bengaluru"
                      placeholderTextColor="#64748B"
                      value={city}
                      onChangeText={setCity}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Years Driving</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 5"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={yearsDriving}
                      onChangeText={setYearsDriving}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Commercial Driving Licence Number</Text>
                  <View style={styles.inputRow}>
                    <Car size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. KA0120230000000"
                      placeholderTextColor="#64748B"
                      autoCapitalize="characters"
                      value={cdlNumber}
                      onChangeText={setCdlNumber}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Aadhaar Number</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 1234 5678 9012"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      value={aadhaarNumber}
                      onChangeText={setAadhaarNumber}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Driver Photo</Text>
                  <TouchableOpacity
                    style={[styles.inputRow, { justifyContent: 'center', backgroundColor: driverPhotoUrl ? '#10B98120' : '#0F172A', borderColor: driverPhotoUrl ? '#10B981' : '#334155' }]}
                    onPress={handleUploadDriverPhoto}
                  >
                    <Text style={{ color: driverPhotoUrl ? '#10B981' : '#F97316', fontWeight: 'bold' }}>
                      {driverPhotoUrl ? '✓ Driver Photo Uploaded' : 'Upload Driver Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Documents (DL & Aadhaar)</Text>
                  <TouchableOpacity
                    style={[styles.inputRow, { justifyContent: 'center', backgroundColor: documentsUrl ? '#10B98120' : '#0F172A', borderColor: documentsUrl ? '#10B981' : '#334155' }]}
                    onPress={handleUploadDocuments}
                  >
                    <Text style={{ color: documentsUrl ? '#10B981' : '#F97316', fontWeight: 'bold' }}>
                      {documentsUrl ? '✓ Documents Uploaded' : 'Upload Documents (DL & Aadhaar)'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <TouchableOpacity
                    style={[styles.inputRow, { justifyContent: 'flex-start', backgroundColor: ownsVehicle ? '#10B98120' : '#0F172A', borderColor: ownsVehicle ? '#10B981' : '#334155' }]}
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
                      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#64748B', marginRight: 10 }} />
                    )}
                    <Text style={{ color: '#FFFFFF', fontSize: 13, flex: 1 }}>
                      I bring my own Orange Standard Car (Partner Driver)
                    </Text>
                  </TouchableOpacity>
                </View>

                {ownsVehicle && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Vehicle Model</Text>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="e.g. Mahindra BE 6 EV"
                          placeholderTextColor="#64748B"
                          value={vehicleModel}
                          onChangeText={setVehicleModel}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Vehicle Year</Text>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="e.g. 2024"
                          placeholderTextColor="#64748B"
                          keyboardType="numeric"
                          value={vehicleYear}
                          onChangeText={setVehicleYear}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Vehicle Registration Number</Text>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="e.g. DL 01 AB 1234"
                          placeholderTextColor="#64748B"
                          autoCapitalize="characters"
                          value={vehicleNumber}
                          onChangeText={setVehicleNumber}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Chassis Number</Text>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="Enter chassis number"
                          placeholderTextColor="#64748B"
                          autoCapitalize="characters"
                          value={chassisNumber}
                          onChangeText={setChassisNumber}
                        />
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Message</Text>
                  <View style={[styles.inputRow, { height: 100, alignItems: 'flex-start', paddingTop: 10 }]}>
                    <TextInput
                      style={[styles.textInput, { textAlignVertical: 'top' }]}
                      placeholder="Anything else you'd like us to know?"
                      placeholderTextColor="#64748B"
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

            {mode === 'signup' && (
              <Text style={styles.disclaimerText}>
                By submitting this form, you consent to the collection and processing of your personal data in accordance with the Digital Personal Data Protection (DPDP) Act, 2023.
              </Text>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showPartnerTermsModal} animationType="slide" transparent={true}>
        <View style={styles.termsOverlay}>
          <View style={styles.termsContainer}>
            <Text style={styles.termsTitle}>Orange Standard Cab</Text>
            <Text style={styles.termsSubtitle}>Vehicle Requirements</Text>
            
            <ScrollView style={styles.termsScroll}>
              <View style={styles.termCard}>
                <Zap size={24} color="#F97316" style={styles.termIcon} />
                <View style={styles.termTextContainer}>
                  <Text style={styles.termCardTitle}>1. 100% Electric Vehicle (EV)</Text>
                  <Text style={styles.termCardDesc}>Must be a fully electric vehicle. No hybrids or internal combustion engines allowed. We are committed to a zero-emission future.</Text>
                </View>
              </View>

              <View style={styles.termCard}>
                <Car size={24} color="#F97316" style={styles.termIcon} />
                <View style={styles.termTextContainer}>
                  <Text style={styles.termCardTitle}>2. Signature Orange Exterior Color</Text>
                  <Text style={styles.termCardDesc}>The vehicle must feature our signature Orange Standard exterior color to maintain brand consistency and visibility.</Text>
                </View>
              </View>

              <View style={styles.termCard}>
                <CheckCircle2 size={24} color="#F97316" style={styles.termIcon} />
                <View style={styles.termTextContainer}>
                  <Text style={styles.termCardTitle}>3. Spotless Interior & Pre-Cooled AC</Text>
                  <Text style={styles.termCardDesc}>Maintain an impeccably clean interior and ensure the AC is pre-cooled for maximum passenger comfort before every ride.</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.termsActions}>
              <TouchableOpacity 
                style={styles.termsCancelBtn} 
                onPress={() => {
                  setOwnsVehicle(false);
                  setShowPartnerTermsModal(false);
                }}
              >
                <Text style={styles.termsCancelText}>Cancel</Text>
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
  disclaimerText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
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
  termsTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  termsSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
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
  termCardDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
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
  termsCancelText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
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
});
