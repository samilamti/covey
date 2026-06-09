import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'se.covey.app',
  appName: 'Covey',
  webDir: 'dist',
  server: {
    // Uncomment for live reload during native development:
    // url: 'http://<your-local-ip>:5173',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // We hide it after App renders
      backgroundColor: '#1e293b',
      showSpinner: false,
    },
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
