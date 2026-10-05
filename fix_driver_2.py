import re

with open('App.tsx', 'r') as f:
    app_code = f.read()

app_code = app_code.replace('isLight', "theme === 'light'")

with open('App.tsx', 'w') as f:
    f.write(app_code)

