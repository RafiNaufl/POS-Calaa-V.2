import { NextRequest, NextResponse } from 'next/server';
import { checkTransactionStatus, verifySignature } from '@/lib/midtrans';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    console.log('Midtrans webhook received:', new Date().toISOString());
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    const body = await request.json();
    console.log('Webhook payload:', JSON.stringify(body, null, 2));
    
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
    } = body;

    // Verify signature for security
    const isValidSignature = verifySignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    );

    if (!isValidSignature) {
      console.error('Invalid signature for order:', order_id);
      console.error('Expected signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }
    
    console.log('Signature verified successfully for order:', order_id);

    // Get transaction status from Midtrans
    const statusResult = await checkTransactionStatus(order_id);
    
    if (!statusResult.success) {
      console.error('Failed to check transaction status:', statusResult.error);
      return NextResponse.json(
        { error: 'Failed to verify transaction' },
        { status: 500 }
      );
    }

    // Update transaction in database based on status
    let paymentStatus = 'PENDING';
    let transactionStatus = 'PENDING';
    
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      if (fraud_status === 'accept' || !fraud_status) {
        paymentStatus = 'PAID';
        transactionStatus = 'COMPLETED';
      }
    } else if (transaction_status === 'pending') {
      paymentStatus = 'PENDING';
      transactionStatus = 'PENDING';
    } else if (transaction_status === 'deny' || transaction_status === 'cancel' || transaction_status === 'expire') {
      paymentStatus = 'FAILED';
      transactionStatus = 'CANCELLED';
    }

    // Update transaction in database
    try {
      // Get current transaction status before update
      const currentTransaction = await prisma.transaction.findUnique({
        where: { id: order_id },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!currentTransaction) {
        console.error('Transaction not found:', order_id);
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: order_id },
        data: {
          paymentStatus: paymentStatus as any,
          status: transactionStatus as any,
          paymentMethod: payment_type || 'MIDTRANS',
          paidAt: paymentStatus === 'PAID' ? new Date() : null,
          updatedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Handle stock management based on payment status changes
      const previousStatus = currentTransaction.paymentStatus;
      const previousTransactionStatus = currentTransaction.status;
      const currentStatus = paymentStatus;
      
      console.log(`Status change for ${order_id}: ${previousStatus}/${previousTransactionStatus} -> ${currentStatus}/${transactionStatus}`);
      
      // For Midtrans payments, stock is not reduced during transaction creation
      // So we need to reduce stock when payment becomes successful
      if (currentStatus === 'PAID' && previousStatus !== 'PAID') {
        console.log('Payment successful, reducing stock for Midtrans transaction');
        for (const item of updatedTransaction.items) {
          if (item.product) {
            await prisma.product.update({
              where: { id: item.product.id },
              data: {
                stock: {
                  decrement: item.quantity
                }
              }
            });
            console.log(`Stock reduced for product ${item.product.name}: -${item.quantity}`);
          }
        }

        // WhatsApp receipt sending is now handled manually through the transaction history page
        // Automatic sending has been disabled to allow manual control
        console.log(`[Midtrans] Payment successful for transaction ${order_id}. WhatsApp receipt can be sent manually from transaction history.`);
      }
      
      // If payment fails, is cancelled, or expires, restore stock only if it was previously paid
      else if ((currentStatus === 'FAILED' || transactionStatus === 'CANCELLED') && previousStatus === 'PAID') {
        console.log('Payment failed/cancelled after being paid, restoring stock');
        for (const item of updatedTransaction.items) {
          if (item.product) {
            await prisma.product.update({
              where: { id: item.product.id },
              data: {
                stock: {
                  increment: item.quantity
                }
              }
            });
            console.log(`Stock restored for product ${item.product.name}: +${item.quantity}`);
          }
        }
      }
      
      // Log stock management decision
      else {
        console.log(`No stock changes needed. Previous: ${previousStatus}, Current: ${currentStatus}`);
      }

      console.log(`Transaction ${order_id} updated with status: ${paymentStatus}/${transactionStatus}`);
      console.log('Webhook processing completed successfully');
    } catch (dbError) {
      console.error('Database update error:', dbError);
      console.error('Error details:', JSON.stringify(dbError, null, 2));
      // Still return success to Midtrans to avoid retries
    }

    return NextResponse.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Midtrans webhook error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Handle GET request for webhook verification
export async function GET() {
  return NextResponse.json({ message: 'Midtrans webhook endpoint is active' });
}