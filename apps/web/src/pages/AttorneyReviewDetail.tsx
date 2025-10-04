import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Debt {
  id: string;
  reference_number: string;
  debt_type: string;
  original_amount: number;
  current_amount: number;
  currency: string;
  invoice_date: number;
  due_date: number;
  status: string;
  fraud_score: number;
  created_at: number;
  notes: string;
}

interface Relationship {
  id: string | null;
  verified: boolean;
  verified_at: number | null;
  relationship_type: string | null;
  contract_reference: string | null;
  trust_level: string;
}

export function AttorneyReviewDetail() {
  const { debtorId, clientId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [debtorName, setDebtorName] = useState('');
  const [clientName, setClientName] = useState('');
  const [selectedDebts, setSelectedDebts] = useState<Set<string>>(new Set());
  const [relationshipType, setRelationshipType] = useState('contract');
  const [contractReference, setContractReference] = useState('');
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadDebtorGroup();
  }, [debtorId, clientId]);

  const loadDebtorGroup = async () => {
    if (!debtorId || !clientId) return;

    setLoading(true);
    try {
      const response = await api.attorney.getDebtorGroup(debtorId, clientId);
      setRelationship(response.relationship);
      setDebts(response.debts);

      if (response.debts.length > 0) {
        const debt = response.debts[0];
        setDebtorName(debt.debtor_type === 'business' ? debt.debtor_company : `${debt.debtor_first_name} ${debt.debtor_last_name}`);
        setClientName(debt.client_company);

        // Auto-select pending debts
        const pendingIds = response.debts
          .filter((d: any) => d.status === 'pending_verification')
          .map((d: any) => d.id);
        setSelectedDebts(new Set(pendingIds));
      }
    } catch (error) {
      console.error('Error loading debtor group:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDebtSelection = (debtId: string) => {
    const newSelected = new Set(selectedDebts);
    if (newSelected.has(debtId)) {
      newSelected.delete(debtId);
    } else {
      newSelected.add(debtId);
    }
    setSelectedDebts(newSelected);
  };

  const handleVerifyRelationship = async () => {
    if (!debtorId || !clientId || selectedDebts.size === 0) return;

    setProcessing(true);
    try {
      await api.attorney.verifyRelationship({
        debtor_id: debtorId,
        client_id: clientId,
        relationship_type: relationshipType,
        contract_reference: contractReference || undefined,
        debt_ids: Array.from(selectedDebts),
        notes: notes || undefined,
      });

      navigate('/attorney/review');
    } catch (error) {
      console.error('Error verifying relationship:', error);
      alert('Failed to verify relationship');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectDebt = async (debtId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await api.attorney.rejectDebt(debtId, reason);
      await loadDebtorGroup();
    } catch (error) {
      console.error('Error rejecting debt:', error);
      alert('Failed to reject debt');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalAmount = debts
    .filter(d => selectedDebts.has(d.id))
    .reduce((sum, d) => sum + d.current_amount, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/attorney/review')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Back to Review Queue
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Review Relationship</h1>
        <p className="text-gray-600">
          <strong>{debtorName}</strong> vs. <strong>{clientName}</strong>
        </p>
      </div>

      {relationship?.verified && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-900">✓ Relationship Verified</h3>
          <p className="text-sm text-green-700 mt-1">
            This relationship was verified on {new Date(relationship.verified_at!).toLocaleDateString('cs-CZ')}
          </p>
        </div>
      )}

      {/* Debts List */}
      <div className="bg-white border border-gray-200 rounded-lg mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Debts ({debts.length})</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {debts.map((debt) => (
            <div key={debt.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start gap-4">
                {debt.status === 'pending_verification' && (
                  <input
                    type="checkbox"
                    checked={selectedDebts.has(debt.id)}
                    onChange={() => toggleDebtSelection(debt.id)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {debt.reference_number || debt.id}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {debt.debt_type} • Created {new Date(debt.created_at).toLocaleDateString('cs-CZ')}
                      </p>
                      {debt.notes && (
                        <p className="text-sm text-gray-500 mt-1">{debt.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">
                        {(debt.current_amount / 100).toLocaleString('cs-CZ')} Kč
                      </p>
                      <p className="text-sm text-gray-600">
                        Fraud: {debt.fraud_score}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      debt.status === 'verified' ? 'bg-green-100 text-green-800' :
                      debt.status === 'pending_verification' ? 'bg-yellow-100 text-yellow-800' :
                      debt.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {debt.status}
                    </span>
                    {debt.status === 'pending_verification' && (
                      <button
                        onClick={() => handleRejectDebt(debt.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Form */}
      {selectedDebts.size > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Verify Relationship & Approve Debts</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Relationship Type
              </label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="contract">Contract</option>
                <option value="ongoing_service">Ongoing Service</option>
                <option value="one_time">One-Time Service</option>
                <option value="lease">Lease/Rental</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contract/Agreement Reference (Optional)
              </label>
              <input
                type="text"
                value={contractReference}
                onChange={(e) => setContractReference(e.target.value)}
                placeholder="e.g., Contract #2024/001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this verification..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm text-gray-600">Selected debts: {selectedDebts.size}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    Total: {(totalAmount / 100).toLocaleString('cs-CZ')} Kč
                  </p>
                </div>
                <button
                  onClick={handleVerifyRelationship}
                  disabled={processing}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                >
                  {processing ? 'Processing...' : 'Verify & Approve'}
                </button>
              </div>
              <p className="text-sm text-gray-500">
                This will verify the debtor-client relationship and approve all selected debts.
                Future debts between these parties will be automatically approved.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
