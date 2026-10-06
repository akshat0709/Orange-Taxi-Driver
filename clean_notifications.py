with open('App.tsx', 'r') as f:
    content = f.read()

import re

# Remove the try/catch require block
content = re.sub(r'let Notifications: any;\s*try\s*\{[\s\S]*?\}\s*catch\(e\)\s*\{\}', '', content)

# Remove the setNotificationHandler block
content = re.sub(r'if\s*\(Constants\.appOwnership !== \'expo\'\)\s*\{\s*Notifications\.setNotificationHandler\(\{[\s\S]*?\}\);\s*\}', '', content)

with open('App.tsx', 'w') as f:
    f.write(content)
