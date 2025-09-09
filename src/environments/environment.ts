export const environment = {
  production: true,
  apiUrl: 'https://family-connect.laravel.cloud/api',
  appName: 'Family Connect',
  version: '1.0.0',
  enableDebugMode: false,
  ably: {
    key: 'aF6gOw.p2-Uvg:QhwqFFMLESTcYgdX0U93pG9Xt4OhN8EuFMDV2CLnfrU',
    authEndpoint: 'https://family-connect.laravel.cloud/api/broadcasting/auth',
  },
  websocket: {
    enabled: true,
    retryAttempts: 5,
    retryDelay: 1000,
    maxRetryDelay: 10000,
  }
};
