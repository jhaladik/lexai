import { CURRENCY_FORMATS } from '../constants';

// Generate unique IDs
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${randomStr}`;
}

// Format currency
export function formatCurrency(amount: number, currency: 'CZK' | 'EUR' = 'CZK'): string {
  return CURRENCY_FORMATS[currency].format(amount);
}

// Parse IČO (Czech business registration number)
export function validateICO(ico: string): boolean {
  const cleaned = ico.replace(/\s/g, '');
  if (!/^\d{8}$/.test(cleaned)) return false;

  // Checksum validation
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(cleaned[i]) * (8 - i);
  }
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder;

  return checkDigit === parseInt(cleaned[7]);
}

// Calculate fraud score
export function calculateFraudScore(params: {
  debtorTotalDebtsCount: number;
  amountVsAverage: number;
  hasContract: boolean;
  hasInvoice: boolean;
  clientCredibilityScore: number;
  debtorBlacklistStatus: 'none' | 'flagged' | 'blacklisted';
  recentDebtsCount: number;
}): number {
  let score = 0;

  // Check 1: Same debtor from multiple clients (10-30 points)
  if (params.debtorTotalDebtsCount > 3) {
    score += Math.min(30, params.debtorTotalDebtsCount * 5);
  }

  // Check 2: Amount significantly above average (10 points)
  if (params.amountVsAverage > 3) {
    score += 10;
  }

  // Check 3: Missing critical documents (20 points)
  if (!params.hasContract || !params.hasInvoice) {
    score += 20;
  }

  // Check 4: New client with low credibility (15 points)
  if (params.clientCredibilityScore < 30) {
    score += 15;
  }

  // Check 5: Debtor on blacklist (50 points - critical)
  if (params.debtorBlacklistStatus === 'blacklisted') {
    score += 50;
  }

  // Check 6: Suspicious velocity (15 points)
  if (params.recentDebtsCount > 20) {
    score += 15;
  }

  return Math.min(100, score);
}

// Calculate payment plan installment
export function calculateInstallment(
  totalAmount: number,
  downPayment: number,
  installmentCount: number
): number {
  const remaining = totalAmount - downPayment;
  return Math.ceil(remaining / installmentCount);
}

// Check if debt is past statute of limitations (3 years in Czech law)
export function isPastStatuteOfLimitations(dueDate: number): boolean {
  const threeYearsAgo = Date.now() - 3 * 365 * 24 * 60 * 60 * 1000;
  return dueDate < threeYearsAgo;
}

// Generate debt reference number
export function generateDebtReference(clientId: string, sequenceNumber: number): string {
  const year = new Date().getFullYear();
  const paddedSequence = sequenceNumber.toString().padStart(4, '0');
  return `${clientId.slice(0, 3).toUpperCase()}-${year}-${paddedSequence}`;
}
