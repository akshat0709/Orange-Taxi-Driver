with open('App.tsx', 'r') as f:
    content = f.read()

# Comment out registerForPushNotificationsAsync call
content = content.replace("registerForPushNotificationsAsync().then", "// registerForPushNotificationsAsync().then")

with open('App.tsx', 'w') as f:
    f.write(content)
