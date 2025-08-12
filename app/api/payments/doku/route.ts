import { NextRequest, NextResponse } from 'next/server'

// DOKU API credentials
const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID || 'BRN-0227-1754893463001'
// Ensure the secret key is properly formatted without any quotes or trailing characters
// IMPORTANT: The secret key must be properly formatted without quotes or trailing characters
const DOKU_SECRET_KEY = (process.env.DOKU_SECRET_KEY || 'SK-fsp7OJcKjQdN4yya4lFK').trim()
const DOKU_API_URL = process.env.DOKU_API_URL || 'https://api-sandbox.doku.com'

console.log('DOKU Credentials:', {
  clientId: DOKU_CLIENT_ID,
  secretKey: DOKU_SECRET_KEY,
  secretKeyLength: DOKU_SECRET_KEY.length,
  apiUrl: DOKU_API_URL
})

// Function to generate signature for DOKU API
function generateSignature(clientId: string, requestId: string, requestTimestamp: string, requestTarget: string, secretKey: string, body?: any) {
  const crypto = require('crypto')
  
  // Component for signature - PENTING: Gunakan LF (\n) secara eksplisit untuk konsistensi antar OS
  // Ini mengatasi masalah perbedaan line ending antara Windows (CRLF) dan Unix/Mac (LF)
  let componentSignature = `Client-Id:${clientId}`
  componentSignature += `\nRequest-Id:${requestId}`
  componentSignature += `\nRequest-Timestamp:${requestTimestamp}`
  componentSignature += `\nRequest-Target:${requestTarget}`
  
  // Add digest if body exists
  if (body) {
    // CRITICAL: Create a deep copy of the body to avoid modifying the original
    // This ensures we don't alter the body that will be sent in the actual request
    const cleanedBody = JSON.parse(JSON.stringify(body))
    
    // Clean up URLs if they exist - use a more aggressive regex to remove all possible backticks and quotes
    if (cleanedBody.order?.callback_url) {
      cleanedBody.order.callback_url = cleanedBody.order.callback_url.replace(/[`'"\s]/g, '').trim()
    }
    
    if (cleanedBody.order?.notification_url) {
      cleanedBody.order.notification_url = cleanedBody.order.notification_url.replace(/[`'"\s]/g, '').trim()
    }
    
    if (cleanedBody.urls) {
      if (cleanedBody.urls.success_redirect_url) {
        cleanedBody.urls.success_redirect_url = cleanedBody.urls.success_redirect_url.replace(/[`'"\s]/g, '').trim()
      }
      if (cleanedBody.urls.failure_redirect_url) {
        cleanedBody.urls.failure_redirect_url = cleanedBody.urls.failure_redirect_url.replace(/[`'"\s]/g, '').trim()
      }
      if (cleanedBody.urls.cancel_redirect_url) {
        cleanedBody.urls.cancel_redirect_url = cleanedBody.urls.cancel_redirect_url.replace(/[`'"\s]/g, '').trim()
      }
    }
    
    // IMPORTANT: Stringify the body without ANY whitespace for consistent output
    // This must match exactly how the body will be stringified in the actual request
    const bodyString = JSON.stringify(cleanedBody)
    // Remove ALL whitespace including newlines, tabs, and spaces for consistent hashing
    const cleanBodyString = bodyString.replace(/\s+/g, '')
    
    // Calculate the SHA-256 hash of the body
    // CRITICAL: Use the cleaned body string with no whitespace
    const hash = crypto.createHash('sha256').update(cleanBodyString).digest('base64')
    
    // Format digest exactly as per DOKU documentation
    componentSignature += `\nDigest:SHA-256=${hash}`
    
    console.log('Body String:', bodyString)
    console.log('Clean Body String:', cleanBodyString)
    console.log('Body Hash:', hash)
  }
  
  console.log('Signature Component:', componentSignature)
  console.log('Secret Key:', secretKey)
  console.log('Secret Key Length:', secretKey.length)
  
  // CRITICAL: Ensure the secret key is properly trimmed to remove any whitespace
  // This is essential for consistent signature generation
  const trimmedSecretKey = secretKey.trim()
  
  // Create HMAC signature using the trimmed secret key
  const hmac = crypto.createHmac('sha256', trimmedSecretKey)
  hmac.update(componentSignature)
  const signature = hmac.digest('base64')
  
  console.log('Generated Signature:', signature)
  
  // Return the signature without the prefix
  return signature
}

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

    // Ensure we have a valid base URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    // Create consistent return URLs for all payment methods
    const successRedirectUrl = `${baseUrl}/cashier?payment=success&transaction_id=${transactionId}`
    const failureRedirectUrl = `${baseUrl}/cashier?payment=failed&transaction_id=${transactionId}`
    const cancelRedirectUrl = `${baseUrl}/cashier?payment=cancelled&transaction_id=${transactionId}`
    
    // Generate request ID and timestamp
    const requestId = `req-${Date.now()}`
    const requestTimestamp = new Date().toISOString()
    // Ensure requestTarget is exactly as specified in DOKU documentation
    const requestTarget = '/checkout/v1/payment'
    
    // Prepare payment request data
    const paymentRequestData = {
      order: {
        amount,
        invoice_number: `INV-${transactionId}`,
        currency: 'IDR',
        callback_url: `${baseUrl}/api/payments/doku/callback`,
        notification_url: `${baseUrl}/api/payments/doku/webhook`,
        line_items: [
          {
            name: 'POS Transaction',
            price: amount,
            quantity: 1
          }
        ]
      },
      payment: {
        payment_method_types: [mapPaymentMethod(paymentMethod)]
      },
      customer: {
        name: customerName || 'Guest',
        email: customerEmail || 'guest@example.com',
        phone: customerPhone || '08123456789'
      },
      metadata: {
        transaction_id: transactionId,
        source: 'POS_APP'
      },
      expiry: {
        duration: 60,
        unit: 'MINUTES'
      },
      urls: {
        success_redirect_url: successRedirectUrl,
        failure_redirect_url: failureRedirectUrl,
        cancel_redirect_url: cancelRedirectUrl
      }
    }
    
    // Clean up URLs in payment request data before generating signature
    const cleanedPaymentRequestData = JSON.parse(JSON.stringify(paymentRequestData))
    
    // Clean up all URLs to ensure no backticks, quotes, or extra whitespace
    if (cleanedPaymentRequestData.order?.callback_url) {
      cleanedPaymentRequestData.order.callback_url = cleanedPaymentRequestData.order.callback_url.replace(/[`'"\s]/g, '').trim()
      console.log('Cleaned callback_url:', cleanedPaymentRequestData.order.callback_url)
    }
    
    if (cleanedPaymentRequestData.order?.notification_url) {
      cleanedPaymentRequestData.order.notification_url = cleanedPaymentRequestData.order.notification_url.replace(/[`'"\s]/g, '').trim()
      console.log('Cleaned notification_url:', cleanedPaymentRequestData.order.notification_url)
    }
    
    if (cleanedPaymentRequestData.urls) {
      if (cleanedPaymentRequestData.urls.success_redirect_url) {
        cleanedPaymentRequestData.urls.success_redirect_url = cleanedPaymentRequestData.urls.success_redirect_url.replace(/[`'"\s]/g, '').trim()
        console.log('Cleaned success_redirect_url:', cleanedPaymentRequestData.urls.success_redirect_url)
      }
      if (cleanedPaymentRequestData.urls.failure_redirect_url) {
        cleanedPaymentRequestData.urls.failure_redirect_url = cleanedPaymentRequestData.urls.failure_redirect_url.replace(/[`'"\s]/g, '').trim()
        console.log('Cleaned failure_redirect_url:', cleanedPaymentRequestData.urls.failure_redirect_url)
      }
      if (cleanedPaymentRequestData.urls.cancel_redirect_url) {
        cleanedPaymentRequestData.urls.cancel_redirect_url = cleanedPaymentRequestData.urls.cancel_redirect_url.replace(/[`'"\s]/g, '').trim()
        console.log('Cleaned cancel_redirect_url:', cleanedPaymentRequestData.urls.cancel_redirect_url)
      }
    }
    
    // Generate signature with the exact same data that will be sent
    // Important: We're using the same cleanedPaymentRequestData object for both signature and request
    const signature = generateSignature(
      DOKU_CLIENT_ID,
      requestId,
      requestTimestamp,
      requestTarget,
      DOKU_SECRET_KEY,
      cleanedPaymentRequestData
    )
    
    // Create the signature header with the HMACSHA256= prefix
    const signatureHeader = `HMACSHA256=${signature}`
    console.log('Signature Header:', signatureHeader)
    
    // PENTING: Pastikan body yang dikirim ke DOKU adalah data asli, bukan data yang sudah dibersihkan
    // Data yang dibersihkan hanya untuk kalkulasi signature
    const requestBody = JSON.stringify(paymentRequestData)
    console.log('Request Body:', requestBody)
    
    // Clean the API URL - remove all backticks, quotes, and whitespace for consistency
    // This ensures the URL used in the request matches the one used in signature generation
    const cleanApiUrl = DOKU_API_URL.replace(/[`'"\s]/g, '').trim()
    console.log('Cleaned API URL:', cleanApiUrl)
    
    // Add retry logic for 503 errors
    let response = null;
    let retryCount = 0;
    const maxRetries = 2; // Maximum number of retries
    
    while (retryCount <= maxRetries) {
      try {
        // Ensure we're using the exact same values in the request as we used for signature generation
        response = await fetch(`${cleanApiUrl}${requestTarget}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Id': DOKU_CLIENT_ID,
            'Request-Id': requestId,
            'Request-Timestamp': requestTimestamp,
            'Signature': signatureHeader
          },
          body: requestBody // This is the exact same requestBody used for signature generation
        });
        
        // If not a 503 error, break out of the retry loop
        if (response.status !== 503) {
          break;
        }
        
        // If we've reached max retries, break out of the loop
        if (retryCount === maxRetries) {
          console.log(`Maximum retries (${maxRetries}) reached for DOKU API call`);
          break;
        }
        
        // Increment retry count and wait before retrying
        retryCount++;
        const waitTime = 1000 * retryCount; // Exponential backoff: 1s, 2s
        console.log(`DOKU API returned 503, retrying in ${waitTime}ms (attempt ${retryCount} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } catch (error) {
        console.error('Error making request to DOKU API:', error);
        break;
      }
    }
    
    // If we couldn't get a response after all retries, return an error
    if (!response) {
      return NextResponse.json(
        {
          error: 'Failed to create payment',
          message: 'Could not connect to payment gateway. Please try again later.'
        },
        { status: 500 }
      );
    }
    
    console.log('DOKU Request:', {
      url: `${cleanApiUrl}${requestTarget}`,
      headers: {
        'Client-Id': DOKU_CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        'Signature': signatureHeader
      },
      body: requestBody // Log the exact same body string sent to the API
    })
    
    // Check if response is OK before trying to parse JSON
    if (!response.ok) {
      // Try to get response text first to handle non-JSON responses
      const responseText = await response.text()
      let responseData
      
      try {
        // Try to parse as JSON if possible
        responseData = JSON.parse(responseText)
      } catch (e) {
        // If not JSON, use the text as is
        console.error('DOKU returned non-JSON response:', responseText)
        
        // Check if it's a 503 Service Temporarily Unavailable error
        if (response.status === 503 || responseText.includes('503 Service Temporarily Unavailable')) {
          return NextResponse.json(
            {
              error: 'Failed to create payment',
              message: 'Payment gateway service is temporarily unavailable. Please try again later.',
              details: { responseText: responseText.substring(0, 500) + '...' } // Limit text length
            },
            { status: 503 }
          )
        }
        
        return NextResponse.json(
          {
            error: 'Failed to create payment',
            message: 'Invalid response from payment gateway',
            details: { responseText: responseText.substring(0, 500) + '...' } // Limit text length
          },
          { status: response.status }
        )
      }
      
      console.error('DOKU payment creation error:', responseData)
      return NextResponse.json(
        {
          error: 'Failed to create payment',
          message: responseData.message || 'Unknown error occurred',
          details: responseData
        },
        { status: response.status }
      )
    }
    
    // If response is OK, parse the JSON
    const responseData = await response.json()
    
    // Format response
    return NextResponse.json({
      success: true,
      charge_id: responseData.payment.id,
      reference_id: responseData.order.invoice_number,
      status: responseData.payment.status,
      payment_method: paymentMethod,
      amount: amount,
      currency: 'IDR',
      created: new Date().toISOString(),
      checkout_url: responseData.payment.checkout_url,
      qr_code: responseData.payment.qr_code_url,
      deep_link: responseData.payment.mobile_app_url
    })

  } catch (error: any) {
    console.error('DOKU payment creation error:', error)
    
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

    // Generate request ID and timestamp
    const requestId = `req-${Date.now()}`
    const requestTimestamp = new Date().toISOString()
    // Ensure requestTarget is exactly as specified in DOKU documentation
    const requestTarget = `/checkout/v1/payment/${chargeId}`
    
    console.log('GET Request Details:', {
      requestId,
      requestTimestamp,
      requestTarget
    })
    
    // Clean the API URL - remove all backticks, quotes, and whitespace
    const cleanApiUrl = DOKU_API_URL.replace(/[`'"\s]/g, '').trim()
    console.log('Cleaned API URL:', cleanApiUrl)
    
    // Generate signature for status check - no body parameter for GET requests
    // For GET requests, we only need the headers in the signature component
    const statusSignature = generateSignature(
      DOKU_CLIENT_ID,
      requestId,
      requestTimestamp,
      requestTarget,
      DOKU_SECRET_KEY.trim() // Ensure secret key is trimmed for consistency
    )
    
    // Create the signature header with the HMACSHA256= prefix
    const signatureHeader = `HMACSHA256=${statusSignature}`
    console.log('Status Check Signature Header:', signatureHeader)
    
    console.log('DOKU Status Check Request:', {
      url: `${cleanApiUrl}${requestTarget}`,
      headers: {
        'Client-Id': DOKU_CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': requestTimestamp,
        'Signature': signatureHeader
      }
    })
    
    // Add retry logic for 503 errors
    let response = null;
    let retryCount = 0;
    const maxRetries = 2; // Maximum number of retries
    
    while (retryCount <= maxRetries) {
      try {
        response = await fetch(`${cleanApiUrl}${requestTarget}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Client-Id': DOKU_CLIENT_ID,
            'Request-Id': requestId,
            'Request-Timestamp': requestTimestamp,
            'Signature': signatureHeader
          }
        });
        
        // If not a 503 error, break out of the retry loop
        if (response.status !== 503) {
          break;
        }
        
        // If we've reached max retries, break out of the loop
        if (retryCount === maxRetries) {
          console.log(`Maximum retries (${maxRetries}) reached for DOKU API call`);
          break;
        }
        
        // Increment retry count and wait before retrying
        retryCount++;
        const waitTime = 1000 * retryCount; // Exponential backoff: 1s, 2s
        console.log(`DOKU API returned 503, retrying in ${waitTime}ms (attempt ${retryCount} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } catch (error) {
        console.error('Error making request to DOKU API:', error);
        break;
      }
    }
    
    // If we couldn't get a response after all retries, return an error
    if (!response) {
      return NextResponse.json(
        {
          error: 'Failed to check payment status',
          message: 'Could not connect to payment gateway. Please try again later.'
        },
        { status: 500 }
      );
    }
    
    // Check if response is OK before trying to parse JSON
    if (!response.ok) {
      // Try to get response text first to handle non-JSON responses
      const responseText = await response.text()
      let responseData
      
      try {
        // Try to parse as JSON if possible
        responseData = JSON.parse(responseText)
      } catch (e) {
        // If not JSON, use the text as is
        console.error('DOKU returned non-JSON response:', responseText)
        
        // Check if it's a 503 Service Temporarily Unavailable error
        if (response.status === 503 || responseText.includes('503 Service Temporarily Unavailable')) {
          return NextResponse.json(
            {
              error: 'Failed to check payment status',
              message: 'Payment gateway service is temporarily unavailable. Please try again later.',
              details: { responseText: responseText.substring(0, 500) + '...' } // Limit text length
            },
            { status: 503 }
          )
        }
        
        return NextResponse.json(
          {
            error: 'Failed to check payment status',
            message: 'Invalid response from payment gateway',
            details: { responseText: responseText.substring(0, 500) + '...' } // Limit text length
          },
          { status: response.status }
        )
      }
      
      console.error('DOKU payment status check error:', responseData)
      return NextResponse.json(
        {
          error: 'Failed to check payment status',
          message: responseData.message || 'Unknown error occurred',
          details: responseData
        },
        { status: response.status }
      )
    }
    
    // If response is OK, parse the JSON
    const responseData = await response.json()

    return NextResponse.json({
      success: true,
      charge_id: responseData.payment.id,
      reference_id: responseData.order.invoice_number,
      status: responseData.payment.status,
      amount: responseData.order.amount,
      currency: responseData.order.currency,
      created: responseData.payment.created_date,
      updated: responseData.payment.updated_date,
      failure_code: responseData.payment.failure_code,
      metadata: responseData.metadata
    })

  } catch (error: any) {
    console.error('DOKU payment status check error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to check payment status',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

// Fungsi untuk memetakan payment method ke format DOKU
function mapPaymentMethod(method: string): string {
  switch (method.toLowerCase()) {
    case 'va':
      return 'VIRTUAL_ACCOUNT'
    case 'cc':
      return 'CREDIT_CARD'
    case 'ovo':
      return 'OVO'
    case 'dana':
      return 'DANA'
    case 'linkaja':
      return 'LINKAJA'
    case 'shopeepay':
      return 'SHOPEEPAY'
    case 'gopay':
      return 'GOPAY'
    default:
      return 'VIRTUAL_ACCOUNT'
  }
}