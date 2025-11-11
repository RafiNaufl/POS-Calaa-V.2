// Custom Transaction type definitions

// Base Transaction interface
export interface Transaction {
  id: string;
  createdAt: Date;
  subtotal: number;
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

// For components that use a simplified Transaction interface
export interface TransactionUI {
  id: string;
  date: string;
  time: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  total: number;
  voucherDiscount?: number;
  promoDiscount?: number;
  voucherCode?: string;
  paymentMethod: 'CASH' | 'CARD' | 'QRIS' | 'VIRTUAL_ACCOUNT' | 'CONVENIENCE_STORE' | 'PAYLATER' | 'BANK_TRANSFER';
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'REFUNDED';
  cashier: string;
  customer?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}