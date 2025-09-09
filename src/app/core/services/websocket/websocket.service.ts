import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../../environments/environment';

declare global {
  interface Window {
    Ably: any;
    Echo: any;
  }
}

let Echo: any = null;
let Ably: any = null;

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
    if (Echo && Ably) return;

    try {
      // Load Ably first
      const ablyModule = await import('ably');
      Ably = ablyModule.default || ablyModule;

      // Set Ably on window for Echo to use
      window.Ably = Ably;

      // Now load Laravel Echo
      const echoModule = await import('@ably/laravel-echo');
      Echo = echoModule.default || echoModule;
    } catch (error) {
      this.connectionStateSubject.next(ConnectionState.FAILED);
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTING ||
      this.connectionState === ConnectionState.CONNECTED) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No auth token available');
    }

    this.connectionStateSubject.next(ConnectionState.CONNECTING);
    this.connectionStartTime = Date.now();

    try {
      await this.initializeLibraries();

      if (!Echo || !Ably) {
        throw new Error('WebSocket libraries not available');
      }

      // Set Ably globally for @ably/laravel-echo (required)
      window.Ably = Ably;


      const ablyClient = new Ably.Realtime({
        key: environment.ably.key,
        authUrl: environment.ably.authEndpoint,
        authHeaders: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        }
      });

      this.echo = new Echo({
        broadcaster: 'ably',
        client: ablyClient, // from earlier fix
        authEndpoint: environment.ably.authEndpoint,
        auth: {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          method: 'POST', // 👈 force POST instead of GET
        },
        echoMessages: false,
        queueMessages: true,
      });


      this.setupConnectionHandlers();
      this.startConnectionTimeout();

    } catch (error) {
      this.handleConnectionFailure();
      throw error;
    }
  }

  private setupConnectionHandlers(): void {

    // For @ably/laravel-echo with Realtime client, access it from connector
    let ably = this.echo?.connector?.ably;

    // If that doesn't exist, try to get it from the options or directly from Echo
    if (!ably && this.echo?.connector?.options?.client) {
      ably = this.echo.connector.options.client;
    }

    if (!ably) {
      this.handleConnectionFailure();
      return;
    }

    console.log('🔧 Found Ably client, setting up event handlers...');
    console.log('🔍 Ably client type:', ably.constructor.name);

    // Check if it's a realtime client (has connection property)
    if (ably.connection) {
      // Connection established
      ably.connection.on('connected', () => {
        const connectionTime = Date.now() - this.connectionStartTime;
        console.log(`🎉 Ably connected successfully in ${connectionTime}ms`);
        console.log('🔗 Connection ID:', ably.connection.id);

        // DEBUG: Monitor all incoming messages on the connection
        ably.connection.on('message', (message: any) => {
          console.log('🎯 DEBUG: Raw connection message:', {
            action: message.action,
            channel: message.channel,
            messages: message.messages,
            timestamp: Date.now()
          });
        });

        // DEBUG: Listen to ALL channels that get created
        const originalChannelsGet = ably.channels.get;
        ably.channels.get = function(channelName: string) {
          const channel = originalChannelsGet.call(this, channelName);
          console.log(`🔍 DEBUG: Channel created/accessed: ${channelName}`);
          
          // Add a universal listener to this channel
          channel.subscribe((message: any) => {
            console.log(`🎯 DEBUG: UNIVERSAL MESSAGE on ${channelName}:`, {
              channel: channelName,
              name: message.name,
              data: message.data,
              timestamp: message.timestamp
            });
          });
          
          return channel;
        };

        this.connectionStateSubject.next(ConnectionState.CONNECTED);
        this.lastSuccessfulConnection = new Date();
        this.reconnectAttempts = 0;
        this.clearTimeouts();
      });

      // Connection lost
      ably.connection.on('disconnected', () => {
        console.log('💔 Ably connection lost');
        this.connectionStateSubject.next(ConnectionState.DISCONNECTED);
        this.scheduleReconnect();
      });

      // Connection errors
      ably.connection.on('failed', (error: any) => {
        console.error('❌ Ably connection error:', error);

        if (this.isUnrecoverableError(error)) {
          console.error('❌ Unrecoverable error detected');
          this.connectionStateSubject.next(ConnectionState.FAILED);
          return;
        }

        this.handleConnectionFailure();
      });

      // State changes
      ably.connection.on('connection.stateChange', (stateChange: any) => {
        console.log(`🔄 Ably state: ${stateChange.previous} → ${stateChange.current}`);
      });
    } else {
      console.log('📝 Using REST client - no connection events available');
      // For REST clients, just mark as connected
      this.connectionStateSubject.next(ConnectionState.CONNECTED);
      this.lastSuccessfulConnection = new Date();
      this.reconnectAttempts = 0;
      this.clearTimeouts();
    }
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
    console.log('🔌 Disconnecting Ably');

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

  async joinPrivateChannel(channelName: string): Promise<any> {
    // Validate connection first
    if (!this.echo || !this.echo.connector || !this.echo.connector.ably) {
      console.log('⏳ Waiting for complete WebSocket setup before joining channel...');

      const maxWaitTime = 15000; // 15 seconds
      const startTime = Date.now();

      while ((Date.now() - startTime) < maxWaitTime) {
        // Wait for both connection state and actual client
        if (this.isConnected && this.echo && this.echo.connector && this.echo.connector.ably) {
          // Additional check: make sure Ably connection is actually connected
          const ably = this.echo.connector.ably;
          if (ably.connection && ably.connection.state === 'connected') {
            console.log('✅ WebSocket and Ably client fully ready');
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!this.isConnected || !this.echo || !this.echo.connector) {
        console.error('❌ Cannot join channel - WebSocket connection not ready');
        throw new Error('WebSocket connection not ready');
      }
    }

    if (this.channels.has(channelName)) {
      console.log(`📢 Returning existing channel: ${channelName}`);
      return this.channels.get(channelName);
    }

    try {
      console.log(`📢 Joining private channel: ${channelName}`);

      // Additional safety check - ensure Echo is properly initialized
      if (!this.echo.connector || !this.echo.connector.ably) {
        throw new Error('Echo connector not ready');
      }

      console.log('🔍 Echo connector state:', {
        hasConnector: !!this.echo.connector,
        hasAbly: !!this.echo.connector?.ably,
        ablyState: this.echo.connector?.ably?.connection?.state,
        connectorKeys: this.echo.connector ? Object.keys(this.echo.connector) : []
      });

      // Try to create the channel with detailed error handling
      let channel: any;
      try {
        console.log('🔧 Attempting to create private channel...');
        channel = this.echo.private(channelName);
        console.log('✅ Private channel created successfully');
      } catch (echoError) {
        console.error('❌ Echo.private() failed:', echoError);
        console.log('🔄 Falling back to direct Ably channel creation...');
        
        // Fallback: Use Ably client directly
        try {
          const ablyClient = this.echo.connector.ably;
          // FIXED: Use colon format to match backend broadcasting
          const privateChannelName = `private:${channelName}`;
          
          console.log(`🔧 Creating Ably channel directly: ${privateChannelName}`);
          console.log(`🔍 Backend broadcasting to: ${privateChannelName}`);
          const ablyChannel = ablyClient.channels.get(privateChannelName);
          
          // Create a wrapper object that mimics Echo's channel API
          channel = {
            listen: (eventName: string, callback: Function) => {
              // Handle both '.event.name' and 'event.name' formats
              const cleanEventName = eventName.startsWith('.') ? eventName.substring(1) : eventName;
              console.log(`👂 Setting up Ably listener for: ${eventName} -> ${cleanEventName}`);
              ablyChannel.subscribe(cleanEventName, (message: any) => {
                console.log(`🎯 Event matched for ${cleanEventName}:`, message);
                callback(message);
              });
            },
            subscribed: (callback: Function) => {
              ablyChannel.on('attached', callback);
            },
            error: (callback: Function) => {
              ablyChannel.on('failed', callback);
            },
            _ablyChannel: ablyChannel // Keep reference to original
          };
          
          // DEBUG: Listen to ALL events to see what the backend is actually sending
          ablyChannel.subscribe((message: any) => {
            console.log('🎯 DEBUG: Raw message received on channel:', {
              channel: ablyChannel.name,
              name: message.name,
              data: message.data,
              timestamp: message.timestamp,
              allChannels: Object.keys(ablyClient.channels.all || {}),
              connectionId: ablyClient.connection?.id
            });
          });
          
          // Also try listening on different channel name variations
          const alternativeChannels = [
            channelName, // chat-room.3
            `private-${channelName}`, // private-chat-room.3 
            channelName.replace('chat-room', 'chatroom'), // chatroom.3
            `private-${channelName.replace('chat-room', 'chatroom')}` // private-chatroom.3
          ];
          
          console.log('🔍 Setting up listeners on alternative channels:', alternativeChannels);
          alternativeChannels.forEach(altChannelName => {
            const altChannel = ablyClient.channels.get(altChannelName);
            altChannel.subscribe((message: any) => {
              console.log(`🎯 DEBUG: Message on alternative channel ${altChannelName}:`, {
                channel: altChannelName,
                name: message.name,
                data: message.data,
                timestamp: message.timestamp
              });
            });
          });
          
          console.log('✅ Direct Ably channel created successfully');
        } catch (ablyError) {
          console.error('❌ Direct Ably channel creation also failed:', ablyError);
          throw echoError; // Throw original error
        }
      }
      this.channels.set(channelName, channel);

      // Debug: listen to all events (if supported)
      if (typeof channel.listen === 'function') {
        console.log(`👂 Listening on ${channelName} for events...`);
        channel.listen('.error', (e: any) => {
          console.error(`❌ Channel-level error on ${channelName}:`, e);
          this.channels.delete(channelName);
        });
      }

      // Setup Ably-level channel monitoring
      const ably = this.echo?.connector?.ably;
      if (ably) {
        // For direct Ably channels, use the wrapped channel
        const ablyChannelName = channel._ablyChannel ? 
          (channel._ablyChannel.name || `private:${channelName}`) : 
          channelName;
          
        const ablyChannel = ably.channels.get(ablyChannelName);
        if (ablyChannel) {
          ablyChannel.on('failed', (err: any) => {
            console.error(`❌ Ably reported failed channel: ${ablyChannelName}`, err);
            this.channels.delete(channelName);
          });
          ablyChannel.on('attached', () => {
            console.log(`✅ Ably attached to channel: ${ablyChannelName}`);
          });
        }
      }

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
    return (
      this.connectionState === ConnectionState.CONNECTED &&
      this.echo !== null &&
      this.echo.connector &&
      this.echo.connector.ably
    );
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
      socketId: this.echo?.connector?.ably?.connection?.id,
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

      const response = await fetch(environment.ably.authEndpoint, {
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
