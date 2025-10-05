import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function Debtors() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDebtor, setSelectedDebtor] = useState<any | null>(null);
  const [editingDebtor, setEditingDebtor] = useState<any | null>(null);

  const { data: debtors, isLoading, error } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => api.debtors.list(),
  });

  const { data: debtorDetails } = useQuery({
    queryKey: ['debtor', selectedDebtor?.id],
    queryFn: () => api.debtors.get(selectedDebtor!.id),
    enabled: !!selectedDebtor,
  });

  const { data: debts } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api.debts.list(),
  });

  const { data: communications } = useQuery({
    queryKey: ['communications', selectedDebtor?.id],
    queryFn: () => api.communications.getForDebtor(selectedDebtor!.id, 5),
    enabled: !!selectedDebtor,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.debtors.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['debtor', editingDebtor?.id] });
      setEditingDebtor(null);
    },
  });

  const sendBulkNotificationMutation = useMutation({
    mutationFn: api.debtors.sendBulkNotification,
    onSuccess: (data) => {
      alert(`Notification sent for ${data.debt_count} debt(s) to: ${data.sent_to}\n\nPortal link: ${data.portal_link}`);
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
    onError: (error) => {
      alert(`Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const debtorData: any = {};

    if (editingDebtor.type === 'business') {
      debtorData.company_name = formData.get('company_name');
      debtorData.registration_number = formData.get('registration_number');
    } else {
      debtorData.first_name = formData.get('first_name');
      debtorData.last_name = formData.get('last_name');
    }

    debtorData.email = formData.get('email');
    debtorData.phone = formData.get('phone');
    debtorData.address = formData.get('address');
    debtorData.city = formData.get('city');
    debtorData.postal_code = formData.get('postal_code');
    debtorData.country = formData.get('country');

    updateMutation.mutate({ id: editingDebtor.id, data: debtorData });
  };

  // Get debts for selected debtor
  const debtorDebts = debts?.filter((debt: any) => debt.debtor_id === selectedDebtor?.id) || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending_verification: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-blue-100 text-blue-800',
      initial_letter_sent: 'bg-purple-100 text-purple-800',
      attorney_review: 'bg-orange-100 text-orange-800',
      attorney_letter_sent: 'bg-red-100 text-red-800',
      in_mediation: 'bg-indigo-100 text-indigo-800',
      payment_plan_active: 'bg-cyan-100 text-cyan-800',
      payment_plan_defaulted: 'bg-red-100 text-red-800',
      resolved_paid: 'bg-green-100 text-green-800',
      resolved_partial: 'bg-green-100 text-green-800',
      written_off: 'bg-gray-100 text-gray-800',
      litigation: 'bg-red-100 text-red-800',
      disputed: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error loading debtors</h3>
        <p className="text-red-600 text-sm mt-1">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  if (selectedDebtor) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => {
              setSelectedDebtor(null);
              setEditingDebtor(null);
            }}
            className="text-blue-600 hover:text-blue-700 mb-4"
          >
            ← {t('common.back', 'Back to Debtors List')}
          </button>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">
                {debtorDetails?.type === 'business'
                  ? debtorDetails?.company_name
                  : `${debtorDetails?.first_name} ${debtorDetails?.last_name}`}
              </h1>
              <p className="text-gray-600 mt-1">
                {debtorDetails?.type === 'business' ? t('debtors.business', 'Business') : t('debtors.individual', 'Individual')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (confirm(`Send notification for all verified debts to ${debtorDetails?.email}?`)) {
                    sendBulkNotificationMutation.mutate(debtorDetails.id);
                  }
                }}
                disabled={sendBulkNotificationMutation.isPending || !debtorDetails?.email}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {t('debtors.notifyAll', 'Send Notification')}
              </button>
              <button
                onClick={() => setEditingDebtor(debtorDetails)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {t('debtors.edit', 'Edit Debtor')}
              </button>
            </div>
          </div>
        </div>

        {editingDebtor && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">{t('debtors.editDebtor', 'Edit Debtor')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editingDebtor.type === 'business' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('debtors.companyName', 'Company Name')} *
                    </label>
                    <input
                      type="text"
                      name="company_name"
                      defaultValue={editingDebtor.company_name}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('debtors.registrationNumber', 'IČO')}
                    </label>
                    <input
                      type="text"
                      name="registration_number"
                      defaultValue={editingDebtor.registration_number}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('debtors.firstName', 'First Name')} *
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      defaultValue={editingDebtor.first_name}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('debtors.lastName', 'Last Name')} *
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      defaultValue={editingDebtor.last_name}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('debtors.email', 'Email')}
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingDebtor.email}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('debtors.phone', 'Phone')}
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingDebtor.phone}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('debtors.address', 'Address')}
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={editingDebtor.address}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debtors.city', 'City')}
                  </label>
                  <input
                    type="text"
                    name="city"
                    defaultValue={editingDebtor.city}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debtors.postalCode', 'Postal Code')}
                  </label>
                  <input
                    type="text"
                    name="postal_code"
                    defaultValue={editingDebtor.postal_code}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('debtors.country', 'Country')}
                </label>
                <select
                  name="country"
                  defaultValue={editingDebtor.country}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="CZ">Czech Republic</option>
                  <option value="SK">Slovakia</option>
                  <option value="PL">Poland</option>
                  <option value="DE">Germany</option>
                  <option value="AT">Austria</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDebtor(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">{t('debtors.contactInfo', 'Contact Information')}</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('debtors.email', 'Email')}</p>
              <p className="font-medium">{debtorDetails?.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('debtors.phone', 'Phone')}</p>
              <p className="font-medium">{debtorDetails?.phone || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">{t('debtors.address', 'Address')}</p>
              <p className="font-medium">
                {debtorDetails?.address && debtorDetails?.city
                  ? `${debtorDetails.address}, ${debtorDetails.postal_code} ${debtorDetails.city}, ${debtorDetails.country}`
                  : '-'}
              </p>
            </div>
            {debtorDetails?.type === 'business' && debtorDetails?.registration_number && (
              <div>
                <p className="text-sm text-gray-600">{t('debtors.registrationNumber', 'IČO')}</p>
                <p className="font-medium">{debtorDetails.registration_number}</p>
              </div>
            )}
          </div>
        </div>

        {/* Communications Timeline */}
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recent Communications</h2>
            <a
              href={`/communications?debtor_id=${selectedDebtor.id}`}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All →
            </a>
          </div>

          {communications && communications.length > 0 ? (
            <div className="p-6">
              <div className="space-y-4">
                {communications.map((comm: any) => (
                  <div key={comm.id} className="flex gap-4 items-start">
                    <div className="text-2xl">
                      {comm.type === 'email' ? '📧' : comm.type === 'sms' ? '💬' : '🔔'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{comm.subject}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {comm.debt_reference} • {comm.to_email}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          comm.status === 'sent' ? 'bg-green-100 text-green-800' :
                          comm.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {comm.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(comm.created_at).toLocaleString('cs-CZ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No communications sent yet
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">{t('debtors.debts', 'Debts')} ({debtorDebts.length})</h2>
          </div>

          {debtorDebts.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {t('debtors.noDebts', 'No debts found for this debtor')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('debts.reference', 'Reference')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('debts.type', 'Type')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('debts.amount', 'Amount')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('debts.status', 'Status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('debts.dueDate', 'Due Date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t('debts.client', 'Client')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {debtorDebts.map((debt: any) => (
                    <tr key={debt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {debt.reference_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {debt.debt_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {debt.original_amount.toLocaleString()} {debt.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(debt.status)}`}>
                          {debt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(debt.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {debt.client_company}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('debtors.title', 'Debtors')}</h1>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('debtors.name', 'Name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('debtors.type', 'Type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('debtors.email', 'Email')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('debtors.phone', 'Phone')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('debtors.city', 'City')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('debtors.ico', 'IČO')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {debtors?.map((debtor: any) => (
                <tr
                  key={debtor.id}
                  onClick={() => setSelectedDebtor(debtor)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {debtor.type === 'business'
                        ? debtor.company_name
                        : `${debtor.first_name} ${debtor.last_name}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {debtor.type === 'business' ? t('debtors.business', 'Business') : t('debtors.individual', 'Individual')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {debtor.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {debtor.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {debtor.city || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {debtor.registration_number || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
