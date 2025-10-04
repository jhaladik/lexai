import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@lexai/shared/utils';

export function Debts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingDebt, setEditingDebt] = useState<any | null>(null);
  const [copyingDebt, setCopyingDebt] = useState<any | null>(null);
  const [debtorType, setDebtorType] = useState<'existing' | 'new'>('existing');
  const [newDebtorType, setNewDebtorType] = useState<'individual' | 'business'>('individual');
  const [debtorIcoLookup, setDebtorIcoLookup] = useState('');
  const [debtorIcoLoading, setDebtorIcoLoading] = useState(false);
  const [debtorIcoError, setDebtorIcoError] = useState<string | null>(null);
  const [bulkUploadResults, setBulkUploadResults] = useState<any | null>(null);

  const { data: debts, isLoading, error } = useQuery({
    queryKey: ['debts'],
    queryFn: () => api.debts.list(),
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.clients.list(),
  });

  const { data: debtors } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => api.debtors.list(),
  });

  const createMutation = useMutation({
    mutationFn: api.debts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      setShowAddForm(false);
      setEditingDebt(null);
      setCopyingDebt(null);
      setDebtorIcoLookup('');
      setDebtorIcoError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.debts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      setShowAddForm(false);
      setEditingDebt(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.debts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: api.debts.bulkUpload,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      setBulkUploadResults(data.results);
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: api.notifications.sendDebtNotification,
    onSuccess: (data) => {
      alert(`Notification sent to: ${data.sent_to}\n\nPortal link: ${data.portal_link}`);
      queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
    onError: (error) => {
      alert(`Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleDebtorIcoLookup = async () => {
    if (!debtorIcoLookup || debtorIcoLookup.length !== 8) {
      setDebtorIcoError('IČO must be 8 digits');
      return;
    }

    setDebtorIcoLoading(true);
    setDebtorIcoError(null);

    try {
      const data = await api.integrations.ares(debtorIcoLookup);

      // Auto-fill form fields
      const form = document.querySelector('form') as HTMLFormElement;
      if (form) {
        (form.elements.namedItem('debtor_company_name') as HTMLInputElement).value = data.name;
        (form.elements.namedItem('debtor_registration_number') as HTMLInputElement).value = data.ico;
        (form.elements.namedItem('debtor_address') as HTMLInputElement).value = data.street;
        (form.elements.namedItem('debtor_city') as HTMLInputElement).value = data.city;
        (form.elements.namedItem('debtor_postal_code') as HTMLInputElement).value = data.postal_code;
        (form.elements.namedItem('debtor_country') as HTMLSelectElement).value = data.country;
      }

      if (!data.is_active) {
        setDebtorIcoError('Warning: Company is not active in registry');
      }
    } catch (error) {
      setDebtorIcoError(error instanceof Error ? error.message : 'Failed to lookup company');
    } finally {
      setDebtorIcoLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const debtData: any = {
      debt_type: formData.get('debt_type') as string,
      reference_number: formData.get('reference_number') as string || undefined,
      original_amount: parseInt(formData.get('original_amount') as string),
      currency: formData.get('currency') as string || 'CZK',
      invoice_date: formData.get('invoice_date') as string || undefined,
      due_date: formData.get('due_date') as string || undefined,
      has_contract: formData.get('has_contract') === 'on',
      has_invoice: formData.get('has_invoice') === 'on',
      has_delivery_proof: formData.get('has_delivery_proof') === 'on',
      has_communication_log: formData.get('has_communication_log') === 'on',
      notes: formData.get('notes') as string || undefined,
    };

    if (editingDebt) {
      // Update existing debt
      updateMutation.mutate({ id: editingDebt.id, data: debtData });
    } else {
      // Create new debt
      const createData = {
        ...debtData,
        client_id: formData.get('client_id') as string,
        debtor_id: debtorType === 'existing' ? formData.get('debtor_id') as string : 'new',
      };

      // If creating new debtor, add debtor data
      if (debtorType === 'new') {
        createData.debtor = {
          type: newDebtorType,
          first_name: formData.get('debtor_first_name') as string || undefined,
          last_name: formData.get('debtor_last_name') as string || undefined,
          company_name: formData.get('debtor_company_name') as string || undefined,
          registration_number: formData.get('debtor_registration_number') as string || undefined,
          email: formData.get('debtor_email') as string || undefined,
          phone: formData.get('debtor_phone') as string || undefined,
          address: formData.get('debtor_address') as string || undefined,
          city: formData.get('debtor_city') as string || undefined,
          postal_code: formData.get('debtor_postal_code') as string || undefined,
          country: formData.get('debtor_country') as string || 'CZ',
        };
      }

      createMutation.mutate(createData);
    }
  };

  const handleEdit = (debt: any) => {
    // Only allow editing if status is draft or pending_verification
    const editableStatuses = ['draft', 'pending_verification'];
    if (!editableStatuses.includes(debt.status)) {
      alert('Cannot edit debt with active process');
      return;
    }

    setEditingDebt(debt);
    setCopyingDebt(null);
    setShowAddForm(true);
  };

  const handleCopy = (debt: any) => {
    setCopyingDebt(debt);
    setEditingDebt(null);
    setShowAddForm(true);
  };

  const handleDelete = (debt: any) => {
    // Only allow deletion if status is draft or pending_verification
    const deletableStatuses = ['draft', 'pending_verification'];
    if (!deletableStatuses.includes(debt.status)) {
      alert('Cannot delete debt with active process');
      return;
    }

    const debtorName = debt.debtor_type === 'business'
      ? debt.debtor_company
      : `${debt.debtor_first_name} ${debt.debtor_last_name}`;

    if (window.confirm(t('debts.confirmDelete', `Are you sure you want to delete debt for ${debtorName}?`))) {
      deleteMutation.mutate(debt.id);
    }
  };

  const handleCancelEdit = () => {
    setEditingDebt(null);
    setCopyingDebt(null);
    setShowAddForm(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvContent = event.target?.result as string;
      bulkUploadMutation.mutate(csvContent);
    };
    reader.readAsText(file);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error loading debts</h3>
        <p className="text-red-600 text-sm mt-1">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('debts.title', 'Debts')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowBulkUpload(!showBulkUpload);
              setShowAddForm(false);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            {t('debts.bulkUpload', 'Bulk Upload')}
          </button>
          <button
            onClick={() => {
              setEditingDebt(null);
              setCopyingDebt(null);
              setShowAddForm(!showAddForm);
              setShowBulkUpload(false);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {showAddForm ? t('common.cancel', 'Cancel') : t('debts.addDebt', 'Add Debt')}
          </button>
        </div>
      </div>

      {showBulkUpload && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">{t('debts.bulkUpload', 'Bulk Upload Debts')}</h2>

          <div className="mb-4">
            <button
              onClick={() => api.debts.downloadTemplate()}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              {t('debts.downloadTemplate', 'Download CSV Template')}
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              {t('debts.selectCSV', 'Select CSV File')}
            </label>
            <p className="text-sm text-gray-500 mt-2">
              {t('debts.maxRows', 'Maximum 500 rows per upload')}
            </p>
          </div>

          {bulkUploadMutation.isPending && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-700">{t('debts.uploading', 'Uploading and processing...')}</p>
            </div>
          )}

          {bulkUploadMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-red-800 font-semibold">{t('common.error', 'Error')}</h3>
              <p className="text-red-600 text-sm mt-1">
                {bulkUploadMutation.error instanceof Error ? bulkUploadMutation.error.message : 'Upload failed'}
              </p>
            </div>
          )}

          {bulkUploadResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-green-800 font-semibold mb-2">{t('debts.uploadComplete', 'Upload Complete')}</h3>
              <div className="text-sm space-y-1">
                <p>Total: {bulkUploadResults.total}</p>
                <p className="text-green-700">✓ Successful: {bulkUploadResults.successful}</p>
                {bulkUploadResults.flagged > 0 && (
                  <p className="text-yellow-700">⚠ Flagged for review: {bulkUploadResults.flagged}</p>
                )}
                {bulkUploadResults.failed > 0 && (
                  <p className="text-red-700">✗ Failed: {bulkUploadResults.failed}</p>
                )}
              </div>

              {bulkUploadResults.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">{t('debts.errors', 'Errors')}:</h4>
                  <div className="max-h-40 overflow-y-auto text-sm space-y-1">
                    {bulkUploadResults.errors.map((err: any, idx: number) => (
                      <p key={idx} className="text-red-600">
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setBulkUploadResults(null);
                  setShowBulkUpload(false);
                }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 underline"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingDebt ? t('debts.editDebt', 'Edit Debt') :
             copyingDebt ? t('debts.copyDebt', 'Copy Debt') :
             t('debts.addDebt', 'Add Debt')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection - Hidden when editing, shown when creating/copying */}
            {!editingDebt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('debts.client', 'Client')} *
                </label>
                <select
                  name="client_id"
                  required
                  defaultValue={copyingDebt?.client_id || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('debts.selectClient', 'Select Client')}</option>
                  {clients?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Debtor Selection - Hidden when editing */}
            {!editingDebt && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-3">{t('debts.debtorInfo', 'Debtor Information')}</h3>

              <div className="mb-4">
                <label className="inline-flex items-center mr-6">
                  <input
                    type="radio"
                    checked={debtorType === 'existing'}
                    onChange={() => setDebtorType('existing')}
                    className="mr-2"
                  />
                  {t('debts.existingDebtor', 'Existing Debtor')}
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={debtorType === 'new'}
                    onChange={() => setDebtorType('new')}
                    className="mr-2"
                  />
                  {t('debts.newDebtor', 'New Debtor')}
                </label>
              </div>

              {debtorType === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debts.selectDebtor', 'Select Debtor')} *
                  </label>
                  <select
                    name="debtor_id"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('debts.selectDebtor', 'Select Debtor')}</option>
                    {debtors?.map((debtor) => (
                      <option key={debtor.id} value={debtor.id}>
                        {debtor.type === 'business' ? debtor.company_name : `${debtor.first_name} ${debtor.last_name}`}
                        {debtor.city && ` - ${debtor.city}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="inline-flex items-center mr-6">
                      <input
                        type="radio"
                        checked={newDebtorType === 'individual'}
                        onChange={() => setNewDebtorType('individual')}
                        className="mr-2"
                      />
                      {t('debts.individual', 'Individual')}
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={newDebtorType === 'business'}
                        onChange={() => setNewDebtorType('business')}
                        className="mr-2"
                      />
                      {t('debts.business', 'Business')}
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {newDebtorType === 'individual' ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('debts.firstName', 'First Name')} *
                          </label>
                          <input
                            type="text"
                            name="debtor_first_name"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('debts.lastName', 'Last Name')} *
                          </label>
                          <input
                            type="text"
                            name="debtor_last_name"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-2 mb-4">
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">
                              {t('debts.aresLookup', 'Quick Lookup by IČO')}
                            </h4>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={debtorIcoLookup}
                                onChange={(e) => setDebtorIcoLookup(e.target.value)}
                                placeholder="12345678"
                                maxLength={8}
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={handleDebtorIcoLookup}
                                disabled={debtorIcoLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                {debtorIcoLoading ? t('common.loading', 'Loading...') : t('debts.lookup', 'Lookup')}
                              </button>
                            </div>
                            {debtorIcoError && (
                              <p className={`mt-2 text-sm ${debtorIcoError.startsWith('Warning') ? 'text-yellow-600' : 'text-red-600'}`}>
                                {debtorIcoError}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('debts.companyName', 'Company Name')} *
                          </label>
                          <input
                            type="text"
                            name="debtor_company_name"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('debts.registrationNumber', 'IČO')}
                          </label>
                          <input
                            type="text"
                            name="debtor_registration_number"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('debts.email', 'Email')}
                      </label>
                      <input
                        type="email"
                        name="debtor_email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('debts.phone', 'Phone')}
                      </label>
                      <input
                        type="tel"
                        name="debtor_phone"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('debts.address', 'Address')}
                      </label>
                      <input
                        type="text"
                        name="debtor_address"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('debts.city', 'City')}
                      </label>
                      <input
                        type="text"
                        name="debtor_city"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('debts.postalCode', 'Postal Code')}
                      </label>
                      <input
                        type="text"
                        name="debtor_postal_code"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('debts.country', 'Country')}
                      </label>
                      <select
                        name="debtor_country"
                        defaultValue="CZ"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="CZ">Czech Republic</option>
                        <option value="SK">Slovakia</option>
                        <option value="DE">Germany</option>
                        <option value="AT">Austria</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}

            {/* Debt Details */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">{t('debts.debtDetails', 'Debt Details')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debts.debtType', 'Debt Type')} *
                  </label>
                  <select
                    name="debt_type"
                    required
                    defaultValue={(editingDebt || copyingDebt)?.debt_type || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Type</option>
                    <option value="invoice">Invoice / Faktura</option>
                    <option value="lease">Lease / Nájem</option>
                    <option value="rental">Rental / Pronájem</option>
                    <option value="service">Service / Služba</option>
                    <option value="damage">Damage / Škoda</option>
                    <option value="other">Other / Jiné</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debts.referenceNumber', 'Reference Number')}
                  </label>
                  <input
                    type="text"
                    name="reference_number"
                    defaultValue={(editingDebt || copyingDebt)?.reference_number || ''}
                    placeholder="Invoice #, Contract #, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debts.amount', 'Amount')} *
                  </label>
                  <input
                    type="number"
                    name="original_amount"
                    required
                    min="0"
                    step="0.01"
                    defaultValue={(editingDebt || copyingDebt)?.original_amount || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debts.currency', 'Currency')}
                  </label>
                  <select
                    name="currency"
                    defaultValue={(editingDebt || copyingDebt)?.currency || 'CZK'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="CZK">CZK</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debts.invoiceDate', 'Invoice Date')}
                  </label>
                  <input
                    type="date"
                    name="invoice_date"
                    defaultValue={(editingDebt || copyingDebt)?.invoice_date ? new Date((editingDebt || copyingDebt).invoice_date).toISOString().split('T')[0] : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('debts.dueDate', 'Due Date')}
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={(editingDebt || copyingDebt)?.due_date ? new Date((editingDebt || copyingDebt).due_date).toISOString().split('T')[0] : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('debts.notes', 'Notes')}
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={(editingDebt || copyingDebt)?.notes || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional information about the debt..."
                />
              </div>
            </div>

            {/* Supporting Documents */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium mb-3">{t('debts.supportingDocuments', 'Supporting Documents')}</h3>
              <p className="text-sm text-gray-600 mb-3">
                {t('debts.documentsNote', 'Check which documents you have for this debt (minimum 1 required)')}
              </p>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="has_contract"
                    className="mr-2"
                    defaultChecked={(editingDebt || copyingDebt)?.has_contract || false}
                  />
                  <span className="text-sm">{t('debts.hasContract', 'Contract / Lease Agreement')}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="has_invoice"
                    className="mr-2"
                    defaultChecked={(editingDebt || copyingDebt)?.has_invoice || false}
                  />
                  <span className="text-sm">{t('debts.hasInvoice', 'Invoice')}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="has_delivery_proof"
                    className="mr-2"
                    defaultChecked={(editingDebt || copyingDebt)?.has_delivery_proof || false}
                  />
                  <span className="text-sm">{t('debts.hasDeliveryProof', 'Delivery Proof')}</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="has_communication_log"
                    className="mr-2"
                    defaultChecked={(editingDebt || copyingDebt)?.has_communication_log || false}
                  />
                  <span className="text-sm">{t('debts.hasCommunicationLog', 'Communication Log')}</span>
                </label>
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

            {createMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">
                  {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create debt'}
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
                  {t('debts.reference', 'Reference')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('debts.client', 'Client')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('debts.debtor', 'Debtor')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('debts.type', 'Type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('debts.amount', 'Amount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('debts.status', 'Status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {debts && debts.length > 0 ? (
                debts.map((debt) => {
                  const canEdit = ['draft', 'pending_verification'].includes(debt.status);
                  return (
                    <tr key={debt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{debt.reference_number || debt.id.slice(0, 12)}</div>
                        <div className="text-sm text-gray-500">{debt.debt_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {debt.client_company}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {debt.debtor_type === 'business' ? debt.debtor_company : `${debt.debtor_first_name} ${debt.debtor_last_name}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {debt.debt_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(debt.original_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          debt.status === 'verified' ? 'bg-green-100 text-green-800' :
                          debt.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {debt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        {debt.status === 'verified' && !debt.notification_sent && (
                          <button
                            onClick={() => {
                              if (confirm(`Send notification to debtor?`)) {
                                sendNotificationMutation.mutate(debt.id);
                              }
                            }}
                            disabled={sendNotificationMutation.isPending}
                            className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                          >
                            {t('debts.notify', 'Notify')}
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(debt)}
                          className="text-green-600 hover:text-green-900"
                        >
                          {t('common.copy', 'Copy')}
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleEdit(debt)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              {t('common.edit', 'Edit')}
                            </button>
                            <button
                              onClick={() => handleDelete(debt)}
                              disabled={deleteMutation.isPending}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              {t('common.delete', 'Delete')}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    {t('debts.noDebts', 'No debts yet. Add your first debt to get started.')}
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
