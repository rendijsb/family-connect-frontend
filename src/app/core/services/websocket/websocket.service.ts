import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../../environments/environment';

declare global {
  interface Window {
    Pusher: any;
    Echo: any;
  }
}

let Echo: any = null;
let Pusher: any = null;

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private readonly authService = inject(AuthService);
  private echo: any = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  private connectionTimeout: any;

  constructor() {
    this.loadLibraries();
  }

  private async loadLibraries() {
    try {
      if (!Echo) {
        const [echoModule, pusherModule] = await Promise.all([
          import('laravel-echo'),
          import('pusher-js'),
        ]);

        Echo = echoModule.default;
        Pusher = pusherModule.default;
        window.Pusher = Pusher;
      }
    } catch (error) {
      console.error('Failed to load WebSocket libraries:', error);
    }
  }

  async connect(): Promise<void> {
    console.log('🔌 WebSocket connect() called');

    if (this.isConnected && this.echo) {
      console.log('🔌 Already connected');
      return;
    }

    if (!this.authService.isAuthenticated()) {
      console.log('🔌 User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log('🔌 Loading WebSocket libraries...');
    await this.loadLibraries();

    if (!Echo || !Pusher) {
      console.error('❌ WebSocket libraries not loaded');
      throw new Error('WebSocket libraries not available');
    }

    // Get token from auth service
    const token = this.authService.getToken();
    if (!token) {
      console.error('❌ No auth token available for WebSocket connection');
      throw new Error('No authentication token');
    }

    console.log('✅ Auth token retrieved');

    try {
      // Clear any existing connection
      this.disconnect();

      // Create Echo instance with proper Reverb configuration
      const wsPath = (environment as any)?.reverb?.path ?? '';
      this.echo = new Echo({
        broadcaster: 'reverb',
        key: environment.reverb.key,
        wsHost: environment.reverb.host,
        wsPort: environment.reverb.port,
        wssPort: environment.reverb.port,
        wsPath,
        forceTLS: environment.reverb.scheme === 'https',
        enabledTransports:
          environment.reverb.scheme === 'https' ? ['wss'] : ['ws'],

        // Custom authorization
        authEndpoint: `${environment.apiUrl}/broadcasting/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },

        // Enhanced authorizer with better error handling
        authorizer: (channel: any, options: any) => {
          return {
            authorize: (socketId: string, callback: Function) => {
              console.log(
                '🔐 Authorizing channel:',
                channel.name,
                'with socket:',
                socketId
              );

              // Set a timeout for the authorization request
              const timeoutId = setTimeout(() => {
                console.error(
                  '❌ Authorization timeout for channel:',
                  channel.name
                );
                callback(new Error('Authorization timeout'), null);
              }, 10000); // 10 second timeout

              fetch(`${environment.apiUrl}/broadcasting/auth`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                },
                // Remove credentials: 'include' to fix CORS issue
                body: JSON.stringify({
                  socket_id: socketId,
                  channel_name: channel.name,
                }),
              })
                .then((response) => {
                  clearTimeout(timeoutId);

                  console.log(
                    '🔐 Authorization response status:',
                    response.status
                  );
                  console.log('🔐 Authorization response headers:', [
                    ...response.headers.entries(),
                  ]);

                  if (!response.ok) {
                    throw new Error(
                      `HTTP ${response.status}: ${response.statusText}`
                    );
                  }

                  // Check if response has content
                  const contentLength = response.headers.get('content-length');
                  if (contentLength === '0') {
                    throw new Error('Empty response body');
                  }

                  return response.text();
                })
                .then((text) => {
                  console.log('🔐 Raw authorization response:', text);

                  if (!text || text.trim().length === 0) {
                    throw new Error('Empty authorization response');
                  }

                  try {
                    const data = JSON.parse(text);
                    console.log(
                      '✅ Channel authorization successful:',
                      channel.name,
                      data
                    );
                    callback(null, data);
                  } catch (parseError: any) {
                    console.error(
                      '❌ Failed to parse authorization response:',
                      parseError
                    );
                    console.error('❌ Response text was:', text);
                    callback(
                      new Error(`Invalid JSON response: ${parseError.message}`),
                      null
                    );
                  }
                })
                .catch((error) => {
                  clearTimeout(timeoutId);
                  console.error('❌ Channel authorization failed:', error);
                  console.error('❌ Channel:', channel.name);
                  console.error('❌ Socket ID:', socketId);
                  callback(error, null);
                });
            },
          };
        },

        // Connection error handling
        cluster: environment.reverb.cluster || 'mt1',
        encrypted: environment.reverb.scheme === 'https',
      });

      // Set up connection event handlers
      this.setupConnectionHandlers();

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('❌ Connection timeout after 15 seconds');
          this.handleConnectionFailure(new Error('Connection timeout'));
        }
      }, 15000);

      // Mark as connected only after we get the 'connected' event
      this.isConnected = false;
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket connection:', error);
      this.isConnected = false;
      this.handleReconnection();
      throw error;
    }
  }

  private setupConnectionHandlers() {
    if (!this.echo) return;

    // Listen for connection events if available
    if (this.echo.connector && this.echo.connector.pusher) {
      const pusher = this.echo.connector.pusher;

      pusher.connection.bind('connected', () => {
        console.log('🎉 Pusher connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
      });

      pusher.connection.bind('disconnected', () => {
        console.log('💔 Pusher connection disconnected');
        this.isConnected = false;
        this.handleReconnection();
      });

      pusher.connection.bind('error', (error: any) => {
        console.error('❌ Pusher connection error:', error);
        this.isConnected = false;
        this.handleConnectionFailure(error);
      });

      pusher.connection.bind('failed', () => {
        console.error('❌ Pusher connection failed completely');
        this.isConnected = false;
        this.handleConnectionFailure(new Error('Connection failed'));
      });

      // Add state change listener for debugging
      pusher.connection.bind('state_change', (states: any) => {
        console.log(
          '🔄 Connection state changed:',
          states.previous,
          '->',
          states.current
        );
      });
    }
  }

  private handleConnectionFailure(error: any) {
    console.error('❌ WebSocket connection failure:', error);

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.isConnected = false;
    this.handleReconnection();
  }

  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `❌ Max reconnection attempts reached (${this.maxReconnectAttempts})`
      );
      return;
    }

    this.reconnectAttempts++;
    const backoffDelay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(
      `🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffDelay}ms`
    );

    setTimeout(() => {
      if (!this.isConnected && this.authService.isAuthenticated()) {
        this.connect().catch(console.error);
      }
    }, backoffDelay);
  }

  disconnect(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.echo) {
      try {
        this.echo.disconnect();
      } catch (error) {
        console.error('Error disconnecting Echo:', error);
      }
      this.echo = null;
      this.isConnected = false;
      console.log('🔌 WebSocket disconnected');
    }
  }

  getEcho(): any {
    return this.echo;
  }

  isWebSocketConnected(): boolean {
    return this.isConnected && this.echo !== null;
  }

  // Join a private channel (for chat rooms)
  joinPrivateChannel(channelName: string) {
    console.log('📢 Attempting to join private channel:', channelName);

    if (!this.echo || !this.isConnected) {
      console.error('❌ WebSocket not connected. Call connect() first.');
      throw new Error('WebSocket not connected');
    }

    try {
      const channel = this.echo.private(channelName);
      console.log('📢 Channel created:', channelName);

      // Add debugging event listeners
      channel.subscribed(() => {
        console.log('✅ Successfully subscribed to channel:', channelName);
      });

      channel.error((error: any) => {
        console.error(
          '❌ Channel subscription error for',
          channelName,
          ':',
          error
        );

        // Try to reconnect if channel subscription fails
        if (error.type === 'AuthError') {
          console.log('🔄 Auth error detected, will attempt to reconnect...');
          setTimeout(() => {
            this.handleReconnection();
          }, 2000);
        }
      });

      return channel;
    } catch (error) {
      console.error(`❌ Failed to join private channel ${channelName}:`, error);
      throw error;
    }
  }

  // Leave a channel
  leaveChannel(channelName: string): void {
    if (!this.echo) {
      return;
    }

    try {
      this.echo.leave(channelName);
      console.log(`📢 Left channel: ${channelName}`);
    } catch (error) {
      console.error(`❌ Failed to leave channel ${channelName}:`, error);
    }
  }

  // Join a presence channel (for typing indicators, user presence)
  joinPresenceChannel(channelName: string) {
    if (!this.echo || !this.isConnected) {
      console.error('❌ WebSocket not connected. Call connect() first.');
      throw new Error('WebSocket not connected');
    }

    try {
      const channel = this.echo.join(channelName);
      console.log(`📢 Joined presence channel: ${channelName}`);
      return channel;
    } catch (error) {
      console.error(
        `❌ Failed to join presence channel ${channelName}:`,
        error
      );
      throw error;
    }
  }

  // Get connection status information
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      hasEcho: !!this.echo,
    };
  }

  // Force reconnection
  forceReconnect(): void {
    console.log('🔄 Forcing reconnection...');
    this.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => {
      this.connect().catch(console.error);
    }, 1000);
  }
}
