import re

def nuke_file(path):
    with open(path, 'r') as f:
        content = f.read()

    # Match and remove the async function registerForPushNotificationsAsync() { ... } completely
    content = re.sub(r'async function registerForPushNotificationsAsync\(\) \{[\s\S]*?return token;\n\}', '', content)

    with open(path, 'w') as f:
        f.write(content)

nuke_file('App.tsx')
