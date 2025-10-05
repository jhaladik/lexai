// API client for LexAI backend

const API_BASE_URL =
  import.meta.env.PROD || window.location.hostname !== 'localhost'
    ? 'https://lexai-api.jhaladik.workers.dev'
    : 'http://localhost:8787';

export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface APIResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Get Cloudflare Access JWT token from cookie
 */
function getCFAccessToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'CF_Authorization') {
      return value;
    }
  }
  return null;
}

/**
 * Makes authenticated API request
 * Manually extracts JWT from cookie and sends as header
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getCFAccessToken();

  const headers: Record<string, string> = {
    ...(token ? { 'CF-Access-JWT-Assertion': token } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  // Only add Content-Type if not already set (for CSV uploads)
  if (!options.headers || !('Content-Type' in options.headers)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data: APIResponse<T> = await response.json();

  if (!response.ok || data.error) {
    throw new APIError(
      data.error?.message || 'Request failed',
      data.error?.code || 'UNKNOWN_ERROR',
      response.status
    );
  }

  if (!data.data) {
    throw new APIError('No data in response', 'NO_DATA', response.status);
  }

  return data.data;
}

// API methods
export const api = {
  // Dashboard
  dashboard: {
    get: () => apiRequest<{
      stats: {
        total_debts: number;
        active_debts: number;
        total_value: number;
        total_collected: number;
      };
      recent_debts: Array<{
        id: string;
        reference_number: string;
        original_amount: number;
        status: string;
        created_at: number;
        debtor_type: string;
        first_name?: string;
        last_name?: string;
        company_name?: string;
      }>;
    }>('/api/v1/dashboard'),
  },

  // Auth
  auth: {
    me: () => apiRequest<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      tenant_id: string;
    }>('/api/v1/auth/me'),
  },

  // Clients
  clients: {
    list: () => apiRequest<Array<{
      id: string;
      company_name: string;
      registration_number: string | null;
      vat_number: string | null;
      address: string;
      city: string;
      postal_code: string;
      country: string;
      industry: string | null;
      verification_status: string;
      credibility_score: number;
      created_at: number;
      email: string;
      first_name: string;
      last_name: string;
      total_debts: number;
      total_debt_value: number;
    }>>('/api/v1/clients'),
    get: (id: string) => apiRequest<{
      id: string;
      company_name: string;
      registration_number: string | null;
      vat_number: string | null;
      address: string;
      city: string;
      postal_code: string;
      country: string;
      industry: string | null;
      verification_status: string;
      credibility_score: number;
      created_at: number;
      email: string;
      first_name: string;
      last_name: string;
      total_debts: number;
      total_debt_value: number;
      total_collected: number;
    }>(`/api/v1/clients/${id}`),
    create: (data: {
      company_name: string;
      email: string;
      first_name: string;
      last_name: string;
      registration_number?: string;
      vat_number?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      country?: string;
      industry?: string;
      language?: string;
    }) =>
      apiRequest('/api/v1/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: {
      company_name: string;
      registration_number?: string;
      vat_number?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      country?: string;
      industry?: string;
    }) =>
      apiRequest(`/api/v1/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    verify: (id: string, data: { status: string; credibility_score?: number }) =>
      apiRequest(`/api/v1/clients/${id}/verify`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest(`/api/v1/clients/${id}`, {
        method: 'DELETE',
      }),
  },

  // Debts
  debts: {
    list: () => apiRequest<Array<any>>('/api/v1/debts'),
    get: (id: string) => apiRequest<any>(`/api/v1/debts/${id}`),
    create: (data: {
      client_id: string;
      debtor_id: string;
      debtor?: {
        type: string;
        first_name?: string;
        last_name?: string;
        company_name?: string;
        registration_number?: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        postal_code?: string;
        country?: string;
      };
      debt_type: string;
      reference_number?: string;
      original_amount: number;
      currency?: string;
      invoice_date?: string;
      due_date?: string;
      has_contract?: boolean;
      has_invoice?: boolean;
      has_delivery_proof?: boolean;
      has_communication_log?: boolean;
      notes?: string;
    }) =>
      apiRequest('/api/v1/debts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: {
      debt_type: string;
      reference_number?: string;
      original_amount: number;
      currency?: string;
      invoice_date?: string;
      due_date?: string;
      has_contract?: boolean;
      has_invoice?: boolean;
      has_delivery_proof?: boolean;
      has_communication_log?: boolean;
      notes?: string;
    }) =>
      apiRequest(`/api/v1/debts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest(`/api/v1/debts/${id}`, {
        method: 'DELETE',
      }),
    verify: (id: string) =>
      apiRequest<any>(`/api/v1/debts/${id}/verify`, {
        method: 'PUT',
      }),
    bulkUpload: (csvContent: string) =>
      apiRequest<{
        message: string;
        results: {
          total: number;
          successful: number;
          flagged: number;
          failed: number;
          errors: Array<{ row: number; message: string }>;
        };
      }>('/api/v1/debts/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csvContent,
      }),
    downloadTemplate: () => {
      window.location.href = `${API_BASE_URL}/api/v1/debts/bulk-template`;
    },
  },

  // Debtors
  debtors: {
    list: () => apiRequest<Array<{
      id: string;
      type: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
      registration_number: string | null;
      email: string | null;
      phone: string | null;
      city: string | null;
    }>>('/api/v1/debtors'),
    get: (id: string) => apiRequest<any>(`/api/v1/debtors/${id}`),
    update: (id: string, data: {
      first_name?: string;
      last_name?: string;
      company_name?: string;
      registration_number?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      country?: string;
    }) =>
      apiRequest(`/api/v1/debtors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    sendBulkNotification: (id: string) =>
      apiRequest<{
        message: string;
        portal_link: string;
        sent_to: string;
        debt_count: number;
        token_expires_at: number;
      }>(`/api/v1/debtors/${id}/notify`, {
        method: 'POST',
      }),
  },

  // Notifications
  notifications: {
    sendDebtNotification: (debtId: string) =>
      apiRequest<{
        message: string;
        portal_link: string;
        sent_to: string;
        token_expires_at: number;
      }>(`/api/v1/notifications/debt/${debtId}`, {
        method: 'POST',
      }),
    getNotificationStatus: (debtId: string) =>
      apiRequest<{
        notification_sent: boolean;
        notification_sent_at: number | null;
        portal_token: any | null;
      }>(`/api/v1/notifications/debt/${debtId}/status`),
  },

  // Attorney
  attorney: {
    getReviewQueue: (params?: { group?: string; sort?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return apiRequest<any>(`/api/v1/attorney/review-queue?${query}`);
    },
    getDebtorGroup: (debtorId: string, clientId: string) =>
      apiRequest<any>(`/api/v1/attorney/debtor-group/${debtorId}/${clientId}`),
    verifyRelationship: (data: {
      debtor_id: string;
      client_id: string;
      relationship_type: string;
      contract_reference?: string;
      debt_ids: string[];
      notes?: string;
    }) => apiRequest<any>('/api/v1/attorney/verify-relationship', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    rejectDebt: (debtId: string, reason: string) =>
      apiRequest<any>('/api/v1/attorney/reject-debt', {
        method: 'POST',
        body: JSON.stringify({ debt_id: debtId, reason }),
      }),
  },

  // Payment Plans
  paymentPlans: {
    list: () => apiRequest<any[]>('/api/v1/payment-plans'),
    get: (id: string) => apiRequest<any>(`/api/v1/payment-plans/${id}`),
    approve: (id: string) =>
      apiRequest<any>(`/api/v1/payment-plans/${id}/approve`, {
        method: 'PUT',
      }),
    reject: (id: string, reason: string) =>
      apiRequest<any>(`/api/v1/payment-plans/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      }),
    recordPayment: (installmentId: string, amount: number, method: string) =>
      apiRequest<any>(`/api/v1/payment-plans/installments/${installmentId}/record-payment`, {
        method: 'POST',
        body: JSON.stringify({ amount, payment_method: method }),
      }),
    accelerate: (id: string) =>
      apiRequest<any>(`/api/v1/payment-plans/${id}/accelerate`, {
        method: 'PUT',
      }),
  },

  // Communications
  communications: {
    list: (params?: { debtor_id?: string; debt_id?: string; type?: string; status?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return apiRequest<any>(`/api/v1/communications?${query}`);
    },
    get: (id: string) => apiRequest<any>(`/api/v1/communications/${id}`),
    getForDebtor: (debtorId: string, limit?: number) => {
      const query = limit ? `?limit=${limit}` : '';
      return apiRequest<any[]>(`/api/v1/communications/debtor/${debtorId}${query}`);
    },
  },

  // Integrations
  integrations: {
    ares: (ico: string) => apiRequest<{
      ico: string;
      name: string;
      vat_number?: string;
      legal_form?: string;
      street: string;
      city: string;
      postal_code: string;
      country: string;
      is_active: boolean;
      established_date?: string;
    }>(`/api/v1/integrations/ares/${ico}`),
  },
};

export default api;
