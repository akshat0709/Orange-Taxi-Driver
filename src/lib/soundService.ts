import { Vibration } from 'react-native';

class SoundService {
  async configureAudioMode() { console.log('Audio mode mocked'); }
  async playDispatchAlert() { 
    // Fallback to vibration since expo-av was removed due to native crashes
    Vibration.vibrate([0, 500, 200, 500, 200, 1000], true);
  }
  async stopDispatchAlert() { 
    Vibration.cancel();
  }
  async playAcceptChime() { 
    Vibration.vibrate([0, 150, 100, 150]);
  }
}

export const soundService = new SoundService();
