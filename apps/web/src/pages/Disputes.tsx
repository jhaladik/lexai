import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function Disputes() {
  const queryClient = useQueryClient();
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: disputes, isLoading } = useQuery({
    queryKey: ['disputes', statusFilter],
    queryFn: () => api.disputes.list({ status: statusFilter }),
  });

  const { data: disputeDetail } = useQuery({
    queryKey: ['dispute', selectedDispute?.id],
    queryFn: () => api.disputes.get(selectedDispute!.id),
    enabled: !!selectedDispute,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.disputes.resolve(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['dispute', selectedDispute?.id] });
      setSelectedDispute(null);
      alert('Dispute resolved successfully!');
    },
  });

  const [outcome, setOutcome] = useState<'upheld' | 'rejected' | 'partial'>('rejected');
  const [resolution, setResolution] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [debtStatus, setDebtStatus] = useState('verified');

  const handleResolve = () => {
    if (!resolution || resolution.length < 50) {
      alert('Resolution explanation must be at least 50 characters');
      return;
    }

    resolveMutation.mutate({
      id: selectedDispute.id,
      data: {
        outcome,
        resolution,
        new_amount: outcome === 'partial' && newAmount ? parseInt(newAmount) * 100 : undefined,
        debt_status: debtStatus,
      },
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-orange-100 text-orange-800',
      under_review: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDisputeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      amount_incorrect: 'Částka je nesprávná',
      never_received: 'Nikdy nedostal zboží/služby',
      quality_issue: 'Problémy s kvalitou',
      already_paid: 'Již zaplaceno',
      contract_dispute: 'Spor ohledně smlouvy',
      fraud_claim: 'Podezření na podvod',
      other: 'Jiný důvod',
    };
    return labels[type] || type;
  };

  if (selectedDispute && disputeDetail) {
    return (
      <div className="p-6">
        <button
          onClick={() => setSelectedDispute(null)}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Disputes List
        </button>

        <div className="grid grid-cols-3 gap-6">
          {/* Dispute Info */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border border-orange-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    ⚠️ Dispute #{disputeDetail.id.slice(-8)}
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(disputeDetail.status)}`}>
                      {disputeDetail.status}
                    </span>
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {new Date(disputeDetail.created_at).toLocaleString('cs-CZ')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <p className="text-sm text-gray-600">Debtor</p>
                  <p className="font-semibold">
                    {disputeDetail.debtor_type === 'business'
                      ? disputeDetail.debtor_company
                      : `${disputeDetail.debtor_first_name} ${disputeDetail.debtor_last_name}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Debt Reference</p>
                  <p className="font-semibold">{disputeDetail.debt_reference}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Original Amount</p>
                  <p className="font-semibold text-red-600">
                    {(disputeDetail.debt_amount / 100).toLocaleString()} {disputeDetail.currency}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dispute Type</p>
                  <p className="font-semibold">{getDisputeTypeLabel(disputeDetail.dispute_type)}</p>
                </div>
              </div>

              <div className="mt-6 bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <h3 className="font-bold text-gray-900 mb-2">Debtor's Description:</h3>
                <p className="text-gray-800 whitespace-pre-wrap">{disputeDetail.description}</p>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Supporting Documents</h2>
              {disputeDetail.documents && disputeDetail.documents.length > 0 ? (
                <div className="space-y-2">
                  {disputeDetail.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="font-medium">{doc.filename}</p>
                          <p className="text-xs text-gray-500">{doc.type} • {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                        View
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No documents uploaded</p>
              )}
            </div>

            {/* Communications */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Communication History</h2>
              {disputeDetail.communications && disputeDetail.communications.length > 0 ? (
                <div className="space-y-3">
                  {disputeDetail.communications.slice(0, 5).map((comm: any) => (
                    <div key={comm.id} className="p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{comm.subject}</p>
                          <p className="text-sm text-gray-600 mt-1">{comm.content}</p>
                        </div>
                        <span className="text-xs text-gray-500">{new Date(comm.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No communications yet</p>
              )}
            </div>
          </div>

          {/* Resolution Form */}
          <div className="col-span-1">
            {disputeDetail.status === 'open' || disputeDetail.status === 'under_review' ? (
              <div className="bg-white p-6 rounded-lg shadow sticky top-6">
                <h2 className="text-xl font-bold mb-4">Resolve Dispute</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Decision</label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="upheld">✓ Uphold (Cancel Debt)</option>
                      <option value="rejected">✗ Reject (Resume Collection)</option>
                      <option value="partial">⚖️ Partial (Adjust Amount)</option>
                    </select>
                  </div>

                  {outcome === 'partial' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Amount (CZK)</label>
                      <input
                        type="number"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder={`Current: ${(disputeDetail.debt_amount / 100).toLocaleString()}`}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {(outcome === 'rejected' || outcome === 'partial') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Debt Status</label>
                      <select
                        value={debtStatus}
                        onChange={(e) => setDebtStatus(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="verified">Verified (Resume)</option>
                        <option value="initial_letter_sent">Send Initial Letter</option>
                        <option value="attorney_review">Attorney Review</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Explanation * (min. 50 chars)
                    </label>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      rows={8}
                      minLength={50}
                      placeholder="Provide detailed explanation of your decision. This will be sent to both the debtor and client."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{resolution.length} / 50 characters</p>
                  </div>

                  <button
                    onClick={handleResolve}
                    disabled={resolveMutation.isPending || resolution.length < 50}
                    className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 font-semibold"
                  >
                    {resolveMutation.isPending ? 'Resolving...' : 'Submit Decision'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Resolution</h2>
                <div className={`p-4 rounded-lg border-2 ${
                  disputeDetail.status === 'resolved' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                }`}>
                  <p className="font-semibold mb-2">
                    {disputeDetail.status === 'resolved' ? '✓ Upheld' : '✗ Rejected'}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{disputeDetail.resolution}</p>
                  <p className="text-xs text-gray-500 mt-3">
                    Resolved by: {disputeDetail.resolved_by_first_name} {disputeDetail.resolved_by_last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(disputeDetail.resolved_at).toLocaleString('cs-CZ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Disputes Management</h1>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Disputes List */}
      {isLoading ? (
        <div className="text-center py-8">Loading disputes...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Debtor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {disputes && disputes.length > 0 ? (
                disputes.map((dispute: any) => (
                  <tr key={dispute.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {dispute.debtor_type === 'business'
                          ? dispute.debtor_company
                          : `${dispute.debtor_first_name} ${dispute.debtor_last_name}`}
                      </div>
                      <div className="text-sm text-gray-500">{dispute.debtor_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{dispute.debt_reference}</td>
                    <td className="px-6 py-4 text-sm">{getDisputeTypeLabel(dispute.dispute_type)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {(dispute.debt_amount / 100).toLocaleString()} {dispute.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(dispute.status)}`}>
                        {dispute.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedDispute(dispute)}
                        className="text-orange-600 hover:text-orange-900"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No disputes found
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
