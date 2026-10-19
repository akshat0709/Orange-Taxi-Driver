import { Vibration, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

class SoundService {
  private isPlayingDispatchAlert = false;

  async configureAudioMode() {
    // Audio configuration stub - purely native haptics/vibration for guaranteed stability
  }

  async playDispatchAlert() {
    // 1. Rhythmic high-urgency vibration pattern: vibrates immediately, then pulses continuously
    try {
      Vibration.vibrate([0, 600, 250, 600, 250, 1000], true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } catch (e) {
      console.warn('[SoundService] Vibration error:', e);
    }

    if (this.isPlayingDispatchAlert) return;
    this.isPlayingDispatchAlert = true;
    console.log('[SoundService] Dispatch alert playing with high-urgency vibration pattern');
  }

  async stopDispatchAlert() {
    try {
      Vibration.cancel();
    } catch (e) {
      console.warn('[SoundService] Vibration cancel error:', e);
    } finally {
      this.isPlayingDispatchAlert = false;
      console.log('[SoundService] Dispatch alert vibration stopped');
    }
  }

  async playAcceptChime() {
    await this.stopDispatchAlert();

    // Haptic feedback chime vibration
    try {
      Vibration.vibrate([0, 120, 80, 150]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      console.warn('[SoundService] Could not trigger accept haptic chime:', e);
    }
  }
}

export const soundService = new SoundService();
