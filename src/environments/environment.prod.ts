export const environment = {
  production: true,
  apiUrl: 'https://family-connect.laravel.cloud/api',
  appName: 'Family Connect',
  version: '1.0.0',
  enableDebugMode: false,
  reverb: {
    host: 'family-connect.laravel.cloud',
    port: 8080, // Use internal port for WebSocket
    scheme: 'https',
    key: 'family-connect-key',
    cluster: undefined,
    encrypted: true,
    forceTLS: true,
    enabledTransports: ['wss'],
    authEndpoint: 'https://family-connect.laravel.cloud/api/broadcasting/auth',
    wsHost: 'family-connect.laravel.cloud',
    wsPort: 8080,
    wssPort: 8080,
  },
  websocket: {
    enabled: true,
    retryAttempts: 5,
    retryDelay: 1000,
    maxRetryDelay: 10000,
  }
};
