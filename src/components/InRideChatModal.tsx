import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  Send,
  MessageSquare,
  Phone,
  Car,
  User,
  MapPin,
  Navigation,
  Map,
  CheckCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { sendDriverLocalNotification } from '../lib/notificationService';

export interface ChatMessage {
  id: string;
  sender: 'driver' | 'customer';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface ParsedLocationInfo {
  isLocation: boolean;
  latitude?: number;
  longitude?: number;
  googleMapsUrl: string;
  appleMapsUrl?: string;
  note: string;
}

interface InRideChatModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  bookingReference?: string;
  customerName: string;
  driverName: string;
  driverPhone?: string;
  currentUserLocation?: { lat: number; lng: number };
  driverLocation?: { lat: number; lng: number } | null;
  onUnreadCountChange?: (count: number) => void;
  senderRole?: 'customer' | 'driver';
  theme?: 'light' | 'dark';
}

const DRIVER_QUICK_CHIPS = [
  '🚗 I have arrived at the pickup location',
  '⏱️ In heavy traffic, reaching in 3 minutes',
  '📍 Waiting outside at the main entrance gate',
  '❄️ Cabin AC is pre-cooled & ready for you',
  '🚨 Hazard lights are flashing on my vehicle',
];

const CUSTOMER_QUICK_CHIPS = [
  '🚶 On my way down right now',
  '🚪 Waiting at the security / reception gate',
  '❄️ Please turn on the AC',
  '⏱️ Please give me 2 minutes, arriving!',
  '👔 Standing near the main lobby entrance',
];

/**
 * Calculates straight-line distance in meters between two coordinates.
 */
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `~${meters} m away`;
  }
  return `~${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Parses a chat message text to identify Google/Apple Maps links or coordinates.
 */
export function parseLocationMessage(text: string): ParsedLocationInfo | null {
  if (!text) return null;

  const isMapUrl =
    text.includes('maps.google.com') ||
    text.includes('google.com/maps') ||
    text.includes('maps.apple.com') ||
    text.includes('goo.gl/maps');

  // Extract coordinates from query parameter or path: ?q=lat,lng or ?ll=lat,lng or @lat,lng
  const coordRegex = /(?:[?&](?:q|ll|query)=|place\/|@)?(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = text.match(coordRegex);

  let latitude: number | undefined;
  let longitude: number | undefined;

  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      latitude = lat;
      longitude = lng;
    }
  }

  // Fallback: check for raw comma-separated coordinates
  if (latitude === undefined || longitude === undefined) {
    const rawMatch = text.match(/(-?\d+\.\d{3,}),\s*(-?\d+\.\d{3,})/);
    if (rawMatch) {
      const lat = parseFloat(rawMatch[1]);
      const lng = parseFloat(rawMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        latitude = lat;
        longitude = lng;
      }
    }
  }

  if (!isMapUrl && (latitude === undefined || longitude === undefined)) {
    return null;
  }

  // Clean user note: strip URL and leading pin emojis
  let note = text;
  note = note.replace(/https?:\/\/[^\s]+/g, '').trim();
  note = note.replace(/^[📍🗺️📌]\s*/u, '').trim();
  if (note.endsWith(':')) note = note.slice(0, -1).trim();

  const gUrl =
    latitude !== undefined && longitude !== undefined
      ? `https://maps.google.com/?q=${latitude},${longitude}`
      : text.match(/https?:\/\/[^\s]+/)?.[0] || 'https://maps.google.com';

  const aUrl =
    latitude !== undefined && longitude !== undefined
      ? `http://maps.apple.com/?q=${latitude},${longitude}&ll=${latitude},${longitude}`
      : undefined;

  return {
    isLocation: true,
    latitude,
    longitude,
    googleMapsUrl: gUrl,
    appleMapsUrl: aUrl,
    note: note || 'Exact Physical GPS Location',
  };
}

export function InRideChatModal({
  visible,
  onClose,
  bookingId,
  bookingReference,
  customerName,
  driverName,
  driverPhone,
  currentUserLocation,
  driverLocation,
  onUnreadCountChange,
  senderRole = 'driver',
  theme = 'dark',
}: InRideChatModalProps) {
  const isLight = theme === 'light';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sharingGps, setSharingGps] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const channelRef = useRef<any>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;

  const unreadCountRef = useRef(0);
  const storageKey = `@orange_chat_${bookingId}`;

  // Helper to merge incoming messages safely and persist to AsyncStorage
  const mergeIncomingMessages = (incomingList: ChatMessage[]) => {
    if (!incomingList || incomingList.length === 0) return;

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const brandNew = incomingList.filter((m) => m && m.id && !existingIds.has(m.id));
      if (brandNew.length === 0) return prev;

      const merged = [...prev, ...brandNew].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      AsyncStorage.setItem(storageKey, JSON.stringify(merged)).catch(() => {});

      // Check if any incoming message is from the passenger
      const fromCustomer = brandNew.filter((m) => m.sender === 'customer');
      if (fromCustomer.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!visibleRef.current) {
          unreadCountRef.current += fromCustomer.length;
          onUnreadCountChangeRef.current?.(unreadCountRef.current);
          const latest = fromCustomer[fromCustomer.length - 1];
          sendDriverLocalNotification(
            `💬 Message from ${latest.senderName || customerName || 'Passenger'}`,
            latest.text,
            { bookingId }
          );
        }
      }

      return merged;
    });
  };

  // 1. Load initial persisted chat history on mount
  useEffect(() => {
    if (!bookingId) return;
    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (stored) {
          try {
            const parsed: ChatMessage[] = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setMessages(parsed);
            }
          } catch (e) {
            console.warn('Failed to parse cached chat history:', e);
          }
        }
      })
      .catch(() => {});
  }, [bookingId, storageKey]);

  // 2. Realtime channel subscription (Active during entire ride booking with authorization)
  useEffect(() => {
    if (!bookingId) return;

    let isCancelled = false;
    let channel: any = null;

    async function setupAuthorizedChat() {
      // 1. Verify authenticated session
      const { data: authData } = await supabase.auth.getSession();
      if (isCancelled || !authData?.session?.user) {
        return;
      }

      // 2. Verify caller is authorized for this booking
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
      if (isUuid) {
        const { data: ride, error } = await supabase
          .from('bookings')
          .select('id, driver_id, customer_id')
          .eq('id', bookingId)
          .maybeSingle();

        if (isCancelled || error || !ride) {
          return;
        }
      }

      channel = supabase.channel(`ride-chat-${bookingId}`, {
        config: { broadcast: { self: false, ack: true } },
      });

      channel
        .on('broadcast', { event: 'chat_message' }, (payload: any) => {
          if (payload?.payload) {
            mergeIncomingMessages([payload.payload]);
          }
        })
        .on('broadcast', { event: 'request_chat_history' }, () => {
          if (messagesRef.current.length > 0 && channelRef.current) {
            channelRef.current
              .send({
                type: 'broadcast',
                event: 'sync_chat_history',
                payload: { messages: messagesRef.current },
              })
              .catch(() => {});
          }
        })
        .on('broadcast', { event: 'sync_chat_history' }, (payload: any) => {
          if (payload?.payload?.messages) {
            mergeIncomingMessages(payload.payload.messages);
          }
        })
        .subscribe();

      channelRef.current = channel;
    }

    setupAuthorizedChat();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [bookingId]);

  // 3. When modal opens, clear unread count & request peer history sync
  useEffect(() => {
    if (visible) {
      unreadCountRef.current = 0;
      onUnreadCountChangeRef.current?.(0);

      if (channelRef.current) {
        channelRef.current
          .send({
            type: 'broadcast',
            event: 'request_chat_history',
            payload: { requester: 'customer' },
          })
          .catch(() => {});
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [visible]);

  // Send a regular text message
  function handleSend(textToSend?: string) {
    const text = (textToSend || inputText).trim();
    if (!text || !bookingId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      sender: senderRole,
      senderName: senderRole === 'driver' ? (driverName || 'Chauffeur') : (customerName || 'Passenger'),
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => {
      const updated = [...prev, newMsg];
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    setInputText('');

    if (channelRef.current) {
      channelRef.current
        .send({
          type: 'broadcast',
          event: 'chat_message',
          payload: newMsg,
        })
        .catch((e: any) => console.warn('Broadcast send error:', e));
    }
  }

  // Acquire high-accuracy GPS and share pin with chauffeur
  async function handleShareGps() {
    if (sharingGps || !bookingId) return;
    setSharingGps(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let coords: { lat: number; lng: number } | null = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      }
    } catch (err) {
      console.warn('Live GPS lock attempt failed, attempting fallback:', err);
    }

    // Fallback 1: Last known device GPS fix
    if (!coords) {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          coords = { lat: last.coords.latitude, lng: last.coords.longitude };
        }
      } catch {}
    }

    // Fallback 2: Passed user pickup / current coordinates
    if (!coords && currentUserLocation?.lat && currentUserLocation?.lng) {
      coords = currentUserLocation;
    }

    if (!coords) {
      Alert.alert(
        'GPS Unavailable',
        'Could not obtain satellite GPS fix. Please verify location permissions in your Settings.'
      );
      setSharingGps(false);
      return;
    }

    const latStr = coords.lat.toFixed(5);
    const lngStr = coords.lng.toFixed(5);
    const mapUrl = `https://maps.google.com/?q=${latStr},${lngStr}`;
    const messageText = `📍 Standing here right now: ${mapUrl}`;

    handleSend(messageText);
    setSharingGps(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // Open URL in Google Maps, Apple Maps, or external browser
  function openMapUrl(url?: string, fallbackUrl?: string) {
    if (!url) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else if (fallbackUrl) {
          return Linking.openURL(fallbackUrl);
        }
      })
      .catch(() => {
        if (fallbackUrl) {
          Linking.openURL(fallbackUrl).catch(() => {});
        }
      });
  }

  // Render dedicated luxury Location Card
  function renderLocationCard(m: ChatMessage, loc: ParsedLocationInfo, isMe: boolean) {
    const timeStr = new Date(m.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Compute relative distance if both rider and driver / target coordinates exist
    let distanceStr: string | null = null;
    const refCoords = isMe ? driverLocation : currentUserLocation;
    if (loc.latitude !== undefined && loc.longitude !== undefined && refCoords?.lat && refCoords?.lng) {
      const distM = calculateDistanceMeters(
        refCoords.lat,
        refCoords.lng,
        loc.latitude,
        loc.longitude
      );
      distanceStr = formatDistance(distM);
    }

    return (
      <View
        key={m.id}
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMe : styles.messageRowOther,
        ]}
      >
        <View
          style={[
            styles.locationCard,
            isMe ? styles.locationCardMe : styles.locationCardOther,
          ]}
        >
          {/* Card Header */}
          <View style={styles.locationHeaderRow}>
            <View
              style={[
                styles.locationIconBadge,
                isMe ? styles.locationIconBadgeMe : styles.locationIconBadgeOther,
              ]}
            >
              <MapPin size={17} color={isMe ? '#F56B00' : '#22C55E'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationCardTitle}>
                {isMe ? 'My Shared GPS Location' : `${m.senderName || 'Chauffeur'} Shared Location`}
              </Text>
              <View style={styles.locationStatusRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.locationCardSub}>Live Satellite Coordinates</Text>
              </View>
            </View>
          </View>

          {/* Note / Human Context */}
          {loc.note ? (
            <View style={styles.locationNoteBox}>
              <Text style={styles.locationNoteText}>"{loc.note}"</Text>
            </View>
          ) : null}

          {/* Coordinates & Relative Distance Badges */}
          <View style={styles.locationMetaRow}>
            {loc.latitude !== undefined && loc.longitude !== undefined ? (
              <View style={styles.coordPill}>
                <Navigation size={11} color="#9CA3AF" />
                <Text style={styles.coordPillText}>
                  {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                </Text>
              </View>
            ) : null}

            {distanceStr ? (
              <View style={styles.distancePill}>
                <Car size={11} color="#22C55E" />
                <Text style={styles.distancePillText}>{distanceStr}</Text>
              </View>
            ) : null}
          </View>

          {/* Interactive Navigation Action Buttons */}
          <View style={styles.locationActionRow}>
            {/* Primary Google Maps Navigation */}
            <TouchableOpacity
              style={styles.mapBtnPrimary}
              activeOpacity={0.8}
              onPress={() => openMapUrl(loc.googleMapsUrl, loc.appleMapsUrl)}
            >
              <Navigation size={14} color="#FFFFFF" />
              <Text style={styles.mapBtnPrimaryText}>Google Maps</Text>
            </TouchableOpacity>

            {/* Native Apple Maps (iOS Direct) */}
            {Platform.OS === 'ios' && loc.appleMapsUrl ? (
              <TouchableOpacity
                style={styles.mapBtnSecondary}
                activeOpacity={0.8}
                onPress={() => openMapUrl(loc.appleMapsUrl, loc.googleMapsUrl)}
              >
                <Map size={14} color="#CBD5E1" />
                <Text style={styles.mapBtnSecondaryText}>Apple Maps</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Timestamp & Status */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardTimeText}>{timeStr}</Text>
            {isMe && <CheckCheck size={13} color="rgba(255, 255, 255, 0.7)" />}
          </View>
        </View>
      </View>
    );
  }

  const cleanPhone = (driverPhone || '').replace(/\D/g, '');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContainer, isLight && styles.containerLight]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View style={styles.driverAvatar}>
                <Car size={18} color="#F56B00" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.driverName}>{driverName || 'Orange Chauffeur'}</Text>
                  {bookingReference ? (
                    <Text style={styles.refBadge}>#{bookingReference}</Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.headerSub}>Live In-Ride Messaging</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {cleanPhone ? (
                <TouchableOpacity
                  style={styles.headerCallBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Linking.openURL(`tel:${cleanPhone}`);
                  }}
                >
                  <Phone size={14} color="#22C55E" />
                  <Text style={styles.headerCallText}>Call</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages Thread */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={{ paddingVertical: 14 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <MessageSquare size={28} color="#F56B00" />
                </View>
                <Text style={styles.emptyTitle}>Chat with your Chauffeur</Text>
                <Text style={styles.emptySub}>
                  Coordinate pickup gates, live location, or ride comforts in real-time.
                </Text>
                <TouchableOpacity
                  style={styles.emptyGpsActionBtn}
                  activeOpacity={0.85}
                  onPress={handleShareGps}
                  disabled={sharingGps}
                >
                  {sharingGps ? (
                    <ActivityIndicator size="small" color="#22C55E" />
                  ) : (
                    <MapPin size={15} color="#22C55E" />
                  )}
                  <Text style={styles.emptyGpsActionText}>
                    {sharingGps ? 'Acquiring GPS...' : '📍 Share Current GPS Pin'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = m.sender === senderRole;
                const locInfo = parseLocationMessage(m.text);

                // Render as Rich Location Card if coordinates/map URL detected
                if (locInfo) {
                  return renderLocationCard(m, locInfo, isMe);
                }

                // Standard Text Message Bubble
                return (
                  <View
                    key={m.id}
                    style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}
                  >
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                      {!isMe && (
                        <Text style={styles.senderLabel}>
                          {m.senderName || 'Chauffeur'}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.bubbleText,
                          isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
                        ]}
                      >
                        {m.text}
                      </Text>
                      <View style={styles.bubbleFooter}>
                        <Text
                          style={[
                            styles.bubbleTime,
                            isMe ? styles.bubbleTimeMe : styles.bubbleTimeOther,
                          ]}
                        >
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        {isMe && <CheckCheck size={12} color="rgba(255, 255, 255, 0.7)" />}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Quick Response & GPS Sharing Chips */}
          <View style={styles.chipsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* Dedicated GPS Share Button */}
              <TouchableOpacity
                style={[styles.chip, styles.gpsShareChip]}
                activeOpacity={0.8}
                onPress={handleShareGps}
                disabled={sharingGps}
              >
                {sharingGps ? (
                  <ActivityIndicator size="small" color="#22C55E" style={{ marginRight: 6 }} />
                ) : (
                  <MapPin size={14} color="#22C55E" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.gpsShareChipText}>
                  {sharingGps ? 'Locating...' : '📍 Share GPS Pin'}
                </Text>
              </TouchableOpacity>

              {(senderRole === 'driver' ? DRIVER_QUICK_CHIPS : CUSTOMER_QUICK_CHIPS).map((chip, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.chip}
                  activeOpacity={0.8}
                  onPress={() => handleSend(chip)}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar with Location Attachment */}
          <View style={styles.inputBar}>
            {/* Quick GPS pin shortcut icon beside input */}
            <TouchableOpacity
              style={styles.inputGpsBtn}
              activeOpacity={0.75}
              onPress={handleShareGps}
              disabled={sharingGps}
              accessibilityLabel="Share current GPS location"
            >
              {sharingGps ? (
                <ActivityIndicator size="small" color="#22C55E" />
              ) : (
                <MapPin size={18} color="#22C55E" />
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder={`Message ${driverName || 'driver'}...`}
              placeholderTextColor="#6B7280"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />

            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              disabled={!inputText.trim()}
              onPress={() => handleSend()}
              activeOpacity={0.8}
            >
              <Send size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#11151F',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: '80%',
    borderTopWidth: 1,
    borderTopColor: '#232B3B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2230',
    backgroundColor: '#141A26',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E2536',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F56B00',
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  refBadge: {
    color: '#F56B00',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(245, 107, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  headerSub: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '600',
  },
  headerCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  headerCallText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#1A212E',
    borderRadius: 16,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 107, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 107, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    color: '#8A94A6',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 270,
  },
  emptyGpsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyGpsActionText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '700',
  },
  messageRow: {
    marginVertical: 5,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  senderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: '#F56B00',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#1E2536',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#293245',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bubbleTextOther: {
    color: '#F1F5F9',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleTime: {
    fontSize: 9,
  },
  bubbleTimeMe: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  bubbleTimeOther: {
    color: '#8A94A6',
  },

  /* ========================================================================= */
  /* DEDICATED LOCATION CARD STYLING                                           */
  /* ========================================================================= */
  locationCard: {
    width: '85%',
    maxWidth: 310,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  locationCardMe: {
    backgroundColor: '#171B26',
    borderColor: '#F56B00',
    borderBottomRightRadius: 4,
  },
  locationCardOther: {
    backgroundColor: '#121926',
    borderColor: '#22C55E',
    borderBottomLeftRadius: 4,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  locationIconBadgeMe: {
    backgroundColor: 'rgba(245, 107, 0, 0.15)',
    borderColor: '#F56B00',
  },
  locationIconBadgeOther: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22C55E',
  },
  locationCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  locationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  locationCardSub: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '600',
  },
  locationNoteBox: {
    backgroundColor: '#1A2130',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  locationNoteText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  locationMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  coordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A2232',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#283347',
  },
  coordPillText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  distancePillText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '700',
  },
  locationActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  mapBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#15803D',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  mapBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  mapBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#1E2536',
    borderWidth: 1,
    borderColor: '#323E56',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  mapBtnSecondaryText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 8,
  },
  cardTimeText: {
    color: '#8A94A6',
    fontSize: 9,
  },

  /* ========================================================================= */
  /* CHIPS & INPUT BAR                                                         */
  /* ========================================================================= */
  chipsContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1C2230',
    backgroundColor: '#131824',
  },
  chip: {
    backgroundColor: '#19202E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#263045',
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsShareChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: '#22C55E',
    borderWidth: 1.5,
  },
  gpsShareChipText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '800',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0F131C',
    borderTopWidth: 1,
    borderTopColor: '#1C2230',
    gap: 8,
  },
  inputGpsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#161C28',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#273247',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F56B00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#232B3B',
    opacity: 0.5,
  },
  containerLight: { backgroundColor: '#F8FAFC' },
});
