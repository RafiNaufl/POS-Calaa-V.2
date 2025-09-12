import { NextRequest, NextResponse } from 'next/server';
import { checkTransactionStatus, verifySignature } from '@/lib/midtrans';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

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

      // Update product stock if payment is successful
      if (paymentStatus === 'PAID') {
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
          }
        }
      }

      console.log(`Transaction ${order_id} updated with status: ${paymentStatus}/${transactionStatus}`);
    } catch (dbError) {
      console.error('Database update error:', dbError);
      // Still return success to Midtrans to avoid retries
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Midtrans webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle GET request for webhook verification
export async function GET() {
  return NextResponse.json({ message: 'Midtrans webhook endpoint is active' });
}