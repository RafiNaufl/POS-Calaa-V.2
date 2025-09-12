import { Transaction as PrismaTransaction } from '@prisma/client';

// Extend the Prisma Transaction type
export interface Transaction extends PrismaTransaction {
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
  paymentMethod: 'CASH' | 'CARD' | 'DIGITAL_WALLET' | 'VIRTUAL_ACCOUNT' | 'CONVENIENCE_STORE' | 'PAYLATER' | 'BANK_TRANSFER';
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