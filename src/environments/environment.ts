export const environment = {
  production: true,
  apiUrl: 'https://family-connect.laravel.cloud/api',
  appName: 'Family Connect',
  version: '1.0.0',
  enableDebugMode: false,
  reverb: {
    host: 'family-connect.laravel.cloud',
    port: 443,
    scheme: 'https',
    key: 'family-connect-key',
    path: '',
    cluster: 'mt1',
    encrypted: true,
    forceTLS: true,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: 'https://family-connect.laravel.cloud/api/broadcasting/auth',
    csrfToken: undefined,
    activityTimeout: 30000,
    pongTimeout: 10000,
  },
  websocket: {
    retryAttempts: 5,
    retryDelay: 1000,
    maxRetryDelay: 10000,
  }
};
