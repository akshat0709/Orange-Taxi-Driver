import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  Animated,
  Easing,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Polygon,
  G,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface CoolCarSplashScreenProps {
  onFinish: () => void;
  appType?: 'rider' | 'driver';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CoolCarSplashScreen: React.FC<CoolCarSplashScreenProps> = ({
  onFinish,
  appType = 'driver',
}) => {
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Animation values
  const carTranslateX = useRef(new Animated.Value(-280)).current;
  const speedStreakOpacity = useRef(new Animated.Value(0)).current;
  const roadLinesTranslateX = useRef(new Animated.Value(0)).current;
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.9)).current;
  const screenFadeAnim = useRef(new Animated.Value(1)).current;
  const headlightBeamOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Initial logo fade in
    Animated.parallel([
      Animated.timing(logoFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Road dashed lines continuous movement
    const roadLoop = Animated.loop(
      Animated.timing(roadLinesTranslateX, {
        toValue: -80,
        duration: 350,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    roadLoop.start();

    // 3. Headlight glow & beam flare
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(headlightBeamOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 4. Car zoom sequence from left to right
    const carSequence = Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        // Car speed curve: enters with acceleration and zooms past screen edge
        Animated.timing(carTranslateX, {
          toValue: SCREEN_WIDTH + 320,
          duration: 1750,
          easing: Easing.bezier(0.38, 0.05, 0.15, 1.0),
          useNativeDriver: true,
        }),
        // Speed streaks fade in during peak velocity
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(speedStreakOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(700),
          Animated.timing(speedStreakOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // 5. Fade out entire splash overlay
      Animated.timing(screenFadeAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    // Haptic feedback timed with peak acceleration
    const hapticTimer = setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }, 700);

    const secondaryHapticTimer = setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }, 1100);

    carSequence.start(({ finished }) => {
      if (finished) {
        roadLoop.stop();
        if (onFinishRef.current) {
          onFinishRef.current();
        }
      }
    });

    return () => {
      clearTimeout(hapticTimer);
      clearTimeout(secondaryHapticTimer);
      roadLoop.stop();
    };
  }, []);

  const handleSkip = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    Animated.timing(screenFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (onFinishRef.current) {
        onFinishRef.current();
      }
    });
  };

  const isRider = appType === 'rider';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: screenFadeAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <StatusBar barStyle="light-content" backgroundColor="#07090E" />

      {/* Ambient background glow */}
      <View style={styles.ambientGlow} />

      {/* Skip button for instant bypass */}
      <TouchableOpacity
        style={styles.skipButton}
        activeOpacity={0.7}
        onPress={handleSkip}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Center Branding Header */}
      <Animated.View
        style={[
          styles.brandContainer,
          {
            opacity: logoFadeAnim,
            transform: [{ scale: logoScaleAnim }],
          },
        ]}
      >
        <View style={styles.brandTitleRow}>
          <Text style={styles.brandOrange}>ORANGE</Text>
          <Text style={styles.brandTaxi}>TAXI</Text>
          <View style={styles.brandDot} />
        </View>

        <View style={styles.badgePill}>
          <Text style={styles.badgeIcon}>⚡</Text>
          <Text style={styles.badgeText}>
            {isRider ? '100% ELECTRIC CHAUFFEUR FLEET' : 'CHAUFFEUR PARTNER NETWORK'}
          </Text>
        </View>

        <Text style={styles.brandTagline}>
          {isRider
            ? 'Mahindra BE.6 Signature Luxury EV'
            : 'Zero Commission · Daily Payouts · Elite Fleet'}
        </Text>
      </Animated.View>

      {/* Road & Speeding Car Canvas */}
      <View style={styles.roadContainer}>
        {/* Upper Road Guardrail */}
        <View style={styles.guardrailTop} />

        {/* Asphalt surface */}
        <View style={styles.asphaltSurface}>
          {/* Animated dashed road lane markings */}
          <Animated.View
            style={[
              styles.dashedRoadLineRow,
              {
                transform: [{ translateX: roadLinesTranslateX }],
              },
            ]}
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <View key={i} style={styles.dashSegment} />
            ))}
          </Animated.View>

          {/* Speed Streaks behind / surrounding car */}
          <Animated.View
            style={[
              styles.speedStreakRow,
              {
                opacity: speedStreakOpacity,
              },
            ]}
          >
            <View style={[styles.speedStreak, { width: 90, top: 8 }]} />
            <View style={[styles.speedStreak, { width: 140, top: 22, opacity: 0.8 }]} />
            <View style={[styles.speedStreak, { width: 110, top: 40, opacity: 0.9 }]} />
            <View style={[styles.speedStreak, { width: 70, top: 58, opacity: 0.6 }]} />
          </Animated.View>

          {/* The High-Speed Animated Orange Taxi EV Car */}
          <Animated.View
            style={[
              styles.carWrapper,
              {
                transform: [{ translateX: carTranslateX }],
              },
            ]}
          >
            {/* Forward Headlight Projector Beam */}
            <Animated.View
              style={[
                styles.headlightBeamContainer,
                { opacity: headlightBeamOpacity },
              ]}
            >
              <Svg width={180} height={70} viewBox="0 0 180 70">
                <Defs>
                  <LinearGradient id="driverBeamGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                    <Stop offset="0%" stopColor="#FEF08A" stopOpacity="0.75" />
                    <Stop offset="30%" stopColor="#FEF08A" stopOpacity="0.35" />
                    <Stop offset="100%" stopColor="#FEF08A" stopOpacity="0.0" />
                  </LinearGradient>
                </Defs>
                <Polygon points="0,32 180,0 180,68 0,44" fill="url(#driverBeamGrad)" />
              </Svg>
            </Animated.View>

            {/* Twin Rear High-Speed Jet/Light Trails */}
            <View style={styles.tailLightTrails}>
              <View style={[styles.tailLightStreak, { width: 90, top: 24 }]} />
              <View style={[styles.tailLightStreak, { width: 130, top: 28, backgroundColor: '#F97316' }]} />
              <View style={[styles.tailLightStreak, { width: 75, top: 32 }]} />
            </View>

            {/* Neon Underglow on Asphalt */}
            <View style={styles.underglow} />

            {/* Vector Illustration of Mahindra BE.6 Signature EV */}
            <Svg width={230} height={72} viewBox="0 0 230 72">
              <Defs>
                {/* Body Metallic Gradient */}
                <LinearGradient id="driverCarBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FB923C" />
                  <Stop offset="40%" stopColor="#F97316" />
                  <Stop offset="85%" stopColor="#EA580C" />
                  <Stop offset="100%" stopColor="#C2410C" />
                </LinearGradient>

                {/* Roof / Glass Tint Gradient */}
                <LinearGradient id="driverGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#0F172A" stopOpacity="0.95" />
                  <Stop offset="100%" stopColor="#1E293B" stopOpacity="0.8" />
                </LinearGradient>

                {/* Wheel Rim Gradient */}
                <RadialGradient id="driverRimGrad" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#94A3B8" />
                  <Stop offset="55%" stopColor="#475569" />
                  <Stop offset="100%" stopColor="#0F172A" />
                </RadialGradient>
              </Defs>

              {/* 1. Sleek Aerodynamic Roof & Glasshouse */}
              <Path
                d="M 60 28 L 92 12 Q 130 9 162 13 L 186 28 Z"
                fill="url(#driverGlassGrad)"
                stroke="#F97316"
                strokeWidth="0.8"
              />

              {/* Chauffeur & Cabin silhouette */}
              <Circle cx="120" cy="22" r="5" fill="#334155" opacity="0.85" />
              <Path d="M 112 28 Q 120 25 128 28 Z" fill="#334155" />

              {/* Glass Pillar separator */}
              <Rect x="127" y="12" width="4" height="16" fill="#0F172A" />

              {/* 2. Main Mahindra BE.6 Aerodynamic Body Shell */}
              <Path
                d="M 12 40 
                   Q 10 32 20 31 
                   L 58 29 
                   L 88 12 
                   Q 135 8 168 13 
                   L 194 28 
                   L 214 33 
                   Q 224 35 224 43 
                   L 220 50 
                   Q 218 53 210 53 
                   L 188 53 
                   Q 186 42 172 42 
                   Q 158 42 156 53 
                   L 82 53 
                   Q 80 42 66 42 
                   Q 52 42 50 53 
                   L 20 53 
                   Q 13 53 12 45 Z"
                fill="url(#driverCarBodyGrad)"
              />

              {/* Signature Electric Orange Taxi Side Cladding / Aero Accent */}
              <Path
                d="M 50 51 L 82 51 Q 90 49 105 49 L 140 49 Q 150 49 156 51 L 188 51"
                stroke="#0F172A"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Distinctive Orange Taxi Door Decal / Accent Stripe */}
              <Path
                d="M 76 36 L 150 36"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeOpacity="0.9"
                strokeLinecap="round"
              />
              <Path
                d="M 95 39 L 132 39"
                stroke="#FEF08A"
                strokeWidth="1.2"
                strokeOpacity="0.8"
              />

              {/* 3. Front Headlight Cluster (Quad LED Beam) */}
              <Path
                d="M 214 34 L 223 37 L 219 41 L 211 39 Z"
                fill="#FEF08A"
              />
              <Circle cx="218" cy="38" r="2" fill="#FFFFFF" />

              {/* 4. Rear Connected Taillight Bar (Vivid Amber/Red LED) */}
              <Path
                d="M 14 34 L 18 34 L 17 40 L 13 39 Z"
                fill="#EF4444"
              />
              <Rect x="12" y="36" width="3" height="4" rx="1.5" fill="#F97316" />

              {/* 5. Aerodynamic Rear Spoiler */}
              <Path
                d="M 10 32 L 24 30 L 22 28 L 8 30 Z"
                fill="#0F172A"
              />

              {/* 6. Front Wheel Assembly */}
              <G transform="translate(172, 53)">
                {/* Tire Outer */}
                <Circle cx="0" cy="0" r="14" fill="#0B0D11" stroke="#1E293B" strokeWidth="2.5" />
                {/* Alloy Wheel Rim */}
                <Circle cx="0" cy="0" r="10" fill="url(#driverRimGrad)" />
                {/* Aero Turbine Spokes */}
                <Rect x="-1.5" y="-9" width="3" height="18" fill="#F8FAFC" rx="1" />
                <Rect x="-9" y="-1.5" width="18" height="3" fill="#F8FAFC" rx="1" />
                {/* Brake Caliper in Orange */}
                <Path d="M -4 -8 A 8 8 0 0 1 4 -8" stroke="#F97316" strokeWidth="3" fill="none" />
                {/* Center Cap */}
                <Circle cx="0" cy="0" r="3.5" fill="#F97316" />
              </G>

              {/* 7. Rear Wheel Assembly */}
              <G transform="translate(66, 53)">
                {/* Tire Outer */}
                <Circle cx="0" cy="0" r="14" fill="#0B0D11" stroke="#1E293B" strokeWidth="2.5" />
                {/* Alloy Wheel Rim */}
                <Circle cx="0" cy="0" r="10" fill="url(#driverRimGrad)" />
                {/* Aero Turbine Spokes */}
                <Rect x="-1.5" y="-9" width="3" height="18" fill="#F8FAFC" rx="1" />
                <Rect x="-9" y="-1.5" width="18" height="3" fill="#F8FAFC" rx="1" />
                {/* Brake Caliper in Orange */}
                <Path d="M -4 -8 A 8 8 0 0 1 4 -8" stroke="#F97316" strokeWidth="3" fill="none" />
                {/* Center Cap */}
                <Circle cx="0" cy="0" r="3.5" fill="#F97316" />
              </G>
            </Svg>
          </Animated.View>
        </View>

        {/* Lower Road Guardrail / Neon Ground Line */}
        <View style={styles.guardrailBottom} />
      </View>

      {/* Footer loading indicator & subtitle */}
      <View style={styles.footerContainer}>
        <View style={styles.loadingBarWrapper}>
          <View style={styles.loadingBarFill} />
        </View>
        <Text style={styles.footerNote}>
          {isRider
            ? 'Preparing your executive chauffeur journey...'
            : 'Connecting to chauffeur dispatch grid...'}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#07090E',
    zIndex: 999999,
    justifyContent: 'space-between',
    paddingVertical: 50,
  },
  ambientGlow: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: (SCREEN_WIDTH * 0.7) / 2,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  skipButton: {
    position: 'absolute',
    top: 54,
    right: 24,
    zIndex: 1000000,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  skipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandOrange: {
    fontSize: 34,
    fontWeight: '900',
    color: '#F97316',
    letterSpacing: 2,
  },
  brandTaxi: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F97316',
    marginLeft: 2,
    marginTop: 4,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  badgeIcon: {
    fontSize: 11,
    color: '#F97316',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F97316',
    letterSpacing: 1.2,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 10,
    letterSpacing: 0.3,
  },
  roadContainer: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 40,
  },
  guardrailTop: {
    height: 2,
    backgroundColor: 'rgba(249, 115, 22, 0.3)',
    shadowColor: '#F97316',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  asphaltSurface: {
    flex: 1,
    backgroundColor: '#0D111A',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  dashedRoadLineRow: {
    position: 'absolute',
    top: '52%',
    left: 0,
    flexDirection: 'row',
    gap: 24,
    width: SCREEN_WIDTH * 2,
  },
  dashSegment: {
    width: 38,
    height: 3,
    backgroundColor: 'rgba(254, 240, 138, 0.55)',
    borderRadius: 1.5,
  },
  speedStreakRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  speedStreak: {
    position: 'absolute',
    right: 30,
    height: 2,
    backgroundColor: '#F97316',
    borderRadius: 1,
  },
  carWrapper: {
    position: 'absolute',
    left: 0,
    top: '22%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headlightBeamContainer: {
    position: 'absolute',
    left: 216,
    top: 0,
    zIndex: -1,
  },
  tailLightTrails: {
    position: 'absolute',
    right: 216,
    top: 10,
    zIndex: -1,
  },
  tailLightStreak: {
    position: 'absolute',
    right: 0,
    height: 2,
    backgroundColor: '#EF4444',
    borderRadius: 1,
    opacity: 0.85,
  },
  underglow: {
    position: 'absolute',
    left: 30,
    bottom: 3,
    width: 170,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(249, 115, 22, 0.7)',
    shadowColor: '#F97316',
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },
  guardrailBottom: {
    height: 2,
    backgroundColor: 'rgba(249, 115, 22, 0.65)',
    shadowColor: '#F97316',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  footerContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  loadingBarWrapper: {
    width: 120,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingBarFill: {
    width: '60%',
    height: '100%',
    backgroundColor: '#F97316',
    borderRadius: 2,
  },
  footerNote: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.3,
  },
});
