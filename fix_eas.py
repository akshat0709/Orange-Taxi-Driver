import json

with open('eas.json', 'r') as f:
    data = json.load(f)

if 'build' in data and 'preview' in data['build']:
    if 'android' not in data['build']['preview']:
        data['build']['preview']['android'] = {}
    data['build']['preview']['android']['buildType'] = 'apk'

with open('eas.json', 'w') as f:
    json.dump(data, f, indent=2)
