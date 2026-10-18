import AsyncStorage from '@react-native-async-storage/async-storage';

const DUTY_TRACKER_KEY = '@orange_duty_tracker';

export interface DutyTrackerData {
  dateKey: string;
  accumulatedSeconds: number;
  sessionStart: number | null;
}

export const getLocalDateKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getStartOfTodayMs = (): number => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
};

/**
 * Returns the total accumulated online duty seconds for today.
 * If the chauffeur is currently online, dynamically includes the time elapsed in the current online session.
 */
export async function getTodayOnlineDutySeconds(isCurrentlyOnline: boolean): Promise<number> {
  try {
    const todayKey = getLocalDateKey();
    const stored = await AsyncStorage.getItem(DUTY_TRACKER_KEY);
    let tracker: DutyTrackerData | null = stored ? JSON.parse(stored) : null;

    // Check if new day started
    if (!tracker || tracker.dateKey !== todayKey) {
      const startOfToday = getStartOfTodayMs();
      // If was online across midnight, session started at 00:00 today
      const effectiveSessionStart = isCurrentlyOnline
        ? Math.max(tracker?.sessionStart || 0, startOfToday)
        : null;

      tracker = {
        dateKey: todayKey,
        accumulatedSeconds: 0,
        sessionStart: effectiveSessionStart,
      };
      await AsyncStorage.setItem(DUTY_TRACKER_KEY, JSON.stringify(tracker));
    }

    let totalSeconds = Number(tracker.accumulatedSeconds) || 0;
    if (isCurrentlyOnline) {
      if (tracker.sessionStart) {
        const liveSeconds = Math.max(0, Math.floor((Date.now() - tracker.sessionStart) / 1000));
        totalSeconds += liveSeconds;
      } else {
        // Self-heal: chauffeur is online but sessionStart was not recorded yet
        tracker.sessionStart = Date.now();
        await AsyncStorage.setItem(DUTY_TRACKER_KEY, JSON.stringify(tracker));
      }
    }

    return totalSeconds;
  } catch (err) {
    console.warn('Error reading duty tracker:', err);
    return 0;
  }
}

/**
 * Call when the chauffeur goes ONLINE.
 */
export async function recordChauffeurOnline(): Promise<void> {
  try {
    const todayKey = getLocalDateKey();
    const stored = await AsyncStorage.getItem(DUTY_TRACKER_KEY);
    let tracker: DutyTrackerData | null = stored ? JSON.parse(stored) : null;

    if (!tracker || tracker.dateKey !== todayKey) {
      tracker = {
        dateKey: todayKey,
        accumulatedSeconds: 0,
        sessionStart: Date.now(),
      };
    } else {
      // If already has an open session, preserve it; otherwise start a new session
      if (!tracker.sessionStart) {
        tracker.sessionStart = Date.now();
      }
    }
    await AsyncStorage.setItem(DUTY_TRACKER_KEY, JSON.stringify(tracker));
  } catch (err) {
    console.warn('Error recording online start:', err);
  }
}

/**
 * Call when the chauffeur goes OFFLINE.
 * Accurately adds the elapsed session seconds to accumulatedSeconds and clears sessionStart.
 */
export async function recordChauffeurOffline(): Promise<void> {
  try {
    const todayKey = getLocalDateKey();
    const stored = await AsyncStorage.getItem(DUTY_TRACKER_KEY);
    let tracker: DutyTrackerData | null = stored ? JSON.parse(stored) : null;

    if (tracker) {
      if (tracker.dateKey === todayKey && tracker.sessionStart) {
        const elapsed = Math.max(0, Math.floor((Date.now() - tracker.sessionStart) / 1000));
        tracker.accumulatedSeconds = (Number(tracker.accumulatedSeconds) || 0) + elapsed;
      }
      tracker.sessionStart = null;
      await AsyncStorage.setItem(DUTY_TRACKER_KEY, JSON.stringify(tracker));
    }
  } catch (err) {
    console.warn('Error recording offline stop:', err);
  }
}
