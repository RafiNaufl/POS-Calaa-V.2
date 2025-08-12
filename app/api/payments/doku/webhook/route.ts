import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * DOKU Payment Notification Webhook Handler
 * 
 * This endpoint receives payment notifications from DOKU when a payment status changes.
 * According to DOKU documentation (https://developers.doku.com/getting-started-with-doku-api/notification/best-practice),
 * the webhook should:
 * 
 * 1. Immediately acknowledge receipt with a 200 OK response
 * 2. Verify the signature in the request header to ensure authenticity
 * 3. Process the notification asynchronously if needed
 * 4. Handle different notification types (success, failure, etc.)
 * 
 * The notification URL must be configured in the payment request as 'notification_url'
 * and must be publicly accessible with HTTPS in production.
 */

// DOKU API credentials
const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID || 'BRN-0227-1754893463001'
// Ensure the secret key is properly formatted without any quotes or trailing characters
const DOKU_SECRET_KEY = (process.env.DOKU_SECRET_KEY || 'SK-fsp7OJcKjQdN4yya4lFK').trim()

/**
 * Verify DOKU webhook signature
 * 
 * According to DOKU documentation, the signature verification process involves:
 * 1. Extracting headers: Client-Id, Request-Id, Request-Timestamp, and Signature
 * 2. Calculating a digest of the notification body using SHA-256
 * 3. Constructing a raw signature string with the components in a specific format
 * 4. Calculating an HMAC-SHA256 signature using the merchant's secret key
 * 5. Comparing the calculated signature with the received signature
 * 
 * @param request - The incoming request from DOKU
 * @param notificationBody - The raw notification body as a string
 * @param notificationPath - The path of the notification endpoint
 * @returns boolean - True if signature is valid, false otherwise
 */
function verifySignature(request: NextRequest, notificationBody: string, notificationPath: string): boolean {
  try {
    const crypto = require('crypto')
    
    // Get headers from the request
    const clientId = request.headers.get('Client-Id') || ''
    const requestId = request.headers.get('Request-Id') || ''
    const requestTimestamp = request.headers.get('Request-Timestamp') || ''
    const signature = request.headers.get('Signature') || ''
    
    // Remove the HMACSHA256= prefix if present
    const actualSignature = signature.startsWith('HMACSHA256=') 
      ? signature.substring('HMACSHA256='.length) 
      : signature
    
    // Calculate digest from the notification body
    // PENTING: Pastikan body tidak berubah karena perbedaan line ending
    const cleanNotificationBody = notificationBody.replace(/\r\n/g, '\n')
    const digest = Buffer.from(crypto.createHash('sha256').update(cleanNotificationBody).digest()).toString('base64')
    
    // Construct the raw signature string as per DOKU documentation
    // PENTING: Gunakan LF (\n) secara eksplisit untuk konsistensi antar OS
    let rawSignature = `Client-Id:${clientId}`
    rawSignature += `\nRequest-Id:${requestId}`
    rawSignature += `\nRequest-Timestamp:${requestTimestamp}`
    rawSignature += `\nRequest-Target:${notificationPath}`
    rawSignature += `\nDigest:SHA-256=${digest}`
    
    // Calculate HMAC-SHA256 signature
    const calculatedSignature = Buffer.from(
      crypto.createHmac('sha256', DOKU_SECRET_KEY.trim()).update(rawSignature).digest()
    ).toString('base64')
    
    console.log('Verification details:', {
      clientId,
      requestId,
      requestTimestamp,
      receivedSignature: signature,
      actualSignature,
      calculatedSignature,
      digest,
      rawSignature
    })
    
    // Compare the calculated signature with the received signature
    return calculatedSignature === actualSignature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Handle successful payment notification from DOKU
 * 
 * According to DOKU documentation, the notification payload will contain:
 * - reference_id: The merchant's reference ID (our transaction ID)
 * - transaction: Object containing payment details
 *   - status: 'SUCCESS', 'FAILED', etc.
 *   - amount: The payment amount
 *   - date: The transaction date
 *   - payment_method: The payment method used
 *   - acquirer: The acquiring bank or payment provider
 *   - transaction_id: DOKU's transaction ID
 */
async function handleSuccessfulPayment(data: any) {
  try {
    // Extract relevant information from the notification
    const { reference_id, transaction } = data
    
    if (!reference_id) {
      console.error('Missing reference_id in notification data')
      return false
    }
    
    // Find the transaction in the database using the reference_id (which should be our transaction ID)
    // First try to find by dokuReferenceId, but if that fails (e.g., column doesn't exist), fall back to transactionId
    let dbTransaction;
    try {
      dbTransaction = await prisma.transaction.findFirst({
        where: {
          dokuReferenceId: reference_id
        } as any
      });
    } catch (error) {
      console.warn('Error finding transaction by dokuReferenceId, trying transactionId instead:', error);
      // Fall back to finding by id if dokuReferenceId fails
      dbTransaction = await prisma.transaction.findFirst({
        where: {
          id: reference_id
        }
      });
    }
    
    if (!dbTransaction) {
      console.error(`Transaction with DOKU reference ID ${reference_id} not found`)
      return false
    }
    
    // Update the transaction status to COMPLETED
    await prisma.transaction.update({
      where: {
        id: dbTransaction.id
      },
      data: {
        paymentStatus: 'COMPLETED',
        updatedAt: new Date()
      }
    })
    
    console.log(`Transaction ${dbTransaction.id} marked as COMPLETED`)
    return true
  } catch (error) {
    console.error('Error handling successful payment:', error)
    return false
  }
}

/**
 * Handle failed payment notification from DOKU
 * 
 * According to DOKU documentation, the notification payload will contain:
 * - reference_id: The merchant's reference ID (our transaction ID)
 * - transaction: Object containing payment details
 *   - status: 'FAILED'
 *   - error_code: The error code from DOKU
 *   - error_message: The error message describing the failure reason
 */
async function handleFailedPayment(data: any) {
  try {
    // Extract relevant information from the notification
    const { reference_id } = data
    
    if (!reference_id) {
      console.error('Missing reference_id in notification data')
      return false
    }
    
    // Find the transaction in the database using the reference_id
    const dbTransaction = await prisma.transaction.findFirst({
      where: {
        dokuReferenceId: reference_id
      } as any
    })
    
    if (!dbTransaction) {
      console.error(`Transaction with DOKU reference ID ${reference_id} not found`)
      return false
    }
    
    // Update the transaction status to FAILED
    await prisma.transaction.update({
      where: {
        id: dbTransaction.id
      },
      data: {
        paymentStatus: 'FAILED',
        updatedAt: new Date()
      }
    })
    
    console.log(`Transaction ${dbTransaction.id} marked as FAILED`)
    return true
  } catch (error) {
    console.error('Error handling failed payment:', error)
    return false
  }
}

/**
 * POST handler for DOKU webhook notifications
 * 
 * This function processes incoming notifications from DOKU about payment status changes.
 * Following DOKU's best practices:
 * 1. We immediately acknowledge receipt with a 200 OK response even if processing fails
 * 2. We verify the signature in production to ensure the notification is authentic
 * 3. We update the transaction status in our database based on the notification
 * 
 * @param request - The incoming request from DOKU
 */
export async function POST(request: NextRequest) {
  try {
    // Get the notification path from the request URL
    const url = new URL(request.url)
    const notificationPath = url.pathname
    
    // Get the raw notification body
    const notificationBody = await request.text()
    console.log('DOKU notification received:', notificationBody)
    
    // Verify the signature in production environment
    if (process.env.NODE_ENV === 'production') {
      if (!verifySignature(request, notificationBody, notificationPath)) {
        console.error('Invalid DOKU notification signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }
    
    // Parse the notification data
    const notificationData = JSON.parse(notificationBody)
    console.log('Parsed DOKU notification:', notificationData)
    
    // Handle different notification types based on transaction status
    if (notificationData.transaction?.status === 'SUCCESS') {
      await handleSuccessfulPayment(notificationData)
    } else if (notificationData.transaction?.status === 'FAILED') {
      await handleFailedPayment(notificationData)
    } else {
      console.log(`Unhandled notification status: ${notificationData.transaction?.status}`)
    }
    
    // Always return 200 OK to acknowledge receipt of the notification
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DOKU webhook processing error:', error)
    
    // Still return 200 OK to prevent DOKU from retrying
    // This follows the best practice of acknowledging receipt even if processing fails
    return NextResponse.json(
      { success: false, message: 'Notification received but processing failed' },
      { status: 200 }
    )
  }
}