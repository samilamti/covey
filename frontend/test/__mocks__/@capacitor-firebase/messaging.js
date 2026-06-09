// Test mock for @capacitor-firebase/messaging.
// Native push only runs when Capacitor.isNativePlatform() is true (always
// false under jsdom), so this mock is defensive — it keeps any test that does
// import the plugin from hitting the real native bridge.
export const FirebaseMessaging = {
  requestPermissions: async () => ({ receive: 'granted' }),
  checkPermissions: async () => ({ receive: 'granted' }),
  getToken: async () => ({ token: 'test-fcm-token' }),
  deleteToken: async () => {},
  addListener: () => ({ remove: () => {} }),
  removeAllListeners: async () => {},
}
