import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'
import WhatsAppManager from '@/lib/whatsapp'
import ReceiptFormatter, { TransactionWithRelations } from '@/lib/receiptFormatter'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Ambil semua transaksi dengan relasi yang diperlukan
    const transactions = await db.Transaction.findAll({
      include: [
        {
          model: (db as any).TransactionItem,
          as: 'items',
          include: [
            {
              model: (db as any).Product,
              as: 'product'
            }
          ]
        },
        {
          model: (db as any).User,
          as: 'user',
          attributes: ['name', 'email']
        },
        {
          model: (db as any).Member,
          as: 'member',
          attributes: ['id', 'name', 'phone', 'email', 'points']
        },
        {
          model: (db as any).VoucherUsage,
          as: 'voucherUsages',
          include: [
            {
              model: (db as any).Voucher,
              as: 'voucher',
              attributes: ['code', 'name']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    } as any)

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Initialize performance monitoring variables
  const transactionStartTime = performance.now();
  let transactionId: string = 'unknown';
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.error('No session found in POST request')
      return NextResponse.json(
        { error: 'Unauthorized: No session found', message: 'Sesi tidak ditemukan. Silakan login ulang.' },
        { status: 401 }
      )
    }
    
    if (!session.user) {
      console.error('No user in session in POST request')
      return NextResponse.json(
        { error: 'Unauthorized: No user in session', message: 'Data pengguna tidak ditemukan dalam sesi. Silakan login ulang.' },
        { status: 401 }
      )
    }
    
    if (!session.user.id) {
      console.error('No user ID in session in POST request')
      return NextResponse.json(
        { error: 'Unauthorized: Missing user ID', message: 'ID pengguna tidak ditemukan dalam sesi. Silakan login ulang.' },
        { status: 401 }
      )
    }
    
    // Verify that the user exists in the database
    try {
      const userExists = await db.User.findByPk(session.user.id)
      
      if (!userExists) {
        console.error(`User not found in database in POST request. Session user ID: ${session.user.id}`)
        return NextResponse.json(
          { error: 'Unauthorized: User not found in database', message: 'Sesi pengguna tidak valid. Silakan login ulang.' },
          { status: 401 }
        )
      }
    } catch (error) {
      console.error('Error verifying user existence in POST request:', error)
      return NextResponse.json(
        { error: 'Error verifying user', message: 'Terjadi kesalahan saat memverifikasi pengguna. Silakan login ulang.' },
        { status: 500 }
      )
    }
    
    // Parse request body to get transaction data
    const body = await request.json()
    const { 
      id,
      items, 
      subtotal, 
      total, 
      paymentMethod, 
      customerName, 
      customerPhone, 
      customerEmail, 
      pointsUsed, 
      voucherCode, 
      voucherDiscount, 
      promoDiscount, 
      promotionDiscount,
      memberId,
      requiresConfirmation
    } = body
    
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required and must be a non-empty array' },
        { status: 400 }
      )
    }
    
    if (subtotal === undefined || total === undefined) {
      return NextResponse.json(
        { error: 'Subtotal and total are required' },
        { status: 400 }
      )
    }
    
    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      )
    }
    
    // Ensure transaction ID is set (use provided id or generate one)
    transactionId = id || `TXN-${Date.now()}`
    
    // Create transaction
    console.log('[transactions:POST] create request', {
      paymentMethod,
      requiresConfirmation,
      computedStatus: (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' || paymentMethod === 'QRIS' || (paymentMethod === 'CARD' && requiresConfirmation === true)) ? 'PENDING' : 'COMPLETED',
      computedPaymentStatus: (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' || paymentMethod === 'QRIS' || (paymentMethod === 'CARD' && requiresConfirmation === true)) ? 'PENDING' : 'PAID'
    })
    const transaction = await (db as any).Transaction.create({
      id: transactionId,
      userId: session.user.id,
      memberId: memberId || null,
      total: parseFloat(subtotal.toString()), // Use subtotal as total
      tax: 0, // Set tax to 0 since we're removing tax feature
      finalTotal: parseFloat(total.toString()), // Required field in schema
      paymentMethod,
      status: (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' || paymentMethod === 'QRIS' || (paymentMethod === 'CARD' && requiresConfirmation === true)) ? 'PENDING' : 'COMPLETED',
      paymentStatus: (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' || paymentMethod === 'QRIS' || (paymentMethod === 'CARD' && requiresConfirmation === true)) ? 'PENDING' : 'PAID',
      paidAt: (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' || paymentMethod === 'QRIS' || (paymentMethod === 'CARD' && requiresConfirmation === true)) ? null : new Date(),
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      pointsUsed: pointsUsed || 0,
      voucherDiscount: voucherDiscount || 0,
      promoDiscount: promotionDiscount || promoDiscount || 0
    })

    console.log('[transactions:POST] created', { id: transaction.id, status: transaction.status, paymentStatus: transaction.paymentStatus })

    // Create transaction items separately
    for (const item of items) {
      await (db as any).TransactionItem.create({
        transactionId: transaction.id,
        productId: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        subtotal: parseFloat(item.price.toString()) * item.quantity
      })
    }

    // If there's a voucher code, record its usage
    if (voucherCode) {
      try {
        const voucher = await db.Voucher.findOne({
          where: { code: voucherCode }
        })

        if (voucher && (voucher as any).id) {
          await (db as any).VoucherUsage.create({
            voucherId: (voucher as any).id,
            transactionId: transaction.id,
            discountAmount: voucherDiscount || 0
          })
        }
      } catch (error) {
        console.error('Error recording voucher usage:', error)
        // Continue anyway since the transaction was created
      }
    }
    
    // Update member points and total spent if there's a member
    if (memberId) {
      try {
        // Calculate points earned (1 point per 1000 rupiah spent)
        const pointsEarned = Math.floor(parseFloat(total.toString()) / 1000)

        // Compute points delta including usage
        const pointsDelta = (pointsEarned || 0) - (pointsUsed || 0)

        // Increment numeric fields using proper Sequelize APIs
        await db.Member.increment(
          {
            points: pointsDelta,
            totalSpent: parseFloat(total.toString())
          },
          {
            where: { id: memberId }
          }
        )

        // Update last visit timestamp
        await db.Member.update(
          { lastVisit: new Date() },
          { where: { id: memberId } }
        )

        // Create point history record for points earned
        if (pointsEarned > 0) {
          await db.PointHistory.create({
            memberId: memberId,
            points: pointsEarned,
            type: 'EARNED',
            description: `Poin dari transaksi #${transaction.id}`,
            transactionId: transaction.id
          })
        }

        // Create point history record for points used
        if ((pointsUsed || 0) > 0) {
          await db.PointHistory.create({
            memberId: memberId,
            points: -pointsUsed!,
            type: 'USED',
            description: `Poin digunakan untuk transaksi #${transaction.id}`,
            transactionId: transaction.id
          })
        }

        // Update transaction with points earned
        await db.Transaction.update(
          { pointsEarned },
          { where: { id: transaction.id } }
        )

        console.log(`Member ${memberId} updated: +${pointsEarned} points earned, ${pointsUsed || 0} points used, +${total} total spent`)
      } catch (error) {
        console.error('Error updating member data:', error)
        // Continue anyway since the transaction was created
      }
    }
    
    // Update product stock for completed transactions
    // Don't reduce stock for Midtrans payments as they will be handled by webhook
    if (
      paymentMethod !== 'VIRTUAL_ACCOUNT' &&
      paymentMethod !== 'BANK_TRANSFER' &&
      paymentMethod !== 'MIDTRANS' &&
      paymentMethod !== 'QRIS' &&
      !(paymentMethod === 'CARD' && requiresConfirmation === true)
    ) {
      try {
        // Update stock for each product in the transaction
        for (const item of items) {
          await db.Product.update({
            stock: db.sequelize.literal(`stock - ${item.quantity}`)
          }, {
            where: { id: item.productId }
          })
        }
        console.log(`Stock updated for transaction ${transaction.id}`)
      } catch (error) {
        console.error('Error updating product stock:', error)
        // Continue anyway since the transaction was created
      }
    }
    
    // Set transaction ID for logging
    transactionId = transaction.id
    
    // Send WhatsApp receipt notification for completed transactions
    if (transaction.status === 'COMPLETED' && transaction.customerPhone) {
      try {
        // Fetch full transaction with relations for receipt formatting
        const fullTransaction = await db.Transaction.findByPk(transaction.id, {
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
            { model: db.Member, as: 'member' },
            { model: db.User, as: 'user' },
            {
              model: db.VoucherUsage,
              as: 'voucherUsages',
              include: [
                {
                  model: db.Voucher,
                  as: 'voucher',
                  attributes: ['code']
                }
              ]
            }
          ]
        }) as TransactionWithRelations | null

        if (!fullTransaction) {
          console.warn(`Transaction ${transaction.id} not found for WhatsApp receipt formatting`)
        } else {
          // Prepare receipt data
          const receiptData = {
            id: fullTransaction.id,
            createdAt: fullTransaction.createdAt,
            items: fullTransaction.items.map((item: any) => ({
              id: item.id,
              name: item.product?.name || 'Unknown Product',
              quantity: item.quantity,
              price: item.price,
              total: item.subtotal,
              productCode: item.product?.productCode || undefined,
              size: item.product?.size || undefined,
              color: item.product?.color || undefined
            })),
            subtotal: (fullTransaction as any).total,
            tax: fullTransaction.tax,
            finalTotal: fullTransaction.finalTotal,
            paymentMethod: fullTransaction.paymentMethod,
            status: fullTransaction.status,
            cashier: undefined,
            customer: fullTransaction.customerName || undefined,
            customerPhone: fullTransaction.customerPhone || undefined,
            customerEmail: fullTransaction.customerEmail || undefined,
            pointsUsed: fullTransaction.pointsUsed,
            pointsEarned: fullTransaction.pointsEarned,
            voucherCode: (fullTransaction as any).voucherUsages?.[0]?.voucher?.code || undefined,
            voucherDiscount: fullTransaction.voucherDiscount,
            promotionDiscount: fullTransaction.promoDiscount,
            member: fullTransaction.member ? {
              name: fullTransaction.member.name,
              phone: fullTransaction.member.phone || '',
              email: fullTransaction.member.email || undefined
            } : undefined,
            user: fullTransaction.user ? { name: fullTransaction.user.name } : undefined
          }

          // Format phone and message
          const phoneValidation = ReceiptFormatter.validatePhoneNumber(fullTransaction.customerPhone || '')
          const receiptMessage = ReceiptFormatter.formatReceiptForWhatsApp(receiptData)

          if (!phoneValidation.isValid) {
            console.warn(`Invalid phone number for WhatsApp receipt: ${fullTransaction.customerPhone}`)
          } else {
            const whatsappService = WhatsAppManager.getInstance()
            // Ensure service is connected
            if (!whatsappService.isConnected()) {
              await whatsappService.initialize()
              await new Promise(res => setTimeout(res, 2000))
            }

            const result = await whatsappService.sendMessage(phoneValidation.formatted || fullTransaction.customerPhone!, receiptMessage)
            if (result.success) {
              console.log(`WhatsApp receipt sent successfully for transaction ${transaction.id}`)
            } else {
              console.warn(`Failed to send WhatsApp receipt for transaction ${transaction.id}: ${result.error}`)
            }
          }
        }
      } catch (whatsappError) {
        console.warn(`WhatsApp notification failed for transaction ${transaction.id}:`, whatsappError)
        // Don't fail the transaction if WhatsApp fails
      }
    }

    
    return NextResponse.json(transaction)
  } catch (error: any) {
    console.error('Error creating transaction:', error)
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    let statusCode = 500;
    
    // Handle specific error cases
    if (errorMessage.includes('session') || errorMessage.includes('unauthorized')) {
      statusCode = 401;
    } else if (errorMessage.includes('required') || errorMessage.includes('validation')) {
      statusCode = 400;
    } else if (errorMessage.includes('Unique constraint') || errorMessage.includes('UNIQUE constraint')) {
      // Sequelize unique constraint violation
      statusCode = 409;
    } else if (errorMessage.includes('Foreign key constraint') || errorMessage.includes('FOREIGN KEY constraint')) {
      // Sequelize foreign key constraint violation
      statusCode = 400;
    }
    
    // Log performance metrics for failed transactions
    const transactionEndTime = performance.now();
    const transactionDuration = transactionEndTime - transactionStartTime;
    console.log(`Transaction creation failed in ${transactionDuration.toFixed(2)}ms. ID: ${transactionId}`);
    
    return NextResponse.json(
      { 
        error: 'Failed to create transaction', 
        message: errorMessage,
        code: errorCode,
        details: error.meta || {}
      },
      { status: statusCode }
    )
  }
}

export async function PATCH(request: NextRequest) {
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.error('No session found in PATCH request')
      return NextResponse.json(
        { error: 'Unauthorized: No session found', message: 'Sesi tidak ditemukan. Silakan login ulang.' },
        { status: 401 }
      )
    }
    
    if (!session.user) {
      console.error('No user in session in PATCH request')
      return NextResponse.json(
        { error: 'Unauthorized: No user in session', message: 'Data pengguna tidak ditemukan dalam sesi. Silakan login ulang.' },
        { status: 401 }
      )
    }
    
    if (!session.user.id) {
      console.error('No user ID in session in PATCH request')
      return NextResponse.json(
        { error: 'Unauthorized: Missing user ID', message: 'ID pengguna tidak ditemukan dalam sesi. Silakan login ulang.' },
        { status: 401 }
      )
    }
    
    // Verify that the user exists in the database
    try {
      const userExists = await db.User.findByPk(session.user.id)
      
      if (!userExists) {
        console.error(`User not found in database in PATCH request. Session user ID: ${session.user.id}`)
        return NextResponse.json(
          { error: 'Unauthorized: User not found in database', message: 'Sesi pengguna tidak valid. Silakan login ulang.' },
          { status: 401 }
        )
      }
    } catch (error) {
      console.error('Error verifying user existence in PATCH request:', error)
      return NextResponse.json(
        { error: 'Error verifying user', message: 'Terjadi kesalahan saat memverifikasi pengguna. Silakan login ulang.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { id, paymentStatus, status, amount, paymentMethod, transactionId } = body

    console.log('Updating transaction:', { id, paymentStatus, status, amount, paymentMethod, transactionId })

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      )
    }
    
    // Validate required fields
    const missingFields = [];
    if (amount === undefined) missingFields.push('amount');
    if (!paymentMethod) missingFields.push('paymentMethod');
    if (!transactionId) missingFields.push('transactionId');
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify transaction exists
    const existingTransaction = await db.Transaction.findByPk(transactionId)

    if (!existingTransaction) {
      console.error(`Transaction with ID ${id} not found`)
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    console.log('Found existing transaction:', existingTransaction)

    // Update transaction
    const updatedTransaction = await db.Transaction.update({
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(status === 'COMPLETED' && { paidAt: new Date() })
    }, {
      where: { id: transactionId },
      returning: true
    })

    // If transaction status changed to COMPLETED and there's a member, update member data
    if (status === 'COMPLETED' && existingTransaction.status !== 'COMPLETED' && updatedTransaction.memberId) {
      try {
        // Calculate points earned (1 point per 1000 rupiah spent)
        const pointsEarned = Math.floor(updatedTransaction.finalTotal / 1000)
        
        // Update member points and total spent
        const memberUpdateData: any = {
          totalSpent: {
            increment: updatedTransaction.finalTotal
          },
          lastVisit: new Date()
        }
        
        // If points were used, calculate net points
        if (updatedTransaction.pointsUsed > 0) {
          memberUpdateData.points = {
            increment: pointsEarned - updatedTransaction.pointsUsed
          }
        } else {
          memberUpdateData.points = {
            increment: pointsEarned
          }
        }
        
        await db.Member.update(memberUpdateData, {
          where: { id: updatedTransaction.memberId }
        })
        
        // Create point history record for points earned
        if (pointsEarned > 0) {
          await db.PointHistory.create({
            memberId: updatedTransaction.memberId,
            points: pointsEarned,
            type: 'EARNED',
            description: `Poin dari transaksi #${updatedTransaction.id}`,
            transactionId: updatedTransaction.id
          })
        }
        
        // Create point history record for points used
        if (updatedTransaction.pointsUsed > 0) {
          await db.PointHistory.create({
            memberId: updatedTransaction.memberId,
            points: -updatedTransaction.pointsUsed,
            type: 'USED',
            description: `Poin digunakan untuk transaksi #${updatedTransaction.id}`,
            transactionId: updatedTransaction.id
          })
        }
        
        // Update transaction with points earned
        await db.Transaction.update({
          where: { id: updatedTransaction.id },
          data: {
            pointsEarned: pointsEarned
          }
        })
        
        console.log(`Member ${updatedTransaction.memberId} updated on transaction completion: +${pointsEarned} points earned, ${updatedTransaction.pointsUsed} points used, +${updatedTransaction.finalTotal} total spent`)
      } catch (error) {
        console.error('Error updating member data on transaction completion:', error)
        // Continue anyway since the transaction was updated
      }
    }

    console.log('Transaction updated successfully:', { id: updatedTransaction.id, status: updatedTransaction.status, paymentStatus: updatedTransaction.paymentStatus })

    return NextResponse.json(updatedTransaction)
  } catch (error: any) {
    console.error('Error updating transaction:', error)
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    return NextResponse.json(
      { 
        error: 'Failed to update transaction', 
        message: errorMessage,
        code: errorCode,
        details: error.meta || {}
      },
      { status: 500 }
    )
  }
}