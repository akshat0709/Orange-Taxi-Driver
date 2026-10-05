import re

with open('App.tsx', 'r') as f:
    app_code = f.read()

# 1. onlinePill
app_code = app_code.replace('styles.onlinePill,', "styles.onlinePill, theme === 'light' && styles.onlinePillLight,")

# 2. earningsPill
app_code = app_code.replace('style={styles.earningsPill}', "style={[styles.earningsPill, theme === 'light' && styles.earningsPillLight]}")

# 3. earningsPillText
app_code = app_code.replace('style={styles.earningsPillText}', "style={[styles.earningsPillText, theme === 'light' && styles.textDark]}")

# 4. quickMetricsRow
app_code = app_code.replace('style={styles.quickMetricsRow}', "style={[styles.quickMetricsRow, theme === 'light' && styles.quickMetricsRowLight]}")

# 5. quickMetricVal
app_code = app_code.replace('style={styles.quickMetricVal}', "style={[styles.quickMetricVal, theme === 'light' && styles.textDark]}")

# Add the new light styles to the bottom
light_styles = r'''  textDark: { color: '#0F172A' },
  earningsPillLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
  quickMetricsRowLight: { backgroundColor: '#F1F5F9' },
});'''

# Safely replace the end
app_code = re.sub(r'\}\);\s*$', light_styles, app_code)

with open('App.tsx', 'w') as f:
    f.write(app_code)

