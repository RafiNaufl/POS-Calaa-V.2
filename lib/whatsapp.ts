import makeWASocket, { 
  ConnectionState, 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket,
  proto,
  isJidBroadcast,
  isJidGroup,
  isJidStatusBroadcast,
  isJidUser
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

// Logger configuration
const logger = P({ level: 'silent' });

interface WhatsAppService {
  socket: WASocket | null;
  isConnected: boolean;
  qrCode: string | null;
}

class WhatsAppManager {
  private static instance: WhatsAppManager;
  private service: WhatsAppService;
  private authDir: string;
  private isInitializing: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private baseReconnectDelay: number = 10000; // Start with 10 seconds

  private constructor() {
    this.service = {
      socket: null,
      isConnected: false,
      qrCode: null
    };
    this.authDir = path.join(process.cwd(), '.wwebjs_auth', 'session-pos-app-whatsapp');
    this.ensureAuthDir();
  }

  public static getInstance(): WhatsAppManager {
    if (!WhatsAppManager.instance) {
      WhatsAppManager.instance = new WhatsAppManager();
    }
    return WhatsAppManager.instance;
  }

  private ensureAuthDir(): void {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  public async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      console.log('[WhatsApp] Already initializing, skipping duplicate call');
      return;
    }

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isInitializing = true;

    try {
      console.log('[WhatsApp] Initializing WhatsApp service...');
      
      // Close existing socket if any
      if (this.service.socket) {
        try {
          console.log('[WhatsApp] Closing existing socket...');
          // Force close the socket without waiting
          this.service.socket.end(undefined);
          // Safe termination check for WebSocket - using any type to bypass TypeScript issues
          if (this.service.socket.ws && (this.service.socket.ws as any).terminate) {
            (this.service.socket.ws as any).terminate();
          }
        } catch (error) {
          console.log('[WhatsApp] Error closing existing socket:', error);
        }
        this.service.socket = null;
      }
      
      // Add a small delay to ensure socket is properly closed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      
      this.service.socket = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        connectTimeoutMs: 60000, // Increased timeout for better stability
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 60000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        // Add connection options for better stability
        retryRequestDelayMs: 1000, // Increased delay between retries
        maxMsgRetryCount: 2, // Reduced retry count to prevent loops
        // Prevent automatic reconnection by the library itself
        shouldIgnoreJid: jid => isJidBroadcast(jid),
        // Add browser info to avoid conflicts
        browser: ['POS App', 'Chrome', '10.15.7'],
        // Disable automatic reconnection to handle it manually
        options: {
          // Add options to prevent aggressive reconnections
        },
        patchMessageBeforeSending: (message) => {
          const requiresPatch = !!(
            message.buttonsMessage ||
            message.templateMessage ||
            message.listMessage
          );
          if (requiresPatch) {
            message = {
              viewOnceMessage: {
                message: {
                  messageContextInfo: {
                    deviceListMetadataVersion: 2,
                    deviceListMetadata: {},
                  },
                  ...message,
                },
              },
            };
          }
          return message;
        }
      });

      this.service.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log('[WhatsApp] Connection update:', { connection, qr: !!qr });

        if (qr) {
          console.log('[WhatsApp] QR Code received, generating...');
          try {
            this.service.qrCode = await QRCode.toDataURL(qr);
            console.log('[WhatsApp] QR Code generated successfully');
          } catch (error) {
            console.error('[WhatsApp] Error generating QR code:', error);
          }
        }

        if (connection === 'close') {
          const disconnectReason = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = disconnectReason !== DisconnectReason.loggedOut;
          
          console.log('[WhatsApp] Connection closed. Should reconnect:', shouldReconnect);
          console.log('[WhatsApp] Last disconnect reason:', lastDisconnect?.error);
          console.log('[WhatsApp] Disconnect code:', disconnectReason);
          console.log('[WhatsApp] Reconnect attempts:', this.reconnectAttempts);
          
          // Reset connection status immediately
          this.service.isConnected = false;
          this.isInitializing = false;
          
          // Handle specific disconnect reasons
          if (disconnectReason === DisconnectReason.connectionClosed) {
            console.log('[WhatsApp] Connection closed normally');
          } else if (disconnectReason === DisconnectReason.connectionLost) {
            console.log('[WhatsApp] Connection lost, will attempt to reconnect');
          } else if (disconnectReason === DisconnectReason.restartRequired) {
            console.log('[WhatsApp] Restart required');
          } else if (disconnectReason === DisconnectReason.timedOut) {
            console.log('[WhatsApp] Connection timed out');
          } else if (disconnectReason === 440) { // Stream error conflict
            console.log('[WhatsApp] Stream conflict detected, waiting longer before reconnect');
            this.reconnectAttempts++;
            
            // Use exponential backoff for stream conflicts
            const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
            
            if (shouldReconnect && !this.reconnectTimeout && this.reconnectAttempts <= this.maxReconnectAttempts) {
              console.log(`[WhatsApp] Scheduling reconnection in ${delay}ms due to stream conflict (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              this.reconnectTimeout = setTimeout(() => {
                console.log('[WhatsApp] Attempting to reconnect after stream conflict...');
                this.initialize().catch(error => {
                  console.error('[WhatsApp] Reconnection failed:', error);
                });
              }, delay);
            } else if (this.reconnectAttempts > this.maxReconnectAttempts) {
              console.log('[WhatsApp] Max reconnection attempts reached, stopping reconnection');
              this.reconnectAttempts = 0; // Reset for future attempts
            }
            return; // Exit early to avoid normal reconnection logic
          }
          
          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            // Calculate exponential backoff delay
            const delay = Math.min(this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 60000);
            
            // Only reconnect if we're not already trying to reconnect
            if (!this.reconnectTimeout) {
              console.log(`[WhatsApp] Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              this.reconnectTimeout = setTimeout(() => {
                console.log('[WhatsApp] Attempting to reconnect...');
                this.initialize().catch(error => {
                  console.error('[WhatsApp] Reconnection failed:', error);
                });
              }, delay);
            } else {
              console.log('[WhatsApp] Reconnection already scheduled, skipping...');
            }
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WhatsApp] Max reconnection attempts reached, stopping automatic reconnection');
            this.reconnectAttempts = 0; // Reset for future manual attempts
          }
        } else if (connection === 'open') {
          console.log('[WhatsApp] Connection opened successfully');
          this.service.isConnected = true;
          this.service.qrCode = null;
          this.isInitializing = false;
          
          // Reset reconnection attempts on successful connection
          this.reconnectAttempts = 0;
          
          // Clear any pending reconnection timeout since we're now connected
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
            console.log('[WhatsApp] Cleared pending reconnection timeout');
          }
          
          // Additional verification that socket is ready
          console.log('[WhatsApp] Connection fully established and ready for messaging');
        } else if (connection === 'connecting') {
          console.log('[WhatsApp] Connecting to WhatsApp...');
          // Don't change isConnected to false if we're already connected
          // This prevents unnecessary state changes during reconnection attempts
          if (this.service.isConnected) {
            console.log('[WhatsApp] Already connected, maintaining connection state during reconnect');
          } else {
            this.service.isConnected = false;
          }
        } else {
          // Handle other connection states (undefined, etc.)
          console.log('[WhatsApp] Unknown connection state:', connection);
          // Only set to false if we're not currently connected
          if (!this.service.isConnected) {
            this.service.isConnected = false;
          }
        }
      });

      this.service.socket.ev.on('creds.update', saveCreds);
      
      // Handle socket errors with better error management
      this.service.socket.ws?.on('error', (error) => {
        console.error('[WhatsApp] WebSocket error:', error);
        // Don't immediately reconnect on WebSocket errors to prevent loops
      });
      
      console.log('[WhatsApp] WhatsApp service initialized successfully');
    } catch (error) {
      console.error('[WhatsApp] Error initializing WhatsApp service:', error);
      this.service.isConnected = false;
      this.isInitializing = false;
      
      // Clear any pending reconnection timeout on error
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Increment reconnection attempts and use exponential backoff
      this.reconnectAttempts++;
      
      // Don't throw the error to prevent unhandled promise rejections
      // Instead, schedule a retry after a delay with exponential backoff
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        if ((errorMessage.includes('Timed Out') || errorMessage.includes('Stream Errored')) && 
            this.reconnectAttempts <= this.maxReconnectAttempts) {
          
          const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 60000);
          
          console.log(`[WhatsApp] Initialization failed due to timeout/stream error, will retry in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          this.reconnectTimeout = setTimeout(() => {
            console.log('[WhatsApp] Retrying initialization after error...');
            this.initialize().catch(retryError => {
              console.error('[WhatsApp] Retry initialization failed:', retryError);
            });
          }, delay);
        } else if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.log('[WhatsApp] Max initialization attempts reached, stopping automatic retry');
          this.reconnectAttempts = 0; // Reset for future manual attempts
        }
      }
    }
  }

  public async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      // Use the improved isConnected method
      if (this.isConnected()) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        console.log('[WhatsApp] Connection wait timeout reached');
        resolve(false);
      }, timeoutMs);

      const checkConnection = () => {
        // Use the improved isConnected method for consistent checking
        if (this.isConnected()) {
          console.log('[WhatsApp] Connection established during wait');
          clearTimeout(timeout);
          resolve(true);
        } else {
          setTimeout(checkConnection, 1000);
        }
      };

      checkConnection();
    });
  }

  public async sendMessage(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      console.log(`[WhatsApp] Attempting to send message to ${phoneNumber}`);
      
      // Use the improved isConnected method for better connection checking
      if (!this.isConnected()) {
        console.log('[WhatsApp] Service not connected, waiting for connection...');
        const connected = await this.waitForConnection(15000);
        
        if (!connected) {
          console.error('[WhatsApp] Failed to establish connection within timeout');
          return { success: false, error: 'WhatsApp tidak terhubung dan gagal terhubung dalam batas waktu' };
        }
      }

      if (!this.service.socket) {
        console.error('[WhatsApp] Service not connected');
        return { success: false, error: 'WhatsApp tidak terhubung' };
      }

      // Format phone number to WhatsApp JID
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      if (!formattedNumber) {
        console.error(`[WhatsApp] Invalid phone number format: ${phoneNumber}`);
        return { success: false, error: 'Nomor telepon tidak valid' };
      }

      console.log(`[WhatsApp] Formatted number: ${formattedNumber}`);

      // Check if number exists on WhatsApp
      const results = await this.service.socket.onWhatsApp(formattedNumber);
      console.log(`[WhatsApp] Number check results:`, results);
      
      if (!results || results.length === 0 || !results[0]?.exists) {
        console.error(`[WhatsApp] Number not registered on WhatsApp: ${formattedNumber}`);
        return { success: false, error: 'Nomor tidak terdaftar di WhatsApp' };
      }
      
      const result = results[0];
      console.log(`[WhatsApp] Sending message to JID: ${result.jid}`);

      // Send message
      const messageInfo = await this.service.socket.sendMessage(result.jid, { text: message });
      console.log(`[WhatsApp] Message sent successfully. Message ID: ${messageInfo?.key?.id}`);
      
      return { 
        success: true, 
        messageId: messageInfo?.key?.id || undefined
      };
    } catch (error) {
      console.error('[WhatsApp] Error sending message:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Gagal mengirim pesan' 
      };
    }
  }

  private formatPhoneNumber(phoneNumber: string): string | null {
    try {
      // Remove all non-numeric characters
      let cleaned = phoneNumber.replace(/\D/g, '');
      
      // Handle Indonesian numbers
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      } else if (cleaned.startsWith('62')) {
        // Already in correct format
      } else if (cleaned.startsWith('+62')) {
        cleaned = cleaned.substring(1);
      } else {
        // Assume it's an Indonesian number without country code
        cleaned = '62' + cleaned;
      }

      // Validate length (Indonesian mobile numbers)
      if (cleaned.length < 10 || cleaned.length > 15) {
        return null;
      }

      return cleaned + '@s.whatsapp.net';
    } catch (error) {
      console.error('Error formatting phone number:', error);
      return null;
    }
  }

  public getConnectionStatus(): { isConnected: boolean; qrCode: string | null } {
    return {
      isConnected: this.service.isConnected,
      qrCode: this.service.qrCode
    };
  }

  public isConnected(): boolean {
    // Check both the internal flag and socket state for more accurate status
    const hasSocket = this.service.socket !== null;
    // Remove socket readyState check as it's not available on WASocket
    const internalFlag = this.service.isConnected;
    
    console.log('[WhatsApp] Connection status check:', {
      hasSocket,
      internalFlag,
      isInitializing: this.isInitializing
    });
    
    // Return true only if we have a socket, our internal flag is true, and not initializing
    return hasSocket && internalFlag && !this.isInitializing;
  }

  public async disconnect(): Promise<void> {
    try {
      console.log('[WhatsApp] Disconnecting WhatsApp service...');
      
      // Clear reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Reset reconnection attempts
      this.reconnectAttempts = 0;
      
      this.service.isConnected = false;
      this.isInitializing = false;
      
      if (this.service.socket) {
         await this.service.socket.end(undefined);
         this.service.socket = null;
       }
      
      console.log('[WhatsApp] WhatsApp service disconnected successfully');
    } catch (error) {
      console.error('[WhatsApp] Error disconnecting WhatsApp service:', error);
    }
  }

  public async logout(): Promise<void> {
    try {
      console.log('[WhatsApp] Logging out WhatsApp service...');
      
      // First disconnect the current session
      await this.disconnect();
      
      // Remove session files
      if (fs.existsSync(this.authDir)) {
        console.log('[WhatsApp] Removing session files...');
        fs.rmSync(this.authDir, { recursive: true, force: true });
        console.log('[WhatsApp] Session files removed successfully');
      }
      
      // Reset QR code
      this.service.qrCode = null;
      
      // Recreate auth directory for next session
      this.ensureAuthDir();
      
      console.log('[WhatsApp] WhatsApp logout completed successfully');
    } catch (error) {
      console.error('[WhatsApp] Error during WhatsApp logout:', error);
      throw error;
    }
  }
}

export default WhatsAppManager;