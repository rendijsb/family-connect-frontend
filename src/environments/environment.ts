export const environment = {
  production: true,
  apiUrl: 'https://localhost:8000/api',
  appName: 'Family Connect',
  version: '1.0.0',
  enableDebugMode: false,
  ably: {
    key: 'aF6gOw.p2-Uvg:QhwqFFMLESTcYgdX0U93pG9Xt4OhN8EuFMDV2CLnfrU',
    authEndpoint: 'https://localhost:8000/api/broadcasting/auth',
  },
  websocket: {
    enabled: true,
    retryAttempts: 5,
    retryDelay: 1000,
    maxRetryDelay: 10000,
  },
  photos: {
    maxUploadSize: 10 * 1024 * 1024, // 10MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    realtimeNotifications: true,
    enableToastNotifications: true,
    notificationDuration: 3000
  }
};
