// Minimal JS adapter for WhatsApp using Baileys, mirroring lib/whatsapp.ts API
const makeWASocket = require('@whiskeysockets/baileys').default
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, isJidBroadcast } = require('@whiskeysockets/baileys')
const P = require('pino')
const path = require('path')
const fs = require('fs')
const QRCode = require('qrcode')

const logger = P({ level: 'silent' })

class WhatsAppManager {
  static instance = null
  service = { socket: null, isConnected: false, qrCode: null }
  authDir = path.join(process.cwd(), '.wwebjs_auth', 'session-pos-app-whatsapp')
  isInitializing = false
  reconnectTimeout = null

  static getInstance() {
    if (!WhatsAppManager.instance) {
      WhatsAppManager.instance = new WhatsAppManager()
    }
    return WhatsAppManager.instance
  }

  constructor() {
    this.ensureAuthDir()
  }

  ensureAuthDir() {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true })
    }
  }

  async initialize() {
    if (this.isInitializing) return
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.isInitializing = true
    try {
      if (this.service.socket) {
        try {
          this.service.socket.end(undefined)
          if (this.service.socket.ws && this.service.socket.ws.terminate) {
            this.service.socket.ws.terminate()
          }
        } catch {}
        this.service.socket = null
      }
      await new Promise((r) => setTimeout(r, 500))
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir)
      const { version } = await fetchLatestBaileysVersion()
      this.service.socket = makeWASocket({
        auth: state,
        logger,
        version,
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid),
        browser: ['Wear Calaa POS', 'Chrome', '114.0.0'],
      })

      this.service.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
          try {
            this.service.qrCode = await QRCode.toDataURL(qr)
          } catch (e) {
            console.error('[WhatsApp] QR generation error:', e)
          }
        }
        if (connection === 'close') {
          const code = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode) || null
          this.service.isConnected = false
          this.isInitializing = false
          const payloadMsg = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.payload && lastDisconnect.error.output.payload.message) || ''
          const shouldWipe = code === DisconnectReason.loggedOut || code === 401 || code === 405 || String(payloadMsg).includes('Connection Failure')
          if (shouldWipe) {
            await this.resetAuthState().catch(() => {})
            if (!this.reconnectTimeout) {
              this.reconnectTimeout = setTimeout(() => this.initialize().catch(() => {}), 1000)
            }
          }
        } else if (connection === 'open') {
          this.service.isConnected = true
          this.service.qrCode = null
          this.isInitializing = false
        }
      })

      this.service.socket.ev.on('creds.update', saveCreds)
    } catch (err) {
      console.error('[WhatsApp] initialize error:', err)
    } finally {
      this.isInitializing = false
    }
  }

  async resetAuthState() {
    try {
      if (fs.existsSync(this.authDir)) {
        try { fs.rmSync(this.authDir, { recursive: true, force: true }) } catch {}
      }
      this.service.qrCode = null
      this.service.isConnected = false
      this.ensureAuthDir()
    } catch (e) {
      console.warn('[WhatsApp] resetAuthState error:', e)
    }
  }

  async sendMessage(phoneNumber, message) {
    try {
      const jid = this.formatPhoneNumber(phoneNumber)
      if (!jid) return { success: false, error: 'Invalid phone number' }
      if (!this.service.socket || !this.service.isConnected) {
        return { success: false, error: 'WhatsApp service not connected' }
      }
      const result = await this.service.socket.sendMessage(jid, { text: message })
      const messageId = result && result.key && result.key.id
      return { success: true, messageId }
    } catch (err) {
      return { success: false, error: String(err?.message || err) }
    }
  }

  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') return null
    let formatted = phoneNumber.trim()
    if (formatted.startsWith('0')) formatted = `62${formatted.slice(1)}`
    if (formatted.startsWith('+62')) formatted = formatted.replace(/^\+62/, '62')
    formatted = formatted.replace(/\D/g, '')
    if (!/^62\d{8,15}$/.test(formatted)) return null
    return `${formatted}@s.whatsapp.net`
  }

  getConnectionStatus() {
    return { isConnected: !!this.service.isConnected, qrCode: this.service.qrCode || null }
  }

  isConnected() {
    return !!this.service.isConnected
  }

  async disconnect() {
    try {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout)
        this.reconnectTimeout = null
      }
      if (this.service.socket) {
        this.service.socket.end(undefined)
        if (this.service.socket.ws && this.service.socket.ws.terminate) {
          this.service.socket.ws.terminate()
        }
        this.service.socket = null
      }
      this.service.isConnected = false
      this.service.qrCode = null
    } catch (e) {
      console.warn('[WhatsApp] disconnect error:', e)
    }
  }

  async logout() {
    await this.disconnect()
    await this.resetAuthState()
  }
}

module.exports = WhatsAppManager
