export const environment = {
  production: true,
  apiUrl: 'https://family-connect.laravel.cloud/api',
  appName: 'Family Connect',
  version: '1.0.0',
  enableDebugMode: false,
  reverb: {
    host: 'api-eu.pusher.com',  // Change 'eu' to your cluster
    port: 443,
    scheme: 'https',
    key: '40fb26d70f1e65939629',  // Your actual Pusher key
    cluster: 'eu',  // Add cluster
    encrypted: true,
    forceTLS: true,
    enabledTransports: ['wss'],
    authEndpoint: 'https://family-connect.laravel.cloud/api/broadcasting/auth',
    wsHost: 'ws-eu.pusher.com',  // Change 'eu' to your cluster
    wsPort: 443,
    wssPort: 443,
    // Remove the 'path' property
  },
  websocket: {
    enabled: true,
    retryAttempts: 5,
    retryDelay: 1000,
    maxRetryDelay: 10000,
  }
};
