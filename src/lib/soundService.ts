import { Audio } from 'expo-av';
import { Platform } from 'react-native';

class SoundService {
  private dispatchSound: Audio.Sound | null = null;
  private acceptSound: Audio.Sound | null = null;
  private isPlayingDispatchAlert = false;

  async configureAudioMode() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch (e) {
      console.warn('Could not configure audio mode:', e);
    }
  }

  async playDispatchAlert() {
    if (this.isPlayingDispatchAlert) return;
    
    try {
      this.isPlayingDispatchAlert = true;
      
      // Stop any existing sound first
      if (this.dispatchSound) {
        await this.dispatchSound.unloadAsync();
        this.dispatchSound = null;
      }
      
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/dispatch_alert.wav'),
        { isLooping: true, volume: 1.0 }
      );
      this.dispatchSound = sound;
      
      await this.dispatchSound.playAsync();
      console.log('[SoundService] Dispatch alert playing');
    } catch (e) {
      console.warn('Could not play dispatch alert:', e);
      this.isPlayingDispatchAlert = false;
    }
  }

  async stopDispatchAlert() {
    if (!this.isPlayingDispatchAlert) return;
    
    try {
      if (this.dispatchSound) {
        await this.dispatchSound.stopAsync();
        await this.dispatchSound.unloadAsync();
        this.dispatchSound = null;
      }
    } catch (e) {
      console.warn('Could not stop dispatch alert:', e);
    } finally {
      this.isPlayingDispatchAlert = false;
      console.log('[SoundService] Dispatch alert stopped');
    }
  }

  async playAcceptChime() {
    await this.stopDispatchAlert();
    
    try {
      if (this.acceptSound) {
        await this.acceptSound.unloadAsync();
        this.acceptSound = null;
      }
      
      // We don't have an accept_alert.wav, so we just use the dispatch alert but without looping for a single ding,
      // or we can just skip it if it's not strictly needed. I'll play the dispatch alert once quickly.
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/dispatch_alert.wav'),
        { isLooping: false, volume: 0.5 }
      );
      this.acceptSound = sound;
      await this.acceptSound.playAsync();
      
      console.log('[SoundService] Accept chime played');
    } catch (e) {
      console.warn('Could not play accept chime:', e);
    }
  }
}

export const soundService = new SoundService();
