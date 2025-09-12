import { CoreApi, Snap } from 'midtrans-client';

if (!process.env.MIDTRANS_SERVER_KEY) {
  throw new Error('MIDTRANS_SERVER_KEY is not defined in environment variables');
}

if (!process.env.MIDTRANS_CLIENT_KEY) {
  throw new Error('MIDTRANS_CLIENT_KEY is not defined in environment variables');
}

// Initialize Midtrans Core API
export const coreApi = new CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Initialize Midtrans Snap
export const snap = new Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Midtrans configuration
export const midtransConfig = {
  merchantId: process.env.MIDTRANS_MERCHANT_ID,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
};

// Payment parameter interface
export interface MidtransPaymentParams {
  transaction_details: {
    order_id: string;
    gross_amount: number;
  };
  customer_details?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  item_details?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
  credit_card?: {
    secure?: boolean;
  };
  callbacks?: {
    finish?: string;
    error?: string;
    pending?: string;
  };
}

// Create payment token
export async function createPaymentToken(params: MidtransPaymentParams) {
  try {
    const transaction = await snap.createTransaction(params);
    return {
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    };
  } catch (error) {
    console.error('Midtrans payment token creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Check transaction status
export async function checkTransactionStatus(orderId: string) {
  try {
    // Use the correct method from Midtrans Core API
    const status = await (coreApi as any).transaction.status(orderId);
    return {
      success: true,
      data: status
    };
  } catch (error) {
    console.error('Error checking transaction status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Verify notification signature
export function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const crypto = require('crypto');
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  
  const input = orderId + statusCode + grossAmount + serverKey;
  const hash = crypto.createHash('sha512').update(input).digest('hex');
  
  return hash === signatureKey;
}