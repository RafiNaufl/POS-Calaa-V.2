export enum WhatsAppErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  PHONE_NOT_REGISTERED = 'PHONE_NOT_REGISTERED',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface WhatsAppError {
  type: WhatsAppErrorType;
  message: string;
  details?: string;
  retryable: boolean;
  userFriendlyMessage: string;
}

export class WhatsAppErrorHandler {
  private static errorMessages: Record<WhatsAppErrorType, { message: string; userFriendly: string; retryable: boolean }> = {
    [WhatsAppErrorType.CONNECTION_FAILED]: {
      message: 'WhatsApp connection failed',
      userFriendly: 'Koneksi WhatsApp terputus. Silakan coba lagi dalam beberapa saat.',
      retryable: true
    },
    [WhatsAppErrorType.INVALID_PHONE_NUMBER]: {
      message: 'Invalid phone number format',
      userFriendly: 'Format nomor telepon tidak valid. Pastikan nomor dimulai dengan kode negara.',
      retryable: false
    },
    [WhatsAppErrorType.PHONE_NOT_REGISTERED]: {
      message: 'Phone number not registered on WhatsApp',
      userFriendly: 'Nomor telepon tidak terdaftar di WhatsApp.',
      retryable: false
    },
    [WhatsAppErrorType.MESSAGE_SEND_FAILED]: {
      message: 'Failed to send WhatsApp message',
      userFriendly: 'Gagal mengirim pesan WhatsApp. Silakan coba lagi.',
      retryable: true
    },
    [WhatsAppErrorType.AUTHENTICATION_FAILED]: {
      message: 'WhatsApp authentication failed',
      userFriendly: 'Autentikasi WhatsApp gagal. Silakan scan QR code ulang.',
      retryable: true
    },
    [WhatsAppErrorType.RATE_LIMITED]: {
      message: 'Rate limit exceeded',
      userFriendly: 'Terlalu banyak pesan dikirim. Silakan tunggu beberapa menit.',
      retryable: true
    },
    [WhatsAppErrorType.NETWORK_ERROR]: {
      message: 'Network connection error',
      userFriendly: 'Koneksi internet bermasalah. Periksa koneksi Anda.',
      retryable: true
    },
    [WhatsAppErrorType.UNKNOWN_ERROR]: {
      message: 'Unknown error occurred',
      userFriendly: 'Terjadi kesalahan yang tidak diketahui. Silakan coba lagi.',
      retryable: true
    }
  };

  public static handleError(error: any): WhatsAppError {
    let errorType = WhatsAppErrorType.UNKNOWN_ERROR;
    let details = '';

    if (error instanceof Error) {
      details = error.message;

      // Categorize error based on message content
      if (error.message.includes('connection') || error.message.includes('disconnect')) {
        errorType = WhatsAppErrorType.CONNECTION_FAILED;
      } else if (error.message.includes('invalid') && error.message.includes('phone')) {
        errorType = WhatsAppErrorType.INVALID_PHONE_NUMBER;
      } else if (error.message.includes('not registered') || error.message.includes('not found')) {
        errorType = WhatsAppErrorType.PHONE_NOT_REGISTERED;
      } else if (error.message.includes('auth') || error.message.includes('credential')) {
        errorType = WhatsAppErrorType.AUTHENTICATION_FAILED;
      } else if (error.message.includes('rate') || error.message.includes('limit')) {
        errorType = WhatsAppErrorType.RATE_LIMITED;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorType = WhatsAppErrorType.NETWORK_ERROR;
      } else if (error.message.includes('send') || error.message.includes('message')) {
        errorType = WhatsAppErrorType.MESSAGE_SEND_FAILED;
      }
    }

    const errorInfo = this.errorMessages[errorType];
    
    return {
      type: errorType,
      message: errorInfo.message,
      details,
      retryable: errorInfo.retryable,
      userFriendlyMessage: errorInfo.userFriendly
    };
  }

  public static isRetryableError(error: WhatsAppError): boolean {
    return error.retryable;
  }

  public static getRetryDelay(attemptNumber: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 30000);
  }

  public static formatErrorForAPI(error: WhatsAppError) {
    return {
      error: error.message,
      details: error.details,
      userMessage: error.userFriendlyMessage,
      retryable: error.retryable,
      type: error.type
    };
  }
}

export default WhatsAppErrorHandler;