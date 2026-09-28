import { Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Booking } from '../types';

// Curated Pan-India coordinates dictionary for fallback location matching
const KNOWN_AREAS: Record<string, { lat: number; lng: number }> = {
  // Bengaluru
  'kempegowda international airport': { lat: 13.1986, lng: 77.7066 },
  'blr airport': { lat: 13.1986, lng: 77.7066 },
  'terminal 2 departures': { lat: 13.2001, lng: 77.7088 },
  'terminal 1': { lat: 13.1986, lng: 77.7066 },
  'indiranagar': { lat: 12.9784, lng: 77.6408 },
  'indiranagar 100ft': { lat: 12.9784, lng: 77.6408 },
  'koramangala': { lat: 12.9352, lng: 77.6245 },
  'koramangala 4th block': { lat: 12.9340, lng: 77.6290 },
  'koramangala 5th block': { lat: 12.9352, lng: 77.6180 },
  'hsr layout': { lat: 12.9121, lng: 77.6446 },
  'whitefield': { lat: 12.9698, lng: 77.7500 },
  'mg road': { lat: 12.9756, lng: 77.6066 },
  'brigade road': { lat: 12.9720, lng: 77.6080 },
  'jayanagar': { lat: 12.9308, lng: 77.5838 },
  'jp nagar': { lat: 12.9077, lng: 77.5867 },
  'electronic city': { lat: 12.8452, lng: 77.6602 },
  'marathahalli': { lat: 12.9591, lng: 77.6974 },
  'bellandur': { lat: 12.9304, lng: 77.6784 },
  'hebbal': { lat: 13.0358, lng: 77.5970 },
  'manyata tech park': { lat: 13.0485, lng: 77.6200 },
  'cubbon park': { lat: 12.9763, lng: 77.5929 },
  'majestic': { lat: 12.9767, lng: 77.5713 },
  'kr puram': { lat: 13.0075, lng: 77.6959 },
  'sarjapur road': { lat: 12.9110, lng: 77.6830 },
  'banashankari': { lat: 12.9255, lng: 77.5468 },
  'malleshwaram': { lat: 13.0031, lng: 77.5643 },
  'rajajinagar': { lat: 12.9982, lng: 77.5530 },

  // Delhi NCR
  'igi airport': { lat: 28.5562, lng: 77.1000 },
  'delhi airport': { lat: 28.5562, lng: 77.1000 },
  'terminal 3': { lat: 28.5562, lng: 77.1000 },
  'connaught place': { lat: 28.6315, lng: 77.2167 },
  'cyber city': { lat: 28.4950, lng: 77.0895 },
  'aerocity': { lat: 28.5492, lng: 77.1215 },
  'vasant kunj': { lat: 28.5398, lng: 77.1534 },
  'hauz khas': { lat: 28.5494, lng: 77.2001 },
  'saket': { lat: 28.5284, lng: 77.2185 },
  'noida sector 18': { lat: 28.5708, lng: 77.3260 },
  'golf course road': { lat: 28.4389, lng: 77.1054 },
};

/**
 * Extracts latitude and longitude from string if formatted as numbers
 */
export function extractCoordsFromString(str?: string | null): { lat: number; lng: number } | null {
  if (!str || typeof str !== 'string') return null;

  // Match: 12.937568,77.562722 (or with spaces)
  const regex = /([-+]?\d{1,2}\.\d+)\s*,\s*([-+]?\d{1,3}\.\d+)/g;
  const matches = [...str.matchAll(regex)];

  if (matches.length > 0) {
    // If multiple coordinate pairs exist, grab the last one for drop or first for pickup
    const firstMatch = matches[0];
    const lat = parseFloat(firstMatch[1]);
    const lng = parseFloat(firstMatch[2]);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Resolves the real customer target coordinates (Pickup Bay or Drop Location)
 */
export function resolveBookingTargetCoords(
  booking: Booking | null,
  driverFallback?: { lat: number; lng: number }
): { lat: number; lng: number; label: string } | null {
  if (!booking) return null;

  const isGoingToDrop = booking.status === 'in_progress';
  const label = isGoingToDrop
    ? (booking.drop_area || 'Passenger Drop Location')
    : (booking.pickup_area || 'Passenger Pickup Bay');

  const primaryAddress = isGoingToDrop ? booking.drop_address : booking.pickup_address;
  const areaName = isGoingToDrop ? booking.drop_area : booking.pickup_area;

  // 1. Check if the address field contains exact GPS coordinates (as written by orange-taxi-rider)
  const parsedCoords = extractCoordsFromString(primaryAddress);
  if (parsedCoords) {
    return {
      lat: parsedCoords.lat,
      lng: parsedCoords.lng,
      label,
    };
  }

  // 2. Check if the area name field contains raw GPS coordinates
  const areaCoords = extractCoordsFromString(areaName);
  if (areaCoords) {
    return {
      lat: areaCoords.lat,
      lng: areaCoords.lng,
      label,
    };
  }

  // 3. Match against known location presets dictionary (longest/most specific match first)
  const normalizedArea = (areaName || '').toLowerCase().trim();
  const normalizedAddress = (primaryAddress || '').toLowerCase().trim();

  const sortedKnownKeys = Object.keys(KNOWN_AREAS).sort((a, b) => b.length - a.length);

  for (const key of sortedKnownKeys) {
    if (normalizedArea.includes(key) || normalizedAddress.includes(key)) {
      return {
        lat: KNOWN_AREAS[key].lat,
        lng: KNOWN_AREAS[key].lng,
        label,
      };
    }
  }

  // 4. Default city center fallback if completely unknown
  if (driverFallback && driverFallback.lat && driverFallback.lng) {
    return {
      lat: driverFallback.lat,
      lng: driverFallback.lng,
      label,
    };
  }

  return {
    lat: 12.9716,
    lng: 77.5946,
    label,
  };
}

/**
 * Direct Google Maps navigation redirect
 * Prioritizes opening native Google Maps app, with seamless web redirect fallback.
 */
export async function openGoogleMaps(lat: number, lng: number, label?: string): Promise<void> {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}

  const destinationParam = `${lat},${lng}`;
  const webGmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationParam}&travelmode=driving`;

  // Native Google Maps scheme
  const nativeGmapsUrl = Platform.select({
    ios: `comgooglemaps://?daddr=${destinationParam}&directionsmode=driving`,
    android: `google.navigation:q=${destinationParam}&mode=d`,
    default: webGmapsUrl,
  });

  try {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const canOpen = await Linking.canOpenURL(nativeGmapsUrl);
      if (canOpen) {
        await Linking.openURL(nativeGmapsUrl);
        return;
      }
    }
    // Fallback to universal web Google Maps (works in browser & opens app if installed)
    await Linking.openURL(webGmapsUrl);
  } catch (err) {
    console.warn('Native Google Maps opening error, falling back to universal web URL:', err);
    try {
      await Linking.openURL(webGmapsUrl);
    } catch (fallbackErr) {
      console.error('Failed to open Google Maps URL:', fallbackErr);
    }
  }
}
