// Custom type definitions for receipt formatting
interface Product {
  id: string;
  name: string;
  price: number;
  code?: string;
  size?: string;
  color?: string;
}

interface Member {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

interface User {
  id: string;
  name: string;
}

interface PrismaTransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface PrismaTransaction {
  id: string;
  createdAt: Date;
  total: number;
  tax: number;
  finalTotal: number;
  paymentMethod: string;
  status: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  pointsUsed?: number;
  pointsEarned?: number;
  voucherCode?: string;
  voucherDiscount?: number;
  promoDiscount?: number;
}

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
      'QRIS': 'QRIS',
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

  // Ensure numeric values are parsed correctly from strings like "1.234,56" or "1,23" or currency strings
  private static toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      // Keep digits, dot, comma, minus; drop currency and spaces
      const cleaned = value.replace(/[^\d.,-]/g, '');
      let normalized = cleaned;
      if (cleaned.includes('.') && cleaned.includes(',')) {
        // e.g. 1.234,56 -> 1234.56
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (cleaned.includes(',') && !cleaned.includes('.')) {
        // e.g. 1,23 -> 1.23
        normalized = cleaned.replace(',', '.');
      }
      const num = parseFloat(normalized);
      return Number.isFinite(num) ? num : 0;
    }
    // Handle null/undefined/other types
    return 0;
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
      
      const itemPrice = this.toNumber(item.price);
      const itemTotal = this.toNumber(item.total);
      const qty = this.toNumber(item.quantity);
      receipt += `   🛒 Jumlah: ${qty} × ${this.formatCurrency(itemPrice)} = *${this.formatCurrency(itemTotal)}*\n\n`;
    });

    // Totals
    receipt += `💰 *RINCIAN PEMBAYARAN*\n`;
    const subtotal = this.toNumber(transaction.subtotal);
    receipt += `Subtotal: ${this.formatCurrency(subtotal)}\n`;
    
    const tax = this.toNumber(transaction.tax);
    if (tax > 0) {
      receipt += `Pajak: ${this.formatCurrency(tax)}\n`;
    }

    // Discounts
    const pointsUsed = this.toNumber(transaction.pointsUsed);
    if (pointsUsed > 0) {
      const pointDiscount = pointsUsed * 1000;
      receipt += `🎯 Diskon Poin (${pointsUsed} poin): -${this.formatCurrency(pointDiscount)}\n`;
    }

    const voucherDiscount = this.toNumber(transaction.voucherDiscount);
    if (transaction.voucherCode && voucherDiscount > 0) {
      receipt += `🎟️ Diskon Voucher (${transaction.voucherCode}): -${this.formatCurrency(voucherDiscount)}\n`;
    }

    const promotionDiscount = this.toNumber(transaction.promotionDiscount);
    if (promotionDiscount > 0) {
      receipt += `🎉 Diskon Promosi: -${this.formatCurrency(promotionDiscount)}\n`;
    }

    const finalTotal = this.toNumber(transaction.finalTotal);
    receipt += `\n💳 *TOTAL PEMBAYARAN: ${this.formatCurrency(finalTotal)}*\n`;

    // Payment Info
    receipt += `💸 Metode Pembayaran: ${this.getPaymentMethodLabel(transaction.paymentMethod)}\n`;
    receipt += `📊 Status: ${this.getStatusLabel(transaction.status)}\n`;

    // Points earned
    const pointsEarned = this.toNumber(transaction.pointsEarned);
    if (pointsEarned > 0) {
      receipt += `⭐ Poin Diperoleh: +${pointsEarned} poin\n`;
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
      const itemTotal = this.toNumber(item.total);
      receipt += `${index + 1}. ${item.name} (${item.quantity}x) - ${this.formatCurrency(itemTotal)}\n`;
    });
    
    const finalTotal = this.toNumber(transaction.finalTotal);
    receipt += `\n💰 *Total: ${this.formatCurrency(finalTotal)}*\n`;
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