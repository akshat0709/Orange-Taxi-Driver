// Adds Firebase (needed for push notifications on Android) once google-services.json is in
// this folder. Without the file the app still builds, but cannot receive push notifications.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebaseFile = path.join(__dirname, 'google-services.json');
  if (!fs.existsSync(firebaseFile)) return config;
  return {
    ...config,
    android: { ...config.android, googleServicesFile: './google-services.json' },
  };
};
