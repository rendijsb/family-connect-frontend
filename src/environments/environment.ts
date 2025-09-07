export const environment = {
  production: true,
  apiUrl: 'https://family-connect.laravel.cloud/api',
  appName: 'Family Connect',
  version: '1.0.0',
  enableDebugMode: false,
  pusher: {
    key: '40fb26d70f1e65939629',
    cluster: 'eu',
    forceTLS: true,
    encrypted: true,
    enabledTransports: ['wss'],
    authEndpoint: 'https://family-connect.laravel.cloud/api/broadcasting/auth',
  },
  websocket: {
    enabled: true,
    retryAttempts: 5,
    retryDelay: 1000,
    maxRetryDelay: 10000,
  }
};
