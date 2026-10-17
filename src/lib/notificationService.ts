import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior for driver app
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function registerForDriverPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Driver push notification permissions not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orange-driver-dispatches', {
        name: 'Orange Chauffeur Dispatches & Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#F97316',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    token = tokenData?.data || null;
  } catch (error) {
    console.warn('Error configuring driver push notifications:', error);
  }

  return token;
}

export async function sendDriverLocalNotification(
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        color: '#F97316',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Could not schedule driver local notification:', e);
  }
}

export async function showReturnToAppNotification(targetLabel?: string) {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orange-driver-active-trip', {
        name: 'Orange Chauffeur Active Navigation',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 200],
        lightColor: '#F97316',
        enableVibrate: false,
        showBadge: true,
      });
    }

    await Notifications.scheduleNotificationAsync({
      identifier: 'orange-taxi-active-trip-return',
      content: {
        title: '🚖 Return to Orange Chauffeur',
        body: targetLabel ? `Navigating to ${targetLabel}. Tap to open app.` : 'Active ride in progress. Tap anytime to return to app.',
        data: { url: 'orangetaxidriver://' },
        color: '#F97316',
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Could not post return-to-app notification:', e);
  }
}

export async function clearReturnToAppNotification() {
  try {
    await Notifications.dismissNotificationAsync('orange-taxi-active-trip-return');
  } catch (e) {
    // Ignore error if already dismissed
  }
}
