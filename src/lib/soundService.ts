import { Audio } from 'expo-av';
import { Platform } from 'react-native';

class SoundService {
  private dispatchSound: Audio.Sound | null = null;
  private isPlayingDispatchAlert = false;
  private audioModeConfigured = false;
  private webAudioContext: any = null;
  private webIntervalTimer: any = null;

  async configureAudioMode() {
    if (this.audioModeConfigured) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.audioModeConfigured = true;
    } catch (e) {
      console.warn('Audio.setAudioModeAsync warning:', e);
    }
  }

  /**
   * Play repeating energetic alert chime when new ride request arrives
   */
  async playDispatchAlert() {
    if (this.isPlayingDispatchAlert) return;
    this.isPlayingDispatchAlert = true;

    // Web fallback using Web Audio API synthesis
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.playWebDispatchChime();
      return;
    }

    try {
      await this.configureAudioMode();

      // If sound not yet loaded, load it from assets
      if (!this.dispatchSound) {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/dispatch_alert.wav'),
          {
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
          }
        );
        this.dispatchSound = sound;
      } else {
        await this.dispatchSound.setIsLoopingAsync(true);
        await this.dispatchSound.setVolumeAsync(1.0);
        await this.dispatchSound.setPositionAsync(0);
        await this.dispatchSound.playAsync();
      }
    } catch (err) {
      console.warn('Could not play native audio with expo-av, falling back to web audio:', err);
      this.playWebDispatchChime();
    }
  }

  /**
   * Web Audio chime generator (runs seamlessly in browser without media codecs)
   */
  private playWebDispatchChime() {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.webAudioContext) {
        this.webAudioContext = new AudioCtx();
      }
      if (this.webAudioContext.state === 'suspended') {
        this.webAudioContext.resume();
      }

      const triggerArpeggio = () => {
        if (!this.isPlayingDispatchAlert || !this.webAudioContext) return;
        const now = this.webAudioContext.currentTime;
        const notes = [783.99, 987.77, 1174.66, 1567.98]; // G5, B5, D6, G6
        notes.forEach((freq, idx) => {
          const osc = this.webAudioContext.createOscillator();
          const gain = this.webAudioContext.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0.35, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

          osc.connect(gain);
          gain.connect(this.webAudioContext.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.36);
        });
      };

      triggerArpeggio();
      this.webIntervalTimer = setInterval(triggerArpeggio, 2200);
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  /**
   * Stop dispatch alert immediately (called on accept, decline, or timeout)
   */
  async stopDispatchAlert() {
    this.isPlayingDispatchAlert = false;

    if (this.webIntervalTimer) {
      clearInterval(this.webIntervalTimer);
      this.webIntervalTimer = null;
    }

    if (this.dispatchSound) {
      try {
        await this.dispatchSound.stopAsync();
        await this.dispatchSound.unloadAsync();
      } catch (e) {
        // ignore
      }
      this.dispatchSound = null;
    }
  }

  /**
   * Pleasant positive confirmation chime when ride is accepted
   */
  async playAcceptChime() {
    try {
      await this.stopDispatchAlert();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = this.webAudioContext || new AudioCtx();
        const now = ctx.currentTime;
        [1046.5, 1318.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.3, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.26);
        });
      }
    } catch {}
  }
}

export const soundService = new SoundService();
