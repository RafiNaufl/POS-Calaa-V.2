import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const transactions = await prisma.transaction.findMany({
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        },
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            points: true
          }
        },
        voucherUsages: {
          include: {
            voucher: {
              select: {
                code: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

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
      const userExists = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      })
      
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
      memberId
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
    
    // Create transaction
    const transactionData: any = {
      userId: session.user.id,
      total: parseFloat(subtotal.toString()), // Use subtotal as total
      tax: 0, // Set tax to 0 since we're removing tax feature
      finalTotal: parseFloat(total.toString()), // Required field in schema
      paymentMethod,
      status: paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' ? 'PENDING' : 'COMPLETED',
      paymentStatus: paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' ? 'PENDING' : 'PAID',
      paidAt: paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'MIDTRANS' ? null : new Date(),
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      pointsUsed: pointsUsed || 0,
      voucherDiscount: voucherDiscount || 0,
      promoDiscount: promotionDiscount || promoDiscount || 0,
      memberId: memberId || null,
    };

    // Add custom ID if provided (for Midtrans)
    if (id) {
      transactionData.id = id;
    }

    const transaction = await prisma.transaction.create({
      data: {
        ...transactionData,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: parseFloat(item.price.toString()),
            subtotal: parseFloat(item.price.toString()) * item.quantity // Required field in schema
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        },
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            points: true
          }
        },
        voucherUsages: {
          include: {
            voucher: {
              select: {
                code: true,
                name: true
              }
            }
          }
        }
      }
    })
    
    // If there's a voucher code, record its usage
    if (voucherCode) {
      try {
        const voucher = await prisma.voucher.findUnique({
          where: { code: voucherCode }
        })
        
        if (voucher) {
          await prisma.voucherUsage.create({
            data: {
              voucherId: voucher.id,
              transactionId: transaction.id,
              discountAmount: voucherDiscount || 0
            }
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
        
        // Update member points and total spent
        const memberUpdateData: any = {
          totalSpent: {
            increment: parseFloat(total.toString())
          },
          lastVisit: new Date()
        }
        
        // If points were used, decrement them
        if (pointsUsed > 0) {
          memberUpdateData.points = {
            increment: pointsEarned - pointsUsed
          }
        } else {
          memberUpdateData.points = {
            increment: pointsEarned
          }
        }
        
        await prisma.member.update({
          where: { id: memberId },
          data: memberUpdateData
        })
        
        // Create point history record for points earned
        if (pointsEarned > 0) {
          await prisma.pointHistory.create({
            data: {
              memberId: memberId,
              points: pointsEarned,
              type: 'EARNED',
              description: `Poin dari transaksi #${transaction.id}`,
              transactionId: transaction.id
            }
          })
        }
        
        // Create point history record for points used
        if (pointsUsed > 0) {
          await prisma.pointHistory.create({
            data: {
              memberId: memberId,
              points: -pointsUsed,
              type: 'USED',
              description: `Poin digunakan untuk transaksi #${transaction.id}`,
              transactionId: transaction.id
            }
          })
        }
        
        // Update transaction with points earned
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            pointsEarned: pointsEarned
          }
        })
        
        console.log(`Member ${memberId} updated: +${pointsEarned} points earned, ${pointsUsed} points used, +${total} total spent`)
      } catch (error) {
        console.error('Error updating member data:', error)
        // Continue anyway since the transaction was created
      }
    }
    
    // Update product stock for completed transactions
    if (paymentMethod !== 'VIRTUAL_ACCOUNT' && paymentMethod !== 'BANK_TRANSFER') {
      try {
        // Update stock for each product in the transaction
        for (const item of items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity
              }
            }
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
    } else if (error.code === 'P2002') {
      // Prisma unique constraint violation
      statusCode = 409;
    } else if (error.code === 'P2003') {
      // Prisma foreign key constraint violation
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
  } finally {
    await prisma.$disconnect()
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
      const userExists = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      })
      
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
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id }
    })

    if (!existingTransaction) {
      console.error(`Transaction with ID ${id} not found`)
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    console.log('Found existing transaction:', existingTransaction)

    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(paymentStatus && { paymentStatus }),
        ...(status && { status }),
        ...(paymentStatus === 'PAID' && { paidAt: new Date() }),
        ...(amount !== undefined && { amount: parseFloat(amount.toString()) }),
        ...(paymentMethod && { paymentMethod }),
        ...(transactionId && { transactionId })
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        member: true
      }
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
        
        await prisma.member.update({
          where: { id: updatedTransaction.memberId },
          data: memberUpdateData
        })
        
        // Create point history record for points earned
        if (pointsEarned > 0) {
          await prisma.pointHistory.create({
            data: {
              memberId: updatedTransaction.memberId,
              points: pointsEarned,
              type: 'EARNED',
              description: `Poin dari transaksi #${updatedTransaction.id}`,
              transactionId: updatedTransaction.id
            }
          })
        }
        
        // Create point history record for points used
        if (updatedTransaction.pointsUsed > 0) {
          await prisma.pointHistory.create({
            data: {
              memberId: updatedTransaction.memberId,
              points: -updatedTransaction.pointsUsed,
              type: 'USED',
              description: `Poin digunakan untuk transaksi #${updatedTransaction.id}`,
              transactionId: updatedTransaction.id
            }
          })
        }
        
        // Update transaction with points earned
        await prisma.transaction.update({
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
  } finally {
    await prisma.$disconnect()
  }
}