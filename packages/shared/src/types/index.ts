// Database Types
export type UserRole =
  | 'admin'
  | 'attorney'
  | 'attorney_employee'
  | 'client'
  | 'client_employee'
  | 'mediator'
  | 'debtor'
  | 'debtor_representative';

export type DebtStatus =
  | 'draft'
  | 'pending_verification'
  | 'verified'
  | 'initial_letter_sent'
  | 'attorney_review'
  | 'attorney_letter_sent'
  | 'in_mediation'
  | 'payment_plan_active'
  | 'payment_plan_defaulted'
  | 'resolved_paid'
  | 'resolved_partial'
  | 'written_off'
  | 'litigation'
  | 'disputed';

export type DebtType = 'invoice' | 'lease' | 'rental' | 'service' | 'damage' | 'other';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'gopay' | 'other';

export type DocumentType =
  | 'contract'
  | 'invoice'
  | 'delivery_proof'
  | 'communication'
  | 'demand_letter'
  | 'attorney_letter'
  | 'payment_agreement'
  | 'settlement'
  | 'other';

export type CommunicationType = 'email' | 'sms' | 'letter' | 'portal_message' | 'phone_call';

export type DisputeType =
  | 'amount_incorrect'
  | 'never_received'
  | 'quality_issue'
  | 'already_paid'
  | 'contract_dispute'
  | 'fraud_claim'
  | 'other';

// Entity Interfaces
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  custom_domain?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  language: string;
  timezone: string;
  country: string;
  created_at: number;
  status: 'active' | 'suspended' | 'trial';
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  language: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: number;
  last_login?: number;
}

export interface Client {
  id: string;
  tenant_id: string;
  user_id: string;
  company_name: string;
  registration_number?: string;
  vat_number?: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  industry?: string;
  monthly_debt_limit: number;
  total_debt_limit?: number;
  verification_status: 'pending' | 'verified' | 'rejected' | 'flagged';
  verification_date?: number;
  verified_by?: string;
  credibility_score: number;
  created_at: number;
}

export interface Debtor {
  id: string;
  tenant_id: string;
  type: 'individual' | 'business';
  first_name?: string;
  last_name?: string;
  birth_date?: number;
  company_name?: string;
  registration_number?: string;
  vat_number?: string;
  email?: string;
  phone?: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  language: string;
  blacklist_status: 'none' | 'flagged' | 'blacklisted';
  blacklist_reason?: string;
  total_debts_count: number;
  total_debts_value: number;
  created_at: number;
}

export interface Debt {
  id: string;
  tenant_id: string;
  client_id: string;
  debtor_id: string;
  reference_number?: string;
  debt_type: DebtType;
  original_amount: number;
  current_amount: number;
  currency: string;
  invoice_date: number;
  due_date: number;
  created_at: number;
  status: DebtStatus;
  substatus?: string;
  has_contract: boolean;
  has_invoice: boolean;
  has_delivery_proof: boolean;
  has_communication_log: boolean;
  verification_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  verification_date?: number;
  verified_by?: string;
  verification_notes?: string;
  fraud_score: number;
  assigned_attorney?: string;
  assigned_mediator?: string;
  total_paid: number;
  last_payment_date?: number;
  notes?: string;
  tags?: string;
}

export interface Document {
  id: string;
  tenant_id: string;
  debt_id?: string;
  client_id?: string;
  type: DocumentType;
  filename: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
  uploaded_at: number;
  template_id?: string;
  generated: boolean;
}

export interface Payment {
  id: string;
  tenant_id: string;
  debt_id: string;
  installment_id?: string;
  amount: number;
  currency: string;
  payment_method?: PaymentMethod;
  processor?: string;
  processor_payment_id?: string;
  processor_status?: string;
  client_amount?: number;
  platform_fee?: number;
  attorney_fee?: number;
  status: PaymentStatus;
  paid_at?: number;
  created_at: number;
  metadata?: string;
}

export interface PaymentPlan {
  id: string;
  tenant_id: string;
  debt_id: string;
  total_amount: number;
  down_payment: number;
  installment_amount: number;
  installment_count: number;
  installment_frequency: 'weekly' | 'biweekly' | 'monthly';
  start_date: number;
  agreed_by_client: boolean;
  agreed_by_debtor: boolean;
  agreement_date?: number;
  agreement_document_id?: string;
  acceleration_enabled: boolean;
  grace_period_days: number;
  status: 'draft' | 'proposed' | 'active' | 'completed' | 'defaulted' | 'cancelled';
  default_date?: number;
  created_at: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
