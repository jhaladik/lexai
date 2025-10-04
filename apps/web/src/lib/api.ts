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

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'CF-Access-JWT-Assertion': token } : {}),
      ...options.headers,
    },
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
