import { Transaction as PrismaTransaction, TransactionItem as PrismaTransactionItem, Product, Member, User } from '@prisma/client';

export interface TransactionWithRelations extends PrismaTransaction {
  items: (PrismaTransactionItem & {
    product: Product | null;
  })[];
  member: Member | null;
  user: User;
}

interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  productCode?: string;
  size?: string;
  color?: string;
}

export interface Transaction {
  id: string;
  createdAt: Date;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  finalTotal: number;
  paymentMethod: string;
  status: string;
  cashier?: string;
  customer?: string;
  customerPhone?: string;
  customerEmail?: string;
  pointsUsed?: number;
  pointsEarned?: number;
  voucherCode?: string;
  voucherDiscount?: number;
  promotionDiscount?: number;
  member?: {
    name: string;
    phone: string;
    email?: string;
  };
  user?: {
    name: string;
  };
}

export class ReceiptFormatter {
  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  }

  private static getPaymentMethodLabel(method: string): string {
    const paymentMethods: { [key: string]: string } = {
      'CASH': 'Tunai',
      'CARD': 'Kartu',
      'DIGITAL_WALLET': 'Dompet Digital',
      'VIRTUAL_ACCOUNT': 'Virtual Account',
      'CONVENIENCE_STORE': 'Convenience Store',
      'PAYLATER': 'PayLater',
      'BANK_TRANSFER': 'Transfer Bank'
    };
    return paymentMethods[method] || method;
  }

  private static getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'COMPLETED': 'Selesai',
      'PENDING': 'Menunggu',
      'CANCELLED': 'Dibatalkan',
      'REFUNDED': 'Dikembalikan'
    };
    return statusLabels[status] || status;
  }

  private static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  public static formatReceiptForWhatsApp(transaction: Transaction): string {
    let receipt = `🙏 *Terima kasih telah berbelanja di Wear Calaa!*\n`;
    receipt += `✨ Fashion berkualitas untuk gaya hidup Anda\n\n`;

    // Transaction Info
    receipt += `📋 *DETAIL TRANSAKSI*\n`;
    receipt += ` - No. Transaksi: *${transaction.id}*\n`;
    receipt += ` - Tanggal: ${this.formatDate(transaction.createdAt)}\n`;
    receipt += ` - Kasir: ${transaction.user?.name || transaction.cashier || 'Admin'}\n`;
    
    if (transaction.member) {
      receipt += ` - Member: ${transaction.member.name}\n`;
      receipt += ` - Telepon: ${transaction.member.phone}\n`;
    } else if (transaction.customer) {
      receipt += ` - Pelanggan: ${transaction.customer}\n`;
      if (transaction.customerPhone) {
        receipt += ` - Telepon: ${transaction.customerPhone}\n`;
      }
    }
    receipt += `\n`;

    // Items
    receipt += `🛍️ *DETAIL PESANAN*\n`;
    
    transaction.items.forEach((item, index) => {
      receipt += `${index + 1}. *${item.name}*\n`;
      
      if (item.productCode) {
        receipt += `   📦 Kode: ${item.productCode}\n`;
      }
      if (item.size) {
        receipt += `   📏 Ukuran: ${item.size}\n`;
      }
      if (item.color) {
        receipt += `   🎨 Warna: ${item.color}\n`;
      }
      
      receipt += `   🛒 Jumlah: ${item.quantity} × ${this.formatCurrency(item.price)} = *${this.formatCurrency(item.total)}*\n\n`;
    });

    // Totals
    receipt += `💰 *RINCIAN PEMBAYARAN*\n`;
    receipt += `Subtotal: ${this.formatCurrency(transaction.subtotal)}\n`;
    
    if (transaction.tax && transaction.tax > 0) {
      receipt += `Pajak: ${this.formatCurrency(transaction.tax)}\n`;
    }

    // Discounts
    if (transaction.pointsUsed && transaction.pointsUsed > 0) {
      const pointDiscount = transaction.pointsUsed * 1000;
      receipt += `🎯 Diskon Poin (${transaction.pointsUsed} poin): -${this.formatCurrency(pointDiscount)}\n`;
    }

    if (transaction.voucherCode && transaction.voucherDiscount && transaction.voucherDiscount > 0) {
      receipt += `🎟️ Diskon Voucher (${transaction.voucherCode}): -${this.formatCurrency(transaction.voucherDiscount)}\n`;
    }

    if (transaction.promotionDiscount && transaction.promotionDiscount > 0) {
      receipt += `🎉 Diskon Promosi: -${this.formatCurrency(transaction.promotionDiscount)}\n`;
    }

    receipt += `\n💳 *TOTAL PEMBAYARAN: ${this.formatCurrency(transaction.finalTotal)}*\n`;

    // Payment Info
    receipt += `💸 Metode Pembayaran: ${this.getPaymentMethodLabel(transaction.paymentMethod)}\n`;
    receipt += `📊 Status: ${this.getStatusLabel(transaction.status)}\n`;

    // Points earned
    if (transaction.pointsEarned && transaction.pointsEarned > 0) {
      receipt += `⭐ Poin Diperoleh: +${transaction.pointsEarned} poin\n`;
    }

    receipt += `\n👕 *WEAR CALAA*\n`;
    receipt += `📍 Jl. KH. M. Sadeli, Karangasem\n`;
    receipt += `   Kec. Cibeber, Kota Cilegon\n`;
    receipt += `   Banten 42426\n`;
    receipt += `📞 0821-1382-3194\n`;
    receipt += `📷 Instagram: @wear.calaa\n\n`;

    receipt += `❗️ *Note* ❗️\n`;
    receipt += `📝 Barang yang sudah dibeli tidak dapat dikembalikan\n`;
    receipt += `🕐 Dicetak pada: ${this.formatDate(new Date())}\n\n`;

    return receipt;
  }

  public static formatSimpleReceipt(transaction: Transaction): string {
    let receipt = `🧾 *STRUK PEMBAYARAN*\n`;
    receipt += `👕 *WEAR CALAA*\n`;
    receipt += `📷 Instagram: @wear.calaa\n\n`;
    receipt += `🆔 ${transaction.id}\n`;
    receipt += `📅 ${this.formatDate(transaction.createdAt)}\n\n`;
    
    receipt += `🛍️ *Pesanan:*\n`;
    transaction.items.forEach((item, index) => {
      receipt += `${index + 1}. ${item.name} (${item.quantity}x) - ${this.formatCurrency(item.total)}\n`;
    });
    
    receipt += `\n💰 *Total: ${this.formatCurrency(transaction.finalTotal)}*\n`;
    receipt += `💳 ${this.getPaymentMethodLabel(transaction.paymentMethod)}\n`;
    receipt += `📊 ${this.getStatusLabel(transaction.status)}\n\n`;
    receipt += `🙏 Terima kasih telah berbelanja di Wear Calaa!`;

    return receipt;
  }

  public static validatePhoneNumber(phoneNumber: string): { isValid: boolean; formatted?: string; error?: string } {
    try {
      // Remove all non-numeric characters
      let cleaned = phoneNumber.replace(/\D/g, '');
      
      // Handle Indonesian numbers
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      } else if (cleaned.startsWith('62')) {
        // Already in correct format
      } else if (cleaned.startsWith('+62')) {
        cleaned = cleaned.substring(1);
      } else if (cleaned.length >= 9 && cleaned.length <= 12) {
        // Assume it's an Indonesian number without country code
        cleaned = '62' + cleaned;
      } else {
        return { isValid: false, error: 'Format nomor tidak valid' };
      }

      // Validate length (Indonesian mobile numbers)
      if (cleaned.length < 10 || cleaned.length > 15) {
        return { isValid: false, error: 'Panjang nomor tidak valid' };
      }

      // Validate Indonesian mobile prefixes
      const validPrefixes = ['628', '6281', '6282', '6283', '6285', '6287', '6288', '6289'];
      const hasValidPrefix = validPrefixes.some(prefix => cleaned.startsWith(prefix));
      
      if (!hasValidPrefix) {
        return { isValid: false, error: 'Prefix nomor tidak valid untuk Indonesia' };
      }

      return { isValid: true, formatted: cleaned };
    } catch (error) {
      return { isValid: false, error: 'Error validating phone number' };
    }
  }
}

export default ReceiptFormatter;