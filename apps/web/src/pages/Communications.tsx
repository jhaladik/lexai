import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

interface Communication {
  id: string;
  debt_id: string;
  type: string;
  direction: string;
  subject: string;
  content: string;
  to_email: string;
  status: string;
  created_at: number;
  sent_at: number | null;
  debt_reference: string;
  debtor_type: string;
  debtor_first_name: string | null;
  debtor_last_name: string | null;
  debtor_company: string | null;
  debtor_email: string;
  client_company: string;
}

export function Communications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComm, setSelectedComm] = useState<Communication | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  useEffect(() => {
    loadCommunications();
  }, [typeFilter, statusFilter, pagination.offset]);

  const loadCommunications = async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: pagination.limit,
        offset: pagination.offset,
      };

      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      // Check if filtering by debtor from URL params
      const debtorId = searchParams.get('debtor_id');
      if (debtorId) params.debtor_id = debtorId;

      const result = await api.communications.list(params);
      setCommunications(result.communications);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error loading communications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDebtorName = (comm: Communication) => {
    return comm.debtor_type === 'business'
      ? comm.debtor_company
      : `${comm.debtor_first_name} ${comm.debtor_last_name}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return '📧';
      case 'sms': return '💬';
      case 'portal_message': return '🔔';
      default: return '📄';
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      sent: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const handlePreview = (comm: Communication) => {
    setSelectedComm(comm);
    setShowPreview(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="text-gray-600">All email and message communications</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="portal_message">Portal Message</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setTypeFilter('');
                setStatusFilter('');
                searchParams.delete('debtor_id');
                setSearchParams(searchParams);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Communications Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Debtor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {communications.map((comm) => (
              <tr key={comm.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-2xl">{getTypeIcon(comm.type)}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{comm.subject}</div>
                  <div className="text-sm text-gray-500">{comm.debt_reference}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{getDebtorName(comm)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{comm.to_email || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(comm.status)}`}>
                    {comm.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(comm.created_at).toLocaleString('cs-CZ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handlePreview(comm)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {communications.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No communications found</p>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
                disabled={pagination.offset === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedComm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedComm.subject}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    To: {selectedComm.to_email} • {new Date(selectedComm.created_at).toLocaleString('cs-CZ')}
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(selectedComm.status)}`}>
                  {selectedComm.status}
                </span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm text-gray-800">{selectedComm.content}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
