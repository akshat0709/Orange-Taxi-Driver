import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Linking, Dimensions } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Navigation, Crosshair, MapPin, ExternalLink, Car } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F172A' }, { weight: 2 }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F8FAFC' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }, { weight: 1 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#475569' }, { weight: 1.5 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#CBD5E1' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0284C7' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#38BDF8' }] },
];

export const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F4F5F7' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 2 }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1F2937' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E5E7EB' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E5E7EB' }, { weight: 1 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#D1D5DB' }, { weight: 1.5 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#4B5563' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E0E7FF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9CA3AF' }] },
];

interface DriverMapProps {
  driverCoords: { lat: number; lng: number; heading?: number };
  targetCoords?: { lat: number; lng: number; label: string } | null;
  status?: string;
  theme?: 'light' | 'dark';
  onRecenter?: () => void;
  edgePadding?: { top: number; right: number; bottom: number; left: number };
}

export function DriverMap({
  driverCoords,
  targetCoords,
  status,
  theme = 'dark',
  onRecenter,
  edgePadding,
}: DriverMapProps) {
  const mapRef = useRef<MapView>(null);
  const isDark = theme === 'dark';

  // Automatically fit driver and destination in frame
  useEffect(() => {
    if (!mapRef.current) return;
    if (targetCoords && targetCoords.lat && targetCoords.lng) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: driverCoords.lat, longitude: driverCoords.lng },
          { latitude: targetCoords.lat, longitude: targetCoords.lng },
        ],
        {
          edgePadding: edgePadding || { top: 120, right: 60, bottom: 280, left: 60 },
          animated: true,
        }
      );
    } else {
      mapRef.current.animateToRegion({
        latitude: driverCoords.lat,
        longitude: driverCoords.lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 500);
    }
  }, [driverCoords.lat, driverCoords.lng, targetCoords?.lat, targetCoords?.lng]);

  function handleOpenExternalNavigation() {
    if (!targetCoords) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { lat, lng } = targetCoords;
    const label = encodeURIComponent(targetCoords.label || 'Destination');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    }) || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  }

  function handleRecenterPress() {
    Haptics.selectionAsync();
    if (onRecenter) {
      onRecenter();
    }
    mapRef.current?.animateToRegion({
      latitude: driverCoords.lat,
      longitude: driverCoords.lng,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 400);
  }

  const polyline = targetCoords
    ? [
        { latitude: driverCoords.lat, longitude: driverCoords.lng },
        { latitude: targetCoords.lat, longitude: targetCoords.lng },
      ]
    : [];

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        initialRegion={{
          latitude: driverCoords.lat || 12.9719,
          longitude: driverCoords.lng || 77.5937,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsCompass={false}
        showsTraffic={true}
      >
        {/* Driver Chauffeur EV Marker */}
        <Marker
          coordinate={{ latitude: driverCoords.lat, longitude: driverCoords.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat={true}
        >
          <View style={styles.driverCarMarkerWrap}>
            <View style={styles.driverCarHalo} />
            <View
              style={[
                styles.driverCarInner,
                { transform: [{ rotate: `${driverCoords.heading || 0}deg` }] },
              ]}
            >
              <Car size={18} color="#FFFFFF" />
            </View>
          </View>
        </Marker>

        {/* Target Destination Marker (Pickup Bay or Drop Point) */}
        {targetCoords && (
          <Marker
            coordinate={{ latitude: targetCoords.lat, longitude: targetCoords.lng }}
            anchor={{ x: 0.5, y: 1.0 }}
            title={targetCoords.label}
          >
            <View style={styles.targetMarkerWrap}>
              <View
                style={[
                  styles.targetBadge,
                  status === 'accepted' ? styles.targetBadgePickup : styles.targetBadgeDrop,
                ]}
              >
                {status === 'accepted' ? (
                  <MapPin size={15} color="#FFFFFF" />
                ) : (
                  <Navigation size={15} color="#FFFFFF" />
                )}
              </View>
              <View
                style={[
                  styles.targetPinTail,
                  status === 'accepted' ? styles.targetPinPickup : styles.targetPinDrop,
                ]}
              />
            </View>
          </Marker>
        )}

        {/* Route Connecting Line */}
        {polyline.length > 1 && (
          <Polyline
            coordinates={polyline}
            strokeColor={isDark ? '#F97316' : '#18181B'}
            strokeWidth={4.5}
          />
        )}
      </MapView>

      {/* Floating Action Buttons */}
      <View style={styles.floatingControls}>
        {/* Recenter Current GPS Button */}
        <TouchableOpacity
          style={[styles.floatingBtn, isDark && styles.floatingBtnDark]}
          onPress={handleRecenterPress}
          activeOpacity={0.85}
        >
          <Crosshair size={20} color="#F97316" />
        </TouchableOpacity>

        {/* Launch Turn-by-Turn Google Maps / Apple Maps Navigation */}
        {targetCoords && (
          <TouchableOpacity
            style={styles.navLaunchBtn}
            onPress={handleOpenExternalNavigation}
            activeOpacity={0.85}
          >
            <Navigation size={16} color="#FFFFFF" />
            <Text style={styles.navLaunchBtnText}>Turn-by-Turn Nav</Text>
            <ExternalLink size={13} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  driverCarMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  driverCarHalo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
  },
  driverCarInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F97316',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  targetMarkerWrap: {
    alignItems: 'center',
  },
  targetBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  targetBadgePickup: {
    backgroundColor: '#10B981',
  },
  targetBadgeDrop: {
    backgroundColor: '#F97316',
  },
  targetPinTail: {
    width: 2,
    height: 8,
  },
  targetPinPickup: {
    backgroundColor: '#10B981',
  },
  targetPinDrop: {
    backgroundColor: '#F97316',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: 100,
    alignItems: 'flex-end',
    gap: 12,
  },
  floatingBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  floatingBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  navLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#F97316',
  },
  navLaunchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
