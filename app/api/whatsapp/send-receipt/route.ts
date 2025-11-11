import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/models';
import WhatsAppService from '@/lib/whatsapp';
import ReceiptFormatter, { TransactionWithRelations } from '@/lib/receiptFormatter';
import WhatsAppErrorHandler from '@/lib/errorHandler';

interface SendReceiptRequest {
  transactionId: string;
  phoneNumber: string;
  receiptType?: 'simple' | 'detailed';
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: SendReceiptRequest = await request.json();
    const { transactionId, phoneNumber, receiptType = 'detailed' } = body;

    // Validate required fields
    if (!transactionId || !phoneNumber) {
      return NextResponse.json(
        { error: 'Transaction ID and phone number are required' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneValidation = ReceiptFormatter.validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Get transaction with all related data
    const transaction = await db.Transaction.findByPk(transactionId, {
      include: [
        {
          model: db.TransactionItem,
          as: 'items',
          include: [
            {
              model: db.Product,
              as: 'product'
            }
          ]
        },
        {
          model: db.Member,
          as: 'member'
        },
        {
          model: db.User,
          as: 'user'
        }
      ]
    }) as TransactionWithRelations | null;

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Transform transaction data for receipt formatting
    const receiptData = {
      id: transaction.id,
      createdAt: transaction.createdAt,
      items: transaction.items.map(item => ({
        id: item.id,
        name: item.product?.name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price,
        total: item.subtotal, // gunakan subtotal dari TransactionItem
        productCode: item.product?.code || undefined, // Use 'code' instead of 'productCode'
        size: item.product?.size || undefined,
        color: item.product?.color || undefined
      })),
      subtotal: transaction.total, // gunakan total dari Transaction sebagai subtotal transaksi
      tax: transaction.tax,
      finalTotal: transaction.finalTotal,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      cashier: undefined, // Not available in current schema
      customer: transaction.customerName || undefined,
      customerPhone: transaction.customerPhone || undefined,
      customerEmail: transaction.customerEmail || undefined,
      pointsUsed: transaction.pointsUsed,
      pointsEarned: transaction.pointsEarned,
      voucherCode: undefined, // Would need to get from voucherUsages
      voucherDiscount: transaction.voucherDiscount,
      promotionDiscount: transaction.promoDiscount,
      member: transaction.member ? {
        name: transaction.member.name,
        phone: transaction.member.phone || '',
        email: transaction.member.email || undefined
      } : undefined,
      user: transaction.user ? {
        name: transaction.user.name
      } : undefined
    };

    // Format receipt message
    const receiptMessage = receiptType === 'simple' 
      ? ReceiptFormatter.formatSimpleReceipt(receiptData)
      : ReceiptFormatter.formatReceiptForWhatsApp(receiptData);

    // Get WhatsApp service instance and ensure it's initialized
    const whatsappService = WhatsAppService.getInstance();
    
    // Initialize WhatsApp service if not already connected
    if (!whatsappService.isConnected()) {
      console.log('[API] WhatsApp service not connected, initializing...');
      try {
        await whatsappService.initialize();
        // Wait a moment for the connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('[API] Failed to initialize WhatsApp service:', error);
      }
    }
    
    console.log(`[API] Attempting to send WhatsApp receipt for transaction ${transactionId} to ${phoneNumber}`);
    
    // Implement retry mechanism for WhatsApp connection
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    let attempt = 0;
    let result: { success: boolean; error?: string; messageId?: string } | null = null;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`[API] WhatsApp send attempt ${attempt}/${maxRetries}`);
      
      // Check WhatsApp connection status
      if (!whatsappService.isConnected()) {
        console.warn(`[API] WhatsApp service is not connected on attempt ${attempt}`);
        
        if (attempt < maxRetries) {
          console.log(`[API] Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          console.error('[API] WhatsApp service is not connected after all retries');
          return NextResponse.json(
            { 
              error: 'WhatsApp service is not connected',
              details: 'Please ensure WhatsApp is properly connected before sending messages'
            },
            { status: 503 }
          );
        }
      }

      console.log(`[API] WhatsApp service is connected on attempt ${attempt}, proceeding to send message`);

      // Send WhatsApp message
      result = await whatsappService.sendMessage(
        phoneValidation.formatted || phoneNumber,
        receiptMessage
      );

      console.log(`[API] WhatsApp send result (attempt ${attempt}):`, result);

      if (result.success) {
        console.log(`[API] WhatsApp receipt sent successfully for transaction ${transactionId} on attempt ${attempt}`);
        break;
      } else {
        console.warn(`[API] Failed to send WhatsApp message on attempt ${attempt}: ${result.error}`);
        
        // If it's a connection-related error and we have retries left, continue
        if (attempt < maxRetries && (
          result.error?.includes('tidak terhubung') || 
          result.error?.includes('not connected') ||
          result.error?.includes('connection')
        )) {
          console.log(`[API] Connection error detected, waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          // For non-connection errors or last attempt, break
          break;
        }
      }
    }

    if (!result || !result.success) {
      console.error(`[API] Failed to send WhatsApp message after ${maxRetries} attempts: ${result?.error}`);
      return NextResponse.json(
        { 
          error: 'Failed to send WhatsApp message',
          details: result?.error || 'Unknown error after retries'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Receipt sent successfully via WhatsApp',
      data: {
        transactionId,
        phoneNumber: phoneValidation.formatted || phoneNumber,
        messageId: result.messageId,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error sending WhatsApp receipt:', error);
    
    // Use comprehensive error handler
    const whatsappError = WhatsAppErrorHandler.handleError(error);
    
    return NextResponse.json(
      WhatsAppErrorHandler.formatErrorForAPI(whatsappError),
      { status: whatsappError.retryable ? 503 : 400 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const whatsappService = WhatsAppService.getInstance();
    const isConnected = whatsappService.isConnected();
    
    return NextResponse.json({
      status: 'ok',
      whatsappConnected: isConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        whatsappConnected: false,
        error: 'Failed to check WhatsApp status'
      },
      { status: 500 }
    );
  }
}