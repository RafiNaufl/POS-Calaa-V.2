import { NextRequest, NextResponse } from 'next/server'
import { Xendit, PaymentRequest } from 'xendit-node'
import { PaymentMethodType } from 'xendit-node/payment_method/models'
import { PaymentRequestActionActionEnum, PaymentRequestActionUrlTypeEnum } from 'xendit-node/payment_request/models'
import { PaymentMethodReusability } from 'xendit-node/payment_method/models'

const xendit = new Xendit({
  secretKey: process.env.XENDIT_SECRET_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, paymentMethod, customerName, customerPhone, customerEmail, transactionId } = body

    // Validate required fields
    if (!amount || !paymentMethod || !transactionId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, paymentMethod, transactionId' },
        { status: 400 }
      )
    }

    // Create E-Wallet charge based on payment method
    let chargeData: any = {
      reference_id: `pos-${transactionId}-${Date.now()}`,
      currency: 'IDR',
      amount: amount,
      checkout_method: 'ONE_TIME_PAYMENT',
      channel_code: paymentMethod.toUpperCase(),
      channel_properties: {},
      metadata: {
        transaction_id: transactionId,
        customer_name: customerName || 'Guest',
        source: 'POS_APP'
      }
    }

    // Ensure we have a valid base URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    // Create consistent return URLs for all payment methods
    const successReturnUrl = `${baseUrl}/cashier?payment=success&transaction_id=${transactionId}`
    const failureReturnUrl = `${baseUrl}/cashier?payment=failed&transaction_id=${transactionId}`
    const cancelReturnUrl = `${baseUrl}/cashier?payment=cancelled&transaction_id=${transactionId}`
    
    console.log('Success return URL:', successReturnUrl)
    
    // Configure channel properties based on payment method
    switch (paymentMethod.toLowerCase()) {
      case 'ovo':
        chargeData.channel_properties = {
          mobile_number: customerPhone || '+6281234567890',
          success_redirect_url: successReturnUrl,
          failure_redirect_url: failureReturnUrl
        }
        break
      case 'dana':
        chargeData.channel_properties = {
          mobile_number: customerPhone || '+6281234567890',
          success_redirect_url: successReturnUrl,
          failure_redirect_url: failureReturnUrl
        }
        break
      case 'linkaja':
        chargeData.channel_properties = {
          mobile_number: customerPhone || '+6281234567890',
          success_redirect_url: successReturnUrl,
          failure_redirect_url: failureReturnUrl
        }
        break
      case 'shopeepay':
        chargeData.channel_properties = {
          success_redirect_url: successReturnUrl,
          failure_redirect_url: failureReturnUrl,
          cancel_redirect_url: cancelReturnUrl
        }
        break
      case 'gopay':
        chargeData.channel_properties = {
          success_redirect_url: successReturnUrl,
          failure_redirect_url: failureReturnUrl,
          cancel_redirect_url: cancelReturnUrl
        }
        break
      default:
        return NextResponse.json(
          { error: 'Unsupported payment method' },
          { status: 400 }
        )
    }

    // Create the payment request
    const { PaymentRequest } = xendit
    const idempotencyKey = `pos-${transactionId}-${Date.now()}`
    
    // Use the baseUrl and return URLs already defined above
    // No need to redeclare the return URL variables

    const paymentRequestData = {
      referenceId: idempotencyKey,
      amount: amount,
      currency: 'IDR' as const,
      paymentMethod: {
        type: PaymentMethodType.Ewallet,
        ewallet: {
          channelCode: paymentMethod.toUpperCase(),
          channelProperties: {
            successReturnUrl: successReturnUrl,
            failureReturnUrl: failureReturnUrl,
            cancelReturnUrl: cancelReturnUrl
          }
        },
        reusability: PaymentMethodReusability.OneTimeUse
      }
    }

    const charge = await PaymentRequest.createPaymentRequest({
      data: paymentRequestData,
      idempotencyKey
    })

    // Find the appropriate action URLs from the actions array
    const desktopAction = charge.actions?.find(action => action.urlType === PaymentRequestActionUrlTypeEnum.Web)
    const mobileAction = charge.actions?.find(action => action.urlType === PaymentRequestActionUrlTypeEnum.Mobile)
    const qrAction = charge.actions?.find(action => action.action === PaymentRequestActionActionEnum.PresentToCustomer)
    const deepLinkAction = charge.actions?.find(action => action.urlType === PaymentRequestActionUrlTypeEnum.Deeplink)

    return NextResponse.json({
      success: true,
      charge_id: charge.id,
      reference_id: charge.referenceId,
      status: charge.status,
      actions: charge.actions,
      payment_method: paymentMethod,
      amount: amount,
      currency: charge.currency,
      created: charge.created,
      checkout_url: desktopAction?.url || mobileAction?.url,
      qr_code: qrAction?.qrCode,
      deep_link: deepLinkAction?.url
    })

  } catch (error: any) {
    console.error('Xendit payment creation error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        message: error.message || 'Unknown error occurred',
        details: error.response?.data || null
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check payment status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chargeId = searchParams.get('charge_id')

    if (!chargeId) {
      return NextResponse.json(
        { error: 'Missing charge_id parameter' },
        { status: 400 }
      )
    }

    const { PaymentRequest } = xendit
    const charge = await PaymentRequest.getPaymentRequestByID({
      paymentRequestId: chargeId
    })

    return NextResponse.json({
      success: true,
      charge_id: charge.id,
      reference_id: charge.referenceId,
      status: charge.status,
      amount: charge.amount,
      currency: charge.currency,
      created: charge.created,
      updated: charge.updated,
      failure_code: charge.failureCode,
      metadata: charge.metadata
    })

  } catch (error: any) {
    console.error('Xendit payment status check error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to check payment status',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}