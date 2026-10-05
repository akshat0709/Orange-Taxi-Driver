with open('App.tsx', 'r') as f:
    app_code = f.read()

app_code = app_code.replace('style={styles.offlineBottomCard}', "style={[styles.offlineBottomCard, theme === 'light' && styles.offlineCardLight]}")

with open('App.tsx', 'w') as f:
    f.write(app_code)
