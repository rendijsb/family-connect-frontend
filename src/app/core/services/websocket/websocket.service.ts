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

// Singleton pattern for libraries
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

  // Core properties
  private echo: any = null;
  private channels = new Map<string, any>();
  private connectionTimeout: any;
  private reconnectTimeout: any;

  // Connection state management
  private connectionStateSubject = new BehaviorSubject<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  public connectionState$ = this.connectionStateSubject.asObservable();

  // Reconnection config
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;

  // Performance tracking
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
      const [echoModule, pusherModule] = await Promise.all([
        import('laravel-echo'),
        import('pusher-js'),
      ]);

      Echo = echoModule.default;
      Pusher = pusherModule.default;
      window.Pusher = Pusher;

      console.log('✅ WebSocket libraries loaded');
    } catch (error) {
      console.error('❌ Failed to load WebSocket libraries:', error);
      this.connectionStateSubject.next(ConnectionState.FAILED);
    }
  }

  async connect(): Promise<void> {
    // Prevent multiple simultaneous connections
    if (this.connectionState === ConnectionState.CONNECTING ||
      this.connectionState === ConnectionState.CONNECTED) {
      console.log('🔌 Connection already in progress or established');
      return;
    }

    // Check authentication
    if (!this.authService.isAuthenticated()) {
      console.warn('⚠️ User not authenticated');
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('❌ No auth token available');
      return;
    }

    // Start connection process
    this.connectionStateSubject.next(ConnectionState.CONNECTING);
    this.connectionStartTime = Date.now();

    try {
      await this.initializeLibraries();

      if (!Echo || !Pusher) {
        throw new Error('WebSocket libraries not available');
      }

      // Create optimized Echo instance
      this.echo = new Echo({
        broadcaster: 'pusher',
        key: environment.reverb.key,
        cluster: environment.reverb.cluster,
        wsHost: environment.reverb.wsHost,
        wsPort: environment.reverb.wsPort,
        wssPort: environment.reverb.wssPort,
        forceTLS: true,
        encrypted: true,
        disableStats: true,
        enabledTransports: ['wss'],

        // Simplified auth config - let Laravel Echo handle the details
        authEndpoint: environment.reverb.authEndpoint,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },

        // Pusher-specific optimizations
        activityTimeout: 120000,
        pongTimeout: 30000,
        unavailableTimeout: 10000,
      });

      this.setupConnectionHandlers();
      this.startConnectionTimeout();

    } catch (error) {
      console.error('❌ Connection initialization failed:', error);
      this.handleConnectionFailure();
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.echo?.connector?.pusher) {
      console.error('❌ Pusher connector not available');
      return;
    }

    const pusher = this.echo.connector.pusher;

    // Connection established
    pusher.connection.bind('connected', () => {
      const connectionTime = Date.now() - this.connectionStartTime;
      console.log(`🎉 Connected in ${connectionTime}ms`);

      this.connectionStateSubject.next(ConnectionState.CONNECTED);
      this.lastSuccessfulConnection = new Date();
      this.reconnectAttempts = 0;
      this.clearTimeouts();
    });

    // Connection lost
    pusher.connection.bind('disconnected', () => {
      console.log('💔 Connection lost');
      this.connectionStateSubject.next(ConnectionState.DISCONNECTED);
      this.scheduleReconnect();
    });

    // Connection errors
    pusher.connection.bind('error', (error: any) => {
      console.error('❌ Connection error:', error);

      // Check for unrecoverable errors
      if (this.isUnrecoverableError(error)) {
        console.error('❌ Unrecoverable error detected');
        this.connectionStateSubject.next(ConnectionState.FAILED);
        return;
      }

      this.handleConnectionFailure();
    });

    // State changes for debugging
    pusher.connection.bind('state_change', (states: any) => {
      console.log(`🔄 ${states.previous} → ${states.current}`);
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
        console.error('❌ Connection timeout');
        this.handleConnectionFailure();
      }
    }, 15000);
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
      this.connect();
    }, delay);
  }

  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket');

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

  // Optimized channel management
  joinPrivateChannel(channelName: string): any {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Return existing channel if already joined
    if (this.channels.has(channelName)) {
      console.log(`📢 Returning existing channel: ${channelName}`);
      return this.channels.get(channelName);
    }

    try {
      const channel = this.echo.private(channelName);
      this.channels.set(channelName, channel);

      console.log(`📢 Joined private channel: ${channelName}`);

      // Auto-cleanup on errors
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
      this.echo.leave(channelName);
      this.channels.delete(channelName);
      console.log(`📢 Left channel: ${channelName}`);
    } catch (error) {
      console.error(`❌ Error leaving channel ${channelName}:`, error);
    }
  }

  joinPresenceChannel(channelName: string): any {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName);
    }

    try {
      const channel = this.echo.join(channelName);
      this.channels.set(channelName, channel);

      console.log(`📢 Joined presence channel: ${channelName}`);

      return channel;
    } catch (error) {
      console.error(`❌ Failed to join presence channel ${channelName}:`, error);
      throw error;
    }
  }

  // Utility methods
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
  } {
    return {
      state: this.connectionState,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastConnection: this.lastSuccessfulConnection,
      activeChannels: this.activeChannelCount,
    };
  }

  // Force reconnect with reset
  forceReconnect(): void {
    console.log('🔄 Force reconnecting...');
    this.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => this.connect(), 500);
  }
}
