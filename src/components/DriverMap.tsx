import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { Navigation, Crosshair, MapPin, ExternalLink, Car, Zap, Flame, Map, X, Clock, BatteryCharging } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { openGoogleMaps } from '../lib/locationResolver';

const { width, height } = Dimensions.get('window');

export interface EVChargerBay {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  powerKw: number;
  totalBays: number;
  availableBays: number;
  pricing: string;
  chargingSpeed: string;
  connectorType: string;
  verifiedForBe6: boolean;
}

export const VERIFIED_BE6_CHARGERS: EVChargerBay[] = [
  {
    id: 'charger-blr-airport',
    name: 'Jio-bp Pulse EV Charging Hub',
    area: 'BLR Airport Terminal 2 Departures',
    lat: 13.2001,
    lng: 77.7088,
    powerKw: 150,
    totalBays: 6,
    availableBays: 4,
    pricing: '₹15.5/kWh (Orange Fleet Rate)',
    chargingSpeed: '10% to 80% in 15 mins (Dual Gun DC)',
    connectorType: 'CCS2 150kW DC Fast',
    verifiedForBe6: true,
  },
  {
    id: 'charger-indiranagar',
    name: 'Tata Power EZ Charge - Indiranagar',
    area: '100ft Road, Near CMH Signal, Indiranagar',
    lat: 12.9784,
    lng: 77.6408,
    powerKw: 120,
    totalBays: 4,
    availableBays: 2,
    pricing: '₹16/kWh (Orange Partner)',
    chargingSpeed: '10% to 80% in 18 mins (120kW DC)',
    connectorType: 'CCS2 120kW DC Fast',
    verifiedForBe6: true,
  },
  {
    id: 'charger-koramangala',
    name: 'Ather & Tata Power Superfast Bay',
    area: '4th Block, 80ft Road, Koramangala',
    lat: 12.9340,
    lng: 77.6290,
    powerKw: 60,
    totalBays: 4,
    availableBays: 3,
    pricing: '₹15/kWh (Orange Fleet Rate)',
    chargingSpeed: '20% to 80% in 28 mins (60kW DC)',
    connectorType: 'CCS2 60kW DC Fast',
    verifiedForBe6: true,
  },
  {
    id: 'charger-ecity',
    name: 'Statiq Ultra EV Hub',
    area: 'Phase 1, Electronic City (Near Toll Gate)',
    lat: 12.8452,
    lng: 77.6602,
    powerKw: 120,
    totalBays: 2,
    availableBays: 2,
    pricing: '₹16/kWh (Orange Partner)',
    chargingSpeed: '10% to 80% in 18 mins (120kW DC)',
    connectorType: 'CCS2 120kW DC Fast',
    verifiedForBe6: true,
  },
  {
    id: 'charger-delhi-igi',
    name: 'BluSmart & Jio-bp Mega Hub T3',
    area: 'IGI Airport T3 Multi-Level Parking',
    lat: 28.5562,
    lng: 77.1000,
    powerKw: 150,
    totalBays: 8,
    availableBays: 5,
    pricing: '₹15/kWh (Orange Fleet Rate)',
    chargingSpeed: '10% to 80% in 15 mins (150kW Ultra)',
    connectorType: 'CCS2 150kW DC Ultra',
    verifiedForBe6: true,
  },
  {
    id: 'charger-aerocity',
    name: 'Tata Power Fast Bay - Aerocity',
    area: 'Hospitality District, Aerocity, New Delhi',
    lat: 28.5492,
    lng: 77.1215,
    powerKw: 60,
    totalBays: 4,
    availableBays: 2,
    pricing: '₹16.5/kWh (Orange Partner)',
    chargingSpeed: '20% to 80% in 30 mins (60kW DC)',
    connectorType: 'CCS2 60kW DC Fast',
    verifiedForBe6: true,
  },
];

export interface DemandHotspot {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  multiplier: string;
  surgeLevel: 'extreme' | 'high' | 'moderate';
  activeRiderRequests: number;
}

export const DEMAND_HOTSPOTS: DemandHotspot[] = [
  {
    id: 'surge-blr-airport',
    name: 'BLR Airport High Demand',
    area: 'Kempegowda Int Airport T1 & T2',
    lat: 13.1986,
    lng: 77.7066,
    radiusMeters: 2800,
    multiplier: '1.4x',
    surgeLevel: 'extreme',
    activeRiderRequests: 42,
  },
  {
    id: 'surge-koramangala',
    name: 'Koramangala Tech & Nightlife',
    area: 'Koramangala 4th & 5th Block',
    lat: 12.9352,
    lng: 77.6245,
    radiusMeters: 1800,
    multiplier: '1.3x',
    surgeLevel: 'high',
    activeRiderRequests: 28,
  },
  {
    id: 'surge-indiranagar',
    name: 'Indiranagar 100ft Dining & Retail',
    area: 'Indiranagar Metro & 100ft Road',
    lat: 12.9784,
    lng: 77.6408,
    radiusMeters: 1500,
    multiplier: '1.25x',
    surgeLevel: 'moderate',
    activeRiderRequests: 19,
  },
  {
    id: 'surge-aerocity',
    name: 'Aerocity Hospitality District',
    area: 'Aerocity Hotels & Business Park',
    lat: 28.5492,
    lng: 77.1215,
    radiusMeters: 1800,
    multiplier: '1.35x',
    surgeLevel: 'high',
    activeRiderRequests: 31,
  },
  {
    id: 'surge-delhi-igi',
    name: 'IGI Airport Arrivals & Departures',
    area: 'IGI Airport Terminal 3',
    lat: 28.5562,
    lng: 77.1000,
    radiusMeters: 2500,
    multiplier: '1.4x',
    surgeLevel: 'extreme',
    activeRiderRequests: 48,
  },
  {
    id: 'surge-ecity',
    name: 'Electronic City IT Hub',
    area: 'Phase 1 Toll & Tech Corridors',
    lat: 12.8452,
    lng: 77.6602,
    radiusMeters: 2000,
    multiplier: '1.2x',
    surgeLevel: 'moderate',
    activeRiderRequests: 16,
  },
];

// Executive, high-contrast dark cartography for dark theme mode
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
  demandPoints?: {latitude: number, longitude: number, weight: number}[];
  driverCoords: { lat: number; lng: number; heading?: number };
  targetCoords?: { lat: number; lng: number; label: string } | null;
  status?: string;
  theme?: 'light' | 'dark';
  onRecenter?: () => void;
  edgePadding?: { top: number; right: number; bottom: number; left: number };
}


export function decodePolyline(encoded: string) {
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    poly.push({ latitude: (lat / 1E5), longitude: (lng / 1E5) });
  }
  return poly;
}

export function DriverMap({
  demandPoints = [],
  driverCoords,
  targetCoords,
  status,
  theme = 'dark',
  onRecenter,
  edgePadding,
}: DriverMapProps) {
  const mapRef = useRef<MapView>(null);
  const isDark = theme === 'dark';
  const [mapMode, setMapMode] = useState<'standard' | 'heatmap' | 'chargers'>('standard');
  const [selectedCharger, setSelectedCharger] = useState<EVChargerBay | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<DemandHotspot | null>(null);

  const handleSetMapMode = (mode: 'standard' | 'heatmap' | 'chargers') => {
    Haptics.selectionAsync();
    setMapMode(mode);
    setSelectedCharger(null);
    setSelectedHotspot(null);
  };

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
    openGoogleMaps(targetCoords.lat, targetCoords.lng, targetCoords.label);
  }

  function handleRecenterPress() {
    try {
      Haptics.selectionAsync();
    } catch {}
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


  // -------------------------------------------------------------------------
  // GOOGLE DIRECTIONS API FETCH
  // -------------------------------------------------------------------------
  const [routePolyline, setRoutePolyline] = React.useState<{latitude: number, longitude: number}[]>([]);

  useEffect(() => {
    if (!driverCoords.lat || !targetCoords?.lat) {
        setRoutePolyline([]);
        return;
    }

    const origin = `${driverCoords.lat},${driverCoords.lng}`;
    const destination = `${targetCoords.lat},${targetCoords.lng}`;
    const API_KEY = "AIzaSyD-IOH9cMppWtKjw_zn-m7XOE3ut62HVX8";
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${API_KEY}`;
    
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
            const encoded = data.routes[0].overview_polyline.points;
            setRoutePolyline(decodePolyline(encoded));
        }
      })
      .catch(e => console.log("Directions fetch error:", e));

  }, [driverCoords.lat, targetCoords?.lat]);

  const fallbackPolyline = targetCoords
    ? [
        { latitude: driverCoords.lat, longitude: driverCoords.lng },
        { latitude: targetCoords.lat, longitude: targetCoords.lng },
      ]
    : [];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
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
                  status === 'accepted' || status === 'arrived' ? styles.targetBadgePickup : styles.targetBadgeDrop,
                ]}
              >
                {status === 'accepted' || status === 'arrived' ? (
                  <MapPin size={15} color="#FFFFFF" />
                ) : (
                  <Navigation size={15} color="#FFFFFF" />
                )}
              </View>
              <View
                style={[
                  styles.targetPinTail,
                  status === 'accepted' || status === 'arrived' ? styles.targetPinPickup : styles.targetPinDrop,
                ]}
              />
            </View>
          </Marker>
        )}

        {/* Route Connecting Line */}
        {(routePolyline.length > 1 || fallbackPolyline.length > 1) && (
          <Polyline
            coordinates={routePolyline.length > 0 ? routePolyline : fallbackPolyline}
            strokeColor={isDark ? '#F97316' : '#18181B'}
            strokeWidth={4.5}
            lineDashPattern={[0]}
          />
        )}
      
        {/* Demand Heatmap Overlays (Circles + Multiplier Badges) */}
        {mapMode === 'heatmap' && DEMAND_HOTSPOTS.map((spot) => (
          <React.Fragment key={spot.id}>
            <Circle
              center={{ latitude: spot.lat, longitude: spot.lng }}
              radius={spot.radiusMeters}
              fillColor={spot.surgeLevel === 'extreme' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(249, 115, 22, 0.18)'}
              strokeColor={spot.surgeLevel === 'extreme' ? '#EF4444' : '#F97316'}
              strokeWidth={2}
            />
            <Marker
              coordinate={{ latitude: spot.lat, longitude: spot.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedHotspot(spot);
                setSelectedCharger(null);
              }}
            >
              <View style={styles.surgeBadgeMarker}>
                <Flame size={12} color="#FFFFFF" />
                <Text style={styles.surgeBadgeMultiplier}>{spot.multiplier}</Text>
                <Text style={styles.surgeBadgeName}>{spot.name.split(' ')[0]}</Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* Verified Mahindra BE.6 Fast Charging Bays */}
        {mapMode === 'chargers' && VERIFIED_BE6_CHARGERS.map((charger) => (
          <Marker
            key={charger.id}
            coordinate={{ latitude: charger.lat, longitude: charger.lng }}
            anchor={{ x: 0.5, y: 1.0 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedCharger(charger);
              setSelectedHotspot(null);
            }}
          >
            <View style={styles.chargerMarkerWrap}>
              <View style={styles.chargerMarkerBadge}>
                <Zap size={13} color="#FFFFFF" />
                <Text style={styles.chargerMarkerPower}>{charger.powerKw}kW DC</Text>
              </View>
              <View style={styles.chargerPinTail} />
            </View>
          </Marker>
        ))}

      </MapView>

      {/* Top Map Mode Floating Switcher: [🔥 Demand] | [⚡ EV Hubs] | [🗺️ Standard] */}
      <View style={[styles.modeToggleBar, isDark ? styles.modeToggleBarDark : styles.modeToggleBarLight]}>
        <TouchableOpacity
          style={[
            styles.modeToggleBtn,
            mapMode === 'heatmap' && styles.modeToggleBtnActiveHeatmap,
          ]}
          onPress={() => handleSetMapMode('heatmap')}
          activeOpacity={0.8}
        >
          <Flame size={13} color={mapMode === 'heatmap' ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')} />
          <Text style={[
            styles.modeToggleText,
            isDark ? styles.textMutedDark : styles.textMutedLight,
            mapMode === 'heatmap' && styles.modeToggleTextActiveHeatmap,
          ]}>
            Demand
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeToggleBtn,
            mapMode === 'chargers' && styles.modeToggleBtnActiveCharger,
          ]}
          onPress={() => handleSetMapMode('chargers')}
          activeOpacity={0.8}
        >
          <Zap size={13} color={mapMode === 'chargers' ? '#10B981' : (isDark ? '#94A3B8' : '#64748B')} />
          <Text style={[
            styles.modeToggleText,
            isDark ? styles.textMutedDark : styles.textMutedLight,
            mapMode === 'chargers' && styles.modeToggleBtnActiveChargerText,
          ]}>
            EV Hubs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeToggleBtn,
            mapMode === 'standard' && (isDark ? styles.modeToggleBtnActiveStandardDark : styles.modeToggleBtnActiveStandardLight),
          ]}
          onPress={() => handleSetMapMode('standard')}
          activeOpacity={0.8}
        >
          <Map size={13} color={mapMode === 'standard' ? '#F97316' : (isDark ? '#94A3B8' : '#64748B')} />
          <Text style={[
            styles.modeToggleText,
            isDark ? styles.textMutedDark : styles.textMutedLight,
            mapMode === 'standard' && styles.modeToggleTextActiveStandard,
          ]}>
            Standard
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected Charger Bay Bottom Card */}
      {selectedCharger && (
        <View style={[styles.bottomCard, isDark ? styles.bottomCardDark : styles.bottomCardLight]}>
          <View style={styles.bottomCardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.chargerCardTypeRow}>
                <View style={styles.be6VerifiedPill}>
                  <Zap size={11} color="#10B981" />
                  <Text style={styles.be6VerifiedPillText}>Mahindra BE.6 Verified</Text>
                </View>
                <Text style={styles.baysFreeBadge}>
                  {selectedCharger.availableBays}/{selectedCharger.totalBays} Bays Free
                </Text>
              </View>
              <Text style={[styles.stationTitle, isDark ? styles.textWhite : styles.textDark]}>
                {selectedCharger.name}
              </Text>
              <Text style={styles.stationArea}>{selectedCharger.area}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedCharger(null)}
              style={styles.cardCloseBtn}
            >
              <X size={16} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <View style={styles.stationSpecsRow}>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Power Output</Text>
              <Text style={styles.specValue}>{selectedCharger.powerKw} kW DC</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Est. Speed</Text>
              <Text style={styles.specValue}>{selectedCharger.chargingSpeed.split('(')[0]}</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specLabel}>Tariff</Text>
              <Text style={styles.specValue}>{selectedCharger.pricing.split('(')[0]}</Text>
            </View>
          </View>

          {/* 1-Tap Direct Turn-by-turn Navigation Button */}
          <TouchableOpacity
            style={styles.chargerNavBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              openGoogleMaps(selectedCharger.lat, selectedCharger.lng, selectedCharger.name);
            }}
            activeOpacity={0.88}
          >
            <Navigation size={16} color="#FFFFFF" />
            <Text style={styles.chargerNavBtnText}>START DIRECT NAVIGATION TO CHARGER</Text>
            <ExternalLink size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Selected Hotspot Surge Card */}
      {selectedHotspot && (
        <View style={[styles.bottomCard, isDark ? styles.bottomCardDark : styles.bottomCardLight]}>
          <View style={styles.bottomCardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.chargerCardTypeRow}>
                <View style={[styles.be6VerifiedPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Flame size={11} color="#EF4444" />
                  <Text style={[styles.be6VerifiedPillText, { color: '#EF4444' }]}>High Demand Hotspot</Text>
                </View>
                <Text style={[styles.baysFreeBadge, { color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  {selectedHotspot.multiplier} Multiplier
                </Text>
              </View>
              <Text style={[styles.stationTitle, isDark ? styles.textWhite : styles.textDark]}>
                {selectedHotspot.name}
              </Text>
              <Text style={styles.stationArea}>{selectedHotspot.area} · ~{selectedHotspot.activeRiderRequests} Active Rider Requests</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedHotspot(null)}
              style={styles.cardCloseBtn}
            >
              <X size={16} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.chargerNavBtn, { backgroundColor: '#EF4444' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              openGoogleMaps(selectedHotspot.lat, selectedHotspot.lng, selectedHotspot.name);
            }}
            activeOpacity={0.88}
          >
            <Navigation size={16} color="#FFFFFF" />
            <Text style={styles.chargerNavBtnText}>NAVIGATE TO SURGE ZONE</Text>
            <ExternalLink size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

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

        {/* Launch Google Maps Navigation */}
        {targetCoords && (
          <TouchableOpacity
            style={styles.navLaunchBtn}
            onPress={handleOpenExternalNavigation}
            activeOpacity={0.85}
          >
            <Navigation size={16} color="#FFFFFF" />
            <Text style={styles.navLaunchBtnText}>Navigate</Text>
            <ExternalLink size={13} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
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
  modeToggleBar: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 84 : 112,
    left: 16,
    right: 16,
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    zIndex: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modeToggleBarDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeToggleBarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeToggleBtnActiveHeatmap: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  modeToggleBtnActiveCharger: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  modeToggleBtnActiveStandardDark: {
    backgroundColor: '#334155',
  },
  modeToggleBtnActiveStandardLight: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modeToggleTextActiveHeatmap: {
    color: '#EF4444',
    fontWeight: '800',
  },
  modeToggleBtnActiveChargerText: {
    color: '#10B981',
    fontWeight: '800',
  },
  modeToggleTextActiveStandard: {
    color: '#F97316',
    fontWeight: '800',
  },
  textMutedDark: {
    color: '#94A3B8',
  },
  textMutedLight: {
    color: '#64748B',
  },
  surgeBadgeMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  surgeBadgeMultiplier: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  surgeBadgeName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.9,
  },
  chargerMarkerWrap: {
    alignItems: 'center',
  },
  chargerMarkerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  chargerMarkerPower: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  chargerPinTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#10B981',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 16,
    zIndex: 95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomCardDark: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bottomCardLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bottomCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chargerCardTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  be6VerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  be6VerifiedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  baysFreeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stationTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  stationArea: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  stationSpecsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    marginBottom: 12,
  },
  specItem: {
    flex: 1,
  },
  specLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  specValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 2,
  },
  chargerNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  chargerNavBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#0F172A',
  },
});
