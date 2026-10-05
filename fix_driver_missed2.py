import re

with open('App.tsx', 'r') as f:
    app_code = f.read()

# Replace the last `textDark: { color: '#0F172A' },\n`
app_code = app_code.replace("textDark: { color: '#0F172A' },\n  earningsPillLight", "earningsPillLight")

with open('App.tsx', 'w') as f:
    f.write(app_code)

