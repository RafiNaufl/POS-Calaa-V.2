import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import WhatsAppService from '@/lib/whatsapp';
import ReceiptFormatter from '@/lib/receiptFormatter';
import WhatsAppErrorHandler from '@/lib/errorHandler';

interface SendClosureSummaryRequest {
  phoneNumber: string;
  report: any; // Struktur mengikuti output dari cashier-shifts/close
}

const formatIDR = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number.isFinite(value) ? value : 0);

const formatDateTime = (date: string | number | Date | undefined) => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString('id-ID');
  } catch {
    return String(date);
  }
};

function formatClosureSummaryMessage(report: any) {
  const lines: string[] = [];
  lines.push('*Ringkasan Penutupan Shift*');
  if (report?.shiftId) lines.push(`Shift: ${report.shiftId}`);
  lines.push(`Mulai: ${formatDateTime(report?.startTime)}`);
  lines.push(`Selesai: ${formatDateTime(report?.endTime)}`);
  lines.push('');
  lines.push(`Saldo Awal: ${formatIDR(report?.openingBalance || 0)}`);
  lines.push(`Penjualan CASH: ${formatIDR(report?.cashSales || 0)}`);
  lines.push(`Total Transaksi: ${formatIDR(report?.totalTransactions || 0)}`);
  lines.push(`Kas Sistem (Expected): ${formatIDR(report?.systemExpectedCash || 0)}`);
  lines.push(`Kas Fisik: ${formatIDR(report?.physicalCash || 0)}`);
  lines.push(`Selisih: ${formatIDR(report?.difference || 0)}`);
  lines.push('');
  lines.push('*Pembayaran*');
  const pb = report?.paymentBreakdown || {};
  lines.push(`- CASH: ${formatIDR(pb?.CASH?.total || 0)} (${pb?.CASH?.count || 0} trx)`);
  lines.push(`- CARD: ${formatIDR(pb?.CARD?.total || 0)} (${pb?.CARD?.count || 0} trx)`);
  lines.push(`- QRIS: ${formatIDR(pb?.QRIS?.total || 0)} (${pb?.QRIS?.count || 0} trx)`);
  lines.push(`- Transfer: ${formatIDR(pb?.BANK_TRANSFER?.total || 0)} (${pb?.BANK_TRANSFER?.count || 0} trx)`);
  lines.push('');
  lines.push('*Status Transaksi*');
  const sc = report?.statusCounts || {};
  lines.push(`- Selesai: ${sc?.COMPLETED || 0}`);
  lines.push(`- Menunggu: ${sc?.PENDING || 0}`);
  lines.push(`- Dibatalkan: ${sc?.CANCELLED || 0}`);
  lines.push(`- Dikembalikan: ${sc?.REFUNDED || 0}`);
  lines.push('');
  lines.push('*Diskon & Pajak*');
  const dt = report?.discountTotals || {};
  lines.push(`- Diskon Manual: ${formatIDR(dt?.discount || 0)}`);
  lines.push(`- Diskon Voucher: ${formatIDR(dt?.voucherDiscount || 0)}`);
  lines.push(`- Diskon Promo: ${formatIDR(dt?.promoDiscount || 0)}`);
  lines.push(`- Pajak: ${formatIDR(dt?.tax || 0)}`);
  lines.push('');
  lines.push('*Poin & Item*');
  const pt = report?.pointsTotals || {};
  lines.push(`- Poin Diperoleh: ${pt?.earned || 0}`);
  lines.push(`- Poin Digunakan: ${pt?.used || 0}`);
  lines.push(`- Item Terjual: ${report?.itemsSold || 0}`);
  
  // Opsional: ringkas log (maks 3 baris)
  if (Array.isArray(report?.logs) && report.logs.length > 0) {
    lines.push('');
    lines.push('*Log Shift (3 terbaru)*');
    const lastLogs = report.logs.slice(-3);
    for (const l of lastLogs) {
      lines.push(`- ${l.action} • ${formatDateTime(l.createdAt)}`);
    }
  }

  lines.push('');
  lines.push('_Dikirim otomatis oleh sistem kasir._');
  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SendClosureSummaryRequest = await request.json();
    const { phoneNumber, report } = body;

    if (!phoneNumber || !report) {
      return NextResponse.json(
        { error: 'Phone number dan report wajib diisi' },
        { status: 400 }
      );
    }

    const phoneValidation = ReceiptFormatter.validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { error: phoneValidation.error || 'Format nomor WhatsApp tidak valid' },
        { status: 400 }
      );
    }

    const message = formatClosureSummaryMessage(report);

    const whatsappService = WhatsAppService.getInstance();

    if (!whatsappService.isConnected()) {
      try {
        await whatsappService.initialize();
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('[API] Gagal inisialisasi WhatsApp:', error);
      }
    }

    const maxRetries = 3;
    const retryDelay = 2000;
    let attempt = 0;
    let result: { success: boolean; error?: string; messageId?: string } | null = null;

    while (attempt < maxRetries) {
      attempt++;
      if (!whatsappService.isConnected()) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          return NextResponse.json(
            { 
              error: 'WhatsApp service is not connected',
              details: 'Pastikan WhatsApp tersambung sebelum mengirim pesan'
            },
            { status: 503 }
          );
        }
      }

      result = await whatsappService.sendMessage(
        phoneValidation.formatted || phoneNumber,
        message
      );

      if (result.success) {
        break;
      } else {
        const msg = result.error || '';
        if (attempt < maxRetries && (
          msg.includes('tidak terhubung') ||
          msg.includes('not connected') ||
          msg.includes('connection')
        )) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          break;
        }
      }
    }

    if (!result || !result.success) {
      return NextResponse.json(
        { error: 'Gagal mengirim pesan WhatsApp', details: result?.error || 'Unknown error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Ringkasan penutupan dikirim via WhatsApp',
      data: {
        phoneNumber: phoneValidation.formatted || phoneNumber,
        messageId: result.messageId,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error sending closure summary via WhatsApp:', error);
    const whatsappError = WhatsAppErrorHandler.handleError(error);
    return NextResponse.json(
      WhatsAppErrorHandler.formatErrorForAPI(whatsappError),
      { status: whatsappError.retryable ? 503 : 400 }
    );
  }
}

export async function GET() {
  try {
    const whatsappService = WhatsAppService.getInstance();
    const isConnected = whatsappService.isConnected();
    return NextResponse.json({ status: 'ok', whatsappConnected: isConnected, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: 'error', whatsappConnected: false, error: String(error) }, { status: 500 });
  }
}