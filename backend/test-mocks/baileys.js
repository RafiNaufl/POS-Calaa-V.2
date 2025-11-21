// Minimal CommonJS stub for @whiskeysockets/baileys in Jest

function makeWASocket() {
  return {
    ev: {
      on: () => {},
      off: () => {},
    },
    sendMessage: async () => ({ success: true, messageId: 'mock-msg' }),
    logout: async () => ({ success: true }),
    ws: {},
  }
}

async function useMultiFileAuthState() {
  return {
    state: {},
    saveCreds: async () => {},
  }
}

const DisconnectReason = {
  connectionLost: 'connectionLost',
}

async function fetchLatestBaileysVersion() {
  return { version: '0.0.0' }
}

function isJidBroadcast() { return false }

module.exports = {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
}