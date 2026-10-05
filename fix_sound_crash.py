with open('src/lib/soundService.ts', 'r') as f:
    content = f.read()

# Replace static import
content = content.replace("import { Audio } from 'expo-av';", "import { Platform } from 'react-native';\n// expo-av dynamically required")
content = content.replace("import { Platform } from 'react-native';\nimport { Platform } from 'react-native';", "import { Platform } from 'react-native';")

# Dynamic require for Audio
content = content.replace("private dispatchSound: Audio.Sound | null = null;", "private dispatchSound: any = null;")
content = content.replace("private acceptSound: Audio.Sound | null = null;", "private acceptSound: any = null;")

audio_helper = """  private getAudioModule() {
    try {
      return require('expo-av').Audio;
    } catch (e) {
      return null;
    }
  }"""

content = content.replace("  async configureAudioMode() {", audio_helper + "\n\n  async configureAudioMode() {")

# Patch configureAudioMode
content = content.replace("""    try {
      await Audio.setAudioModeAsync({""", """    try {
      const Audio = this.getAudioModule();
      if (!Audio) return;
      await Audio.setAudioModeAsync({""")

# Patch playDispatchAlert
content = content.replace("""      const { sound } = await Audio.Sound.createAsync(""", """      const Audio = this.getAudioModule();
      if (!Audio) return;
      const { sound } = await Audio.Sound.createAsync(""")

# Patch playAcceptChime
content = content.replace("""      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/dispatch_alert.wav'),
        { isLooping: false, volume: 0.5 }
      );""", """      const Audio = this.getAudioModule();
      if (!Audio) return;
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/dispatch_alert.wav'),
        { isLooping: false, volume: 0.5 }
      );""")

with open('src/lib/soundService.ts', 'w') as f:
    f.write(content)

