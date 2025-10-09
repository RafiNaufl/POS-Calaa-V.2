import { NextRequest, NextResponse } from 'next/server';
import { createPaymentToken, MidtransPaymentParams } from '@/lib/midtrans';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

    const body = await request.json();
    const { orderId, amount, customerDetails, itemDetails } = body;

    // Validate required fields
    if (!orderId || !amount) {
      return NextResponse.json(
        { error: 'Order ID and amount are required' },
        { status: 400 }
      );
    }

    // Prepare Midtrans payment parameters
    const paymentParams: MidtransPaymentParams = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: customerDetails && (customerDetails.email || customerDetails.first_name || customerDetails.phone) 
        ? customerDetails 
        : {
            first_name: session.user?.name || 'Customer',
            email: session.user?.email || undefined,
          },
      item_details: itemDetails || [],
      credit_card: {
        secure: true,
      },
      callbacks: {
        finish: `${process.env.NEXTAUTH_URL}/cashier?payment=success&transaction_id=${orderId}`,
        error: `${process.env.NEXTAUTH_URL}/cashier?payment=error&transaction_id=${orderId}`,
        pending: `${process.env.NEXTAUTH_URL}/cashier?payment=pending&transaction_id=${orderId}`
      }
    };

    // Create payment token
    const result = await createPaymentToken(paymentParams);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: result.token,
      redirect_url: result.redirect_url,
    });
  } catch (error) {
    console.error('Midtrans token creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}