// API client for LexAI backend

const API_BASE_URL = import.meta.env.PROD
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
 * Makes authenticated API request
 * Cloudflare Access automatically injects CF-Access-JWT-Assertion header
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Important: Include cookies for Cloudflare Access
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
    list: () => apiRequest('/api/v1/clients'),
    get: (id: string) => apiRequest(`/api/v1/clients/${id}`),
    create: (data: unknown) =>
      apiRequest('/api/v1/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Debts
  debts: {
    list: () => apiRequest('/api/v1/debts'),
    get: (id: string) => apiRequest(`/api/v1/debts/${id}`),
    create: (data: unknown) =>
      apiRequest('/api/v1/debts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};

export default api;
