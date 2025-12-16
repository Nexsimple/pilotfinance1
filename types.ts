
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER'
}

export enum WalletType {
  PERSONAL = 'PERSONAL',
  BUSINESS = 'BUSINESS',
  PROJECT = 'PROJECT',
  INVESTMENT = 'INVESTMENT'
}

export enum InvestmentType {
  STOCK = 'STOCK',
  FIXED_INCOME = 'FIXED_INCOME',
  CRYPTO = 'CRYPTO',
  REAL_ESTATE = 'REAL_ESTATE'
}

export type ViewMode = 'ALL' | 'PERSONAL' | 'BUSINESS' | 'BUSINESS2' | 'BUSINESS3';

export interface Notification {
  id: string;
  type: 'WARNING' | 'SUCCESS' | 'INFO';
  message: string;
  timestamp: number;
}

export interface UserProfile {
  identity: string;         // 1. Quem é você
  currentPhase: string;     // 2. Momento atual
  mainGoal: string;         // 3. Objetivo principal
  financialReality: string; // 4. Realidade financeira
  biggestPain: string;      // 5. Maior dor
  decisionStyle: string;    // 6. Como toma decisões
  riskTolerance: string;    // 7. Relação com risco
  expectations: string;     // 8. Expectativas com o sistema
  extraContext: string;     // 9. Contexto livre
}

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number;
  currency: string;
  bankProvider?: string; // e.g., 'NUBANK', 'ITAU', 'XP'
  isAutomated?: boolean;
  lastSync?: string;
  ownerType?: 'PERSONAL' | 'BUSINESS' | 'BUSINESS2' | 'BUSINESS3'; // Visual Context
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency?: string; // Added currency support
  category: string;
  subcategory?: string;
  date: string; // ISO Date string
  walletId: string;
  toWalletId?: string; // For transfers
  costCenter?: string; // For business
  paymentMethod?: string;
  notes?: string;
  isPending?: boolean;
  
  // Recurrence & Client Management
  isRecurring?: boolean; 
  recurrenceFrequency?: 'MONTHLY' | 'YEARLY'; // New field for Annuities vs Monthly
  recurrenceEndDate?: string;
  clientName?: string;
  
  // Nature & Installments
  nature?: string; // 'Anualidade' | 'Fatura Cartão' | 'Prestações' | 'Mensalidade' | 'Entrada do Mês'
  installmentCurrent?: number; // 1
  installmentTotal?: number;   // 12

  // Visual Projection Flag (Not saved to DB)
  isProjection?: boolean;
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  amountInvested: number;
  currentValue: number;
  date: string;
  institution: string;
  currency: string; // 'BRL' | 'USD' | 'BTC'
  quantity?: number;
  ownerType?: 'PERSONAL' | 'BUSINESS' | 'BUSINESS2' | 'BUSINESS3'; // Visual Context
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  currency?: string; // Added currency support
  period: 'MONTHLY' | 'WEEKLY';
  alertThreshold: number; // e.g., 0.8 for 80%
  ownerType?: 'PERSONAL' | 'BUSINESS' | 'BUSINESS2' | 'BUSINESS3'; // Visual Context
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency?: string; // Added currency support
  deadline: string;
  color: string;
  type: 'PERSONAL' | 'BUSINESS' | 'BUSINESS2' | 'BUSINESS3'; // New field for categorization
  period?: 'MONTHLY' | 'YEARLY' | 'TOTAL'; // Added to support Revenue Targets
}

export interface FinancialState {
  userProfile: UserProfile; // New Profile Data
  wallets: Wallet[];
  transactions: Transaction[];
  investments: Investment[];
  budgets: Budget[];
  goals: Goal[];
}

// File System Access API Types
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: any): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}
