import re

# PATCH App.tsx
with open('App.tsx', 'r') as f:
    app_code = f.read()

app_code = app_code.replace('style={styles.headerIconBtn}', 'style={[styles.headerIconBtn, isLight && styles.headerIconBtnLight]}')
app_code = app_code.replace('Calendar size={18} color="#F8FAFC"', 'Calendar size={18} color={isLight ? "#0F172A" : "#F8FAFC"}')
app_code = app_code.replace('Wallet size={18} color="#F8FAFC"', 'Wallet size={18} color={isLight ? "#0F172A" : "#F8FAFC"}')
app_code = app_code.replace('User size={18} color="#F8FAFC"', 'User size={18} color={isLight ? "#0F172A" : "#F8FAFC"}')
app_code = app_code.replace('Power size={24} color="#94A3B8"', 'Power size={24} color={isLight ? "#64748B" : "#94A3B8"}')
app_code = app_code.replace('style={styles.idleBottomCard}', 'style={[styles.idleBottomCard, isLight && styles.idleBottomCardLight]}')
app_code = app_code.replace('style={styles.offlineCard}', 'style={[styles.offlineCard, isLight && styles.offlineCardLight]}')
app_code = app_code.replace('style={styles.onlinePill}', 'style={[styles.onlinePill, isLight && styles.onlinePillLight]}')
app_code = app_code.replace('style={styles.idleStatusTitle}', 'style={[styles.idleStatusTitle, isLight && styles.textDark]}')
app_code = app_code.replace('style={styles.offlineCardTitle}', 'style={[styles.offlineCardTitle, isLight && styles.textDark]}')

light_styles = r'''  textDark: { color: '#0F172A' },
  headerIconBtnLight: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  idleBottomCardLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
  offlineCardLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
  onlinePillLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 },
});'''
app_code = re.sub(r'\}\);\s*$', light_styles, app_code)

with open('App.tsx', 'w') as f:
    f.write(app_code)


# PATCH DriverProfileModal.tsx
with open('src/components/DriverProfileModal.tsx', 'r') as f:
    profile = f.read()

profile = profile.replace('style={styles.prefTitle}', 'style={[styles.prefTitle, isLight && styles.textDark]}')
profile = profile.replace('navBtn,', 'navBtn, isLight && styles.navBtnLight,')
profile = profile.replace('navBtnActive]', 'navBtnActive, isLight && styles.navBtnActiveLight]')
profile = profile.replace('navBtnText,', 'navBtnText, isLight && styles.navBtnTextLight,')
profile = profile.replace('navBtnTextActive]', 'navBtnTextActive, isLight && styles.navBtnTextActiveLight]')
profile = profile.replace('style={styles.supportBtn}', 'style={[styles.supportBtn, isLight && styles.supportBtnLight]}')
profile = profile.replace('style={styles.supportBtnTitle}', 'style={[styles.supportBtnTitle, isLight && styles.textDark]}')

profile_styles = r'''  navBtnLight: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' },
  navBtnActiveLight: { backgroundColor: '#F97316', borderColor: '#EA580C' },
  navBtnTextLight: { color: '#64748B' },
  navBtnTextActiveLight: { color: '#FFFFFF' },
  supportBtnLight: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
});'''
profile = re.sub(r'\}\);\s*$', profile_styles, profile)

with open('src/components/DriverProfileModal.tsx', 'w') as f:
    f.write(profile)

