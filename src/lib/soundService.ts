import { Vibration, Platform } from 'react-native';
import { Audio } from 'expo-av';

class SoundService {
  private dispatchSound: Audio.Sound | null = null;
  private acceptSound: Audio.Sound | null = null;
  private isPlayingDispatchAlert = false;
  private isAudioConfigured = false;

  async configureAudioMode() {
    if (this.isAudioConfigured) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.isAudioConfigured = true;
    } catch (e) {
      console.warn('[SoundService] Could not configure audio mode:', e);
    }
  }

  async playDispatchAlert() {
    // 1. Rhythmic high-urgency vibration pattern: vibrates immediately, then pulses continuously
    try {
      Vibration.vibrate([0, 600, 250, 600, 250, 1000], true);
    } catch (e) {
      console.warn('[SoundService] Vibration error:', e);
    }

    if (this.isPlayingDispatchAlert) return;
    this.isPlayingDispatchAlert = true;

    // 2. Audible loop with maximum alert volume
    try {
      await this.configureAudioMode();

      // Clean up previous sound instance if any
      if (this.dispatchSound) {
        try {
          await this.dispatchSound.stopAsync();
          await this.dispatchSound.unloadAsync();
        } catch {}
        this.dispatchSound = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/dispatch_alert.wav'),
        {
          isLooping: true,
          volume: 1.0,
          shouldPlay: true,
        }
      );

      this.dispatchSound = sound;
      await this.dispatchSound.playAsync();
      console.log('[SoundService] Dispatch alert playing with sound and vibration');
    } catch (e) {
      console.warn('[SoundService] Audio playback error:', e);
    }
  }

  async stopDispatchAlert() {
    try {
      Vibration.cancel();
    } catch (e) {
      console.warn('[SoundService] Vibration cancel error:', e);
    }

    if (!this.isPlayingDispatchAlert && !this.dispatchSound) return;

    try {
      if (this.dispatchSound) {
        await this.dispatchSound.stopAsync();
        await this.dispatchSound.unloadAsync();
        this.dispatchSound = null;
      }
    } catch (e) {
      console.warn('[SoundService] Could not stop dispatch alert audio:', e);
    } finally {
      this.isPlayingDispatchAlert = false;
      console.log('[SoundService] Dispatch alert sound and vibration stopped');
    }
  }

  async playAcceptChime() {
    await this.stopDispatchAlert();

    // Haptic feedback chime vibration
    try {
      Vibration.vibrate([0, 120, 80, 150]);
    } catch {}

    try {
      await this.configureAudioMode();

      if (this.acceptSound) {
        try {
          await this.acceptSound.stopAsync();
          await this.acceptSound.unloadAsync();
        } catch {}
        this.acceptSound = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/dispatch_alert.wav'),
        {
          isLooping: false,
          volume: 0.6,
          shouldPlay: true,
        }
      );

      this.acceptSound = sound;
      await this.acceptSound.playAsync();
    } catch (e) {
      console.warn('[SoundService] Could not play accept chime:', e);
    }
  }
}

export const soundService = new SoundService();
