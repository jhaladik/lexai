import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@lexai/shared/utils';

type Client = {
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
};

export function Clients() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [icoLookup, setIcoLookup] = useState('');
  const [icoLoading, setIcoLoading] = useState(false);
  const [icoError, setIcoError] = useState<string | null>(null);

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.clients.list(),
  });

  const createMutation = useMutation({
    mutationFn: api.clients.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowAddForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.clients.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditingClient(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.clients.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      company_name: formData.get('company_name') as string,
      email: formData.get('email') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      registration_number: formData.get('registration_number') as string || undefined,
      vat_number: formData.get('vat_number') as string || undefined,
      address: formData.get('address') as string || undefined,
      city: formData.get('city') as string || undefined,
      postal_code: formData.get('postal_code') as string || undefined,
      country: formData.get('country') as string || undefined,
      industry: formData.get('industry') as string || undefined,
    };

    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (client: Client) => {
    if (window.confirm(t('clients.confirmDelete', `Are you sure you want to delete ${client.company_name}?`))) {
      deleteMutation.mutate(client.id);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setShowAddForm(false);
    setIcoLookup('');
    setIcoError(null);
  };

  const handleIcoLookup = async () => {
    if (!icoLookup || icoLookup.length !== 8) {
      setIcoError('IČO must be 8 digits');
      return;
    }

    setIcoLoading(true);
    setIcoError(null);

    try {
      const data = await api.integrations.ares(icoLookup);

      // Auto-fill form fields
      const form = document.querySelector('form') as HTMLFormElement;
      if (form) {
        (form.elements.namedItem('company_name') as HTMLInputElement).value = data.name;
        (form.elements.namedItem('registration_number') as HTMLInputElement).value = data.ico;
        (form.elements.namedItem('vat_number') as HTMLInputElement).value = data.vat_number || '';
        (form.elements.namedItem('address') as HTMLInputElement).value = data.street;
        (form.elements.namedItem('city') as HTMLInputElement).value = data.city;
        (form.elements.namedItem('postal_code') as HTMLInputElement).value = data.postal_code;
        (form.elements.namedItem('country') as HTMLSelectElement).value = data.country;
      }

      if (!data.is_active) {
        setIcoError('Warning: Company is not active in registry');
      }
    } catch (error) {
      setIcoError(error instanceof Error ? error.message : 'Failed to lookup company');
    } finally {
      setIcoLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error loading clients</h3>
        <p className="text-red-600 text-sm mt-1">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('clients.title', 'Clients')}</h1>
        <button
          onClick={() => {
            setEditingClient(null);
            setShowAddForm(!showAddForm);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showAddForm ? t('common.cancel', 'Cancel') : t('clients.addClient', 'Add Client')}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingClient ? t('clients.editClient', 'Edit Client') : t('clients.addClient', 'Add Client')}
          </h2>

          {!editingClient && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                {t('clients.aresLookup', 'Quick Lookup by IČO')}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={icoLookup}
                  onChange={(e) => setIcoLookup(e.target.value)}
                  placeholder="12345678"
                  maxLength={8}
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleIcoLookup}
                  disabled={icoLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {icoLoading ? t('common.loading', 'Loading...') : t('clients.lookup', 'Lookup')}
                </button>
              </div>
              {icoError && (
                <p className={`mt-2 text-sm ${icoError.startsWith('Warning') ? 'text-yellow-600' : 'text-red-600'}`}>
                  {icoError}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.companyName', 'Company Name')} *
                </label>
                <input
                  type="text"
                  name="company_name"
                  defaultValue={editingClient?.company_name}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.email', 'Email')} *
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingClient?.email}
                  required
                  disabled={!!editingClient}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.firstName', 'First Name')} *
                </label>
                <input
                  type="text"
                  name="first_name"
                  defaultValue={editingClient?.first_name}
                  required
                  disabled={!!editingClient}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.lastName', 'Last Name')} *
                </label>
                <input
                  type="text"
                  name="last_name"
                  defaultValue={editingClient?.last_name}
                  required
                  disabled={!!editingClient}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.registrationNumber', 'IČO')}
                </label>
                <input
                  type="text"
                  name="registration_number"
                  defaultValue={editingClient?.registration_number || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.vatNumber', 'DIČ')}
                </label>
                <input
                  type="text"
                  name="vat_number"
                  defaultValue={editingClient?.vat_number || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.address', 'Address')}
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={editingClient?.address || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.city', 'City')}
                </label>
                <input
                  type="text"
                  name="city"
                  defaultValue={editingClient?.city || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.postalCode', 'Postal Code')}
                </label>
                <input
                  type="text"
                  name="postal_code"
                  defaultValue={editingClient?.postal_code || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.country', 'Country')}
                </label>
                <select
                  name="country"
                  defaultValue={editingClient?.country || 'CZ'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="CZ">Czech Republic</option>
                  <option value="SK">Slovakia</option>
                  <option value="DE">Germany</option>
                  <option value="AT">Austria</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('clients.industry', 'Industry')}
                </label>
                <input
                  type="text"
                  name="industry"
                  defaultValue={editingClient?.industry || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">
                  {createMutation.error instanceof Error ? createMutation.error.message :
                   updateMutation.error instanceof Error ? updateMutation.error.message :
                   'Failed to save client'}
                </p>
              </div>
            )}
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('common.loading', 'Loading...')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.company', 'Company')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.contact', 'Contact')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.registrationNumber', 'IČO')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.status', 'Status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.debts', 'Debts')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('clients.totalValue', 'Total Value')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients && clients.length > 0 ? (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{client.company_name}</div>
                      <div className="text-sm text-gray-500">{client.city}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{client.first_name} {client.last_name}</div>
                      <div className="text-sm text-gray-500">{client.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.registration_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        client.verification_status === 'verified' ? 'bg-green-100 text-green-800' :
                        client.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {client.verification_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.total_debts || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(client.total_debt_value || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {t('common.edit', 'Edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    {t('clients.noClients', 'No clients yet. Add your first client to get started.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
