import { Platform } from 'react-native';

class SoundService {
  private isPlayingDispatchAlert = false;
  private webAudioContext: any = null;
  private webIntervalTimer: any = null;

  async configureAudioMode() {
    // Sound is temporarily bypassed for Expo Go testing
  }

  async playDispatchAlert() {
    if (this.isPlayingDispatchAlert) return;
    this.isPlayingDispatchAlert = true;
    console.log('[SoundService] Dispatch alert playing visually');
  }

  async stopDispatchAlert() {
    this.isPlayingDispatchAlert = false;
    console.log('[SoundService] Dispatch alert stopped');
  }

  async playAcceptChime() {
    await this.stopDispatchAlert();
    console.log('[SoundService] Accept chime played visually');
  }
}

export const soundService = new SoundService();
