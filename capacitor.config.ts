import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.familyconnect',
  appName: 'Family Connect',
  webDir: 'dist/family-connect/browser',
  server: {
    url: process.env['NODE_ENV'] === 'development' ? 'http://192.168.1.118:4200' : undefined,
    cleartext: true,
    androidScheme: 'https',
    iosScheme: 'capacitor'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 300,
      backgroundColor: "#1a1a1a",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#dc2626",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a1a',
      overlaysWebView: false
    },
    Keyboard: {
      resize: 'ionic',
      style: 'dark',
      resizeOnFullScreen: true
    },
    Preferences: {
      group: 'FamilyConnectApp'
    },
    App: {
      backButtonAutoExit: false
    },
    Device: {
      // Enable device info access
    },
    Network: {
      // Enable network status monitoring
    },
    Haptics: {
      // Enable haptic feedback
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#dc2626",
      sound: "beep.wav"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    handleApplicationNotifications: false,
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'Family Connect'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1a1a1a',
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      keystorePassword: undefined,
      releaseType: 'AAB',
      signingType: 'apksigner'
    },
    includePlugins: [
      '@capacitor/app',
      '@capacitor/haptics',
      '@capacitor/keyboard',
      '@capacitor/preferences',
      '@capacitor/splash-screen',
      '@capacitor/status-bar'
    ],
    useLegacyBridge: false,
    webContentsDebuggingEnabled: process.env['NODE_ENV'] === 'development'
  }
};

export default config;
