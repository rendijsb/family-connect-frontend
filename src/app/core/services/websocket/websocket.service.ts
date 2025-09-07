import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
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

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private readonly authService = inject(AuthService);

  private echo: any = null;
  private channels = new Map<string, any>();
  private connectionTimeout: any;
  private reconnectTimeout: any;

  private connectionStateSubject = new BehaviorSubject<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  public connectionState$ = this.connectionStateSubject.asObservable();

  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;

  private connectionStartTime: number = 0;
  private lastSuccessfulConnection: Date | null = null;

  constructor() {
    this.initializeLibraries();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private async initializeLibraries(): Promise<void> {
    if (Echo && Pusher) return;

    try {
      console.log('📦 Loading WebSocket libraries...');

      const [echoModule, pusherModule] = await Promise.all([
        import('laravel-echo'),
        import('pusher-js'),
      ]);

      Echo = echoModule.default;
      Pusher = pusherModule.default;
      window.Pusher = Pusher;

      console.log('✅ WebSocket libraries loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load WebSocket libraries:', error);
      this.connectionStateSubject.next(ConnectionState.FAILED);
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTING ||
      this.connectionState === ConnectionState.CONNECTED) {
      console.log('🔌 Connection already in progress or established');
      return;
    }

    if (!this.authService.isAuthenticated()) {
      console.warn('⚠️ User not authenticated');
      throw new Error('User not authenticated');
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('❌ No auth token available');
      throw new Error('No auth token available');
    }

    console.log('🚀 Starting Pusher connection...');
    this.connectionStateSubject.next(ConnectionState.CONNECTING);
    this.connectionStartTime = Date.now();

    try {
      await this.initializeLibraries();

      if (!Echo || !Pusher) {
        throw new Error('WebSocket libraries not available');
      }

      console.log('🔧 Creating Echo instance with Pusher config:', {
        broadcaster: 'pusher',
        key: environment.pusher.key,
        cluster: environment.pusher.cluster,
        forceTLS: true,
        encrypted: true,
        authEndpoint: environment.pusher.authEndpoint,
      });

      // Clean Pusher configuration
      this.echo = new Echo({
        broadcaster: 'pusher',
        key: environment.pusher.key,
        cluster: environment.pusher.cluster,
        forceTLS: true,
        encrypted: true,
        disableStats: true,

        // Auth configuration for private channels
        authEndpoint: environment.pusher.authEndpoint,
        auth: {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        },

        // Custom authorizer for proper data format
        authorizer: (channel: any, options: any) => {
          return {
            authorize: (socketId: string, callback: any) => {
              console.log('🔐 Authorizing channel:', channel.name, 'Socket:', socketId);

              fetch(environment.pusher.authEndpoint, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                  socket_id: socketId,
                  channel_name: channel.name
                })
              })
                .then(response => {
                  console.log('🔐 Auth response status:', response.status);
                  if (!response.ok) {
                    throw new Error(`Auth failed: ${response.status}`);
                  }
                  return response.json();
                })
                .then(data => {
                  console.log('✅ Channel auth successful:', data);
                  callback(null, data);
                })
                .catch(error => {
                  console.error('❌ Channel auth failed:', error);
                  callback(error, null);
                });
            }
          };
        },
      });

      console.log('🔗 Echo instance created, setting up connection handlers...');
      this.setupConnectionHandlers();
      this.startConnectionTimeout();

    } catch (error) {
      console.error('❌ Connection initialization failed:', error);
      this.handleConnectionFailure();
      throw error;
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.echo?.connector?.pusher) {
      console.error('❌ Pusher connector not available');
      return;
    }

    const pusher = this.echo.connector.pusher;
    console.log('🔧 Setting up Pusher event handlers...');

    // Connection established
    pusher.connection.bind('connected', () => {
      const connectionTime = Date.now() - this.connectionStartTime;
      console.log(`🎉 Pusher connected successfully in ${connectionTime}ms`);
      console.log('🔗 Socket ID:', pusher.connection.socket_id);

      this.connectionStateSubject.next(ConnectionState.CONNECTED);
      this.lastSuccessfulConnection = new Date();
      this.reconnectAttempts = 0;
      this.clearTimeouts();
    });

    // Connection lost
    pusher.connection.bind('disconnected', () => {
      console.log('💔 Pusher connection lost');
      this.connectionStateSubject.next(ConnectionState.DISCONNECTED);
      this.scheduleReconnect();
    });

    // Connection errors
    pusher.connection.bind('error', (error: any) => {
      console.error('❌ Pusher connection error:', error);

      if (error?.error?.data?.code) {
        console.error('❌ Error code:', error.error.data.code);
        console.error('❌ Error message:', error.error.data.message);
      }

      if (this.isUnrecoverableError(error)) {
        console.error('❌ Unrecoverable error detected');
        this.connectionStateSubject.next(ConnectionState.FAILED);
        return;
      }

      this.handleConnectionFailure();
    });

    // State changes
    pusher.connection.bind('state_change', (states: any) => {
      console.log(`🔄 Pusher state: ${states.previous} → ${states.current}`);
    });

    // Auth success/failure for private channels
    pusher.connection.bind('pusher:signin_success', (data: any) => {
      console.log('✅ Private channel authentication successful:', data);
    });

    pusher.connection.bind('pusher:error', (error: any) => {
      console.error('❌ Pusher error:', error);
    });
  }

  private isUnrecoverableError(error: any): boolean {
    const errorCode = error?.error?.data?.code;
    const unrecoverableCodes = [4001, 4004, 4005, 4006, 4007, 4008];
    return unrecoverableCodes.includes(errorCode);
  }

  private startConnectionTimeout(): void {
    this.clearTimeouts();

    this.connectionTimeout = setTimeout(() => {
      if (this.connectionState !== ConnectionState.CONNECTED) {
        console.error('❌ Connection timeout after 15 seconds');
        this.handleConnectionFailure();
      }
    }, 15000); // Reduced timeout for Pusher
  }

  private handleConnectionFailure(): void {
    this.clearTimeouts();

    if (this.connectionState === ConnectionState.FAILED) {
      return;
    }

    this.connectionStateSubject.next(ConnectionState.DISCONNECTED);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.connectionStateSubject.next(ConnectionState.FAILED);
      return;
    }

    if (!this.authService.isAuthenticated()) {
      console.log('⚠️ Not authenticated, skipping reconnect');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
    );

    this.connectionStateSubject.next(ConnectionState.RECONNECTING);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error);
      });
    }, delay);
  }

  disconnect(): void {
    console.log('🔌 Disconnecting Pusher');

    this.clearTimeouts();
    this.clearChannels();

    if (this.echo) {
      try {
        this.echo.disconnect();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
      this.echo = null;
    }

    this.connectionStateSubject.next(ConnectionState.DISCONNECTED);
    this.reconnectAttempts = 0;
  }

  joinPrivateChannel(channelName: string): any {
    if (!this.isConnected) {
      console.error('❌ Cannot join channel - Pusher not connected');
      throw new Error('Pusher not connected');
    }

    if (this.channels.has(channelName)) {
      console.log(`📢 Returning existing channel: ${channelName}`);
      return this.channels.get(channelName);
    }

    try {
      console.log(`📢 Joining private channel: ${channelName}`);

      const channel = this.echo.private(channelName);
      this.channels.set(channelName, channel);

      // Try to add global event listener for debugging (if available)
      try {
        if (typeof channel.bind_global === 'function') {
          channel.bind_global((eventName: string, data: any) => {
            console.log('🎉 RAW EVENT RECEIVED:', eventName, data);
          });
        } else {
          console.log('📋 bind_global not available, using specific event listeners');
        }
      } catch (error) {
        console.log('📋 Could not set up global listener:', error);
      }

      // Setup channel event handlers
      channel.subscribed(() => {
        console.log(`✅ Successfully subscribed to channel: ${channelName}`);
      });

      channel.error((error: any) => {
        console.error(`❌ Channel error for ${channelName}:`, error);
        this.channels.delete(channelName);
      });

      return channel;
    } catch (error) {
      console.error(`❌ Failed to join channel ${channelName}:`, error);
      throw error;
    }
  }

  leaveChannel(channelName: string): void {
    if (!this.echo || !this.channels.has(channelName)) {
      return;
    }

    try {
      console.log(`📢 Leaving channel: ${channelName}`);
      this.echo.leave(channelName);
      this.channels.delete(channelName);
    } catch (error) {
      console.error(`❌ Error leaving channel ${channelName}:`, error);
    }
  }

  private clearTimeouts(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private clearChannels(): void {
    console.log(`🧹 Clearing ${this.channels.size} channels...`);
    this.channels.forEach((_, channelName) => {
      this.leaveChannel(channelName);
    });
    this.channels.clear();
  }

  private cleanup(): void {
    this.disconnect();
    this.connectionStateSubject.complete();
  }

  // Public getters
  get connectionState(): ConnectionState {
    return this.connectionStateSubject.value;
  }

  get isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  get isConnecting(): boolean {
    return this.connectionState === ConnectionState.CONNECTING ||
      this.connectionState === ConnectionState.RECONNECTING;
  }

  get activeChannelCount(): number {
    return this.channels.size;
  }

  getConnectionInfo(): {
    state: ConnectionState;
    isConnected: boolean;
    reconnectAttempts: number;
    lastConnection: Date | null;
    activeChannels: number;
    socketId?: string;
  } {
    return {
      state: this.connectionState,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastConnection: this.lastSuccessfulConnection,
      activeChannels: this.activeChannelCount,
      socketId: this.echo?.connector?.pusher?.connection?.socket_id,
    };
  }

  forceReconnect(): void {
    console.log('🔄 Force reconnecting...');
    this.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => this.connect(), 500);
  }

  // Debug method to test authentication manually
  async testAuthentication(): Promise<boolean> {
    const token = this.authService.getToken();
    if (!token) return false;

    try {
      console.log('🔐 Testing authentication manually...');

      const response = await fetch(environment.pusher.authEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          socket_id: 'test-socket-id',
          channel_name: 'private-test-channel'
        })
      });

      console.log('🔐 Manual auth test response:', {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔐 Auth response data:', data);
        return true;
      } else {
        const errorText = await response.text();
        console.error('🔐 Auth failed:', errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Auth test error:', error);
      return false;
    }
  }
}
