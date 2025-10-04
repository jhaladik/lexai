// Currency formatting
export const CURRENCY_FORMATS = {
  CZK: {
    symbol: 'Kč',
    decimals: 2,
    format: (amount: number) => `${(amount / 100).toLocaleString('cs-CZ')} Kč`,
  },
  EUR: {
    symbol: '€',
    decimals: 2,
    format: (amount: number) => `€${(amount / 100).toLocaleString('cs-CZ')}`,
  },
} as const;

// Date formats by locale
export const DATE_FORMATS = {
  cs: 'dd.MM.yyyy',
  sk: 'dd.MM.yyyy',
  en: 'MM/dd/yyyy',
  de: 'dd.MM.yyyy',
} as const;

// Supported languages
export const LANGUAGES = ['cs', 'sk', 'en', 'de'] as const;

// Default limits
export const DEFAULT_MONTHLY_DEBT_LIMIT = 10;
export const DEFAULT_CREDIBILITY_SCORE = 50;
export const DEFAULT_GRACE_PERIOD_DAYS = 5;

// Fraud score thresholds
export const FRAUD_SCORE_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 50,
  HIGH: 70,
  CRITICAL: 90,
} as const;

// Fee percentages (default)
export const DEFAULT_PLATFORM_FEE_PERCENT = 5;
export const DEFAULT_ATTORNEY_FEE_PERCENT = 20;

// API pagination defaults
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

// File upload limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// Status colors for UI
export const STATUS_COLORS = {
  draft: 'gray',
  pending_verification: 'yellow',
  verified: 'blue',
  initial_letter_sent: 'indigo',
  attorney_review: 'purple',
  attorney_letter_sent: 'violet',
  in_mediation: 'cyan',
  payment_plan_active: 'teal',
  payment_plan_defaulted: 'orange',
  resolved_paid: 'green',
  resolved_partial: 'lime',
  written_off: 'red',
  litigation: 'pink',
  disputed: 'amber',
} as const;
