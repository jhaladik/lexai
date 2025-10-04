import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface DebtorGroup {
  debtor_id: string;
  debtor_type: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  client_id: string;
  client_company: string;
  relationship_id: string | null;
  relationship_verified: boolean;
  trust_level: string;
  pending_debts_count: number;
  total_amount: number;
  max_fraud_score: number;
  first_debt_date: number;
  last_debt_date: number;
}

export function AttorneyReview() {
  const [groups, setGroups] = useState<DebtorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');
  const [sortBy, setSortBy] = useState('fraud_score');

  useEffect(() => {
    loadReviewQueue();
  }, [viewMode, sortBy]);

  const loadReviewQueue = async () => {
    setLoading(true);
    try {
      const response = await api.attorney.getReviewQueue({
        group: viewMode === 'grouped' ? 'debtor' : 'individual',
        sort: sortBy
      });
      if (response.data.view === 'grouped') {
        setGroups(response.data.groups);
      }
    } catch (error) {
      console.error('Error loading review queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDebtorName = (group: DebtorGroup) => {
    return group.debtor_type === 'business'
      ? group.company_name
      : `${group.first_name} ${group.last_name}`;
  };

  const getFraudLevel = (score: number) => {
    if (score >= 70) return { label: 'High Risk', color: 'bg-red-100 text-red-800 border-red-300' };
    if (score >= 40) return { label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    return { label: 'Low Risk', color: 'bg-green-100 text-green-800 border-green-300' };
  };

  const getTrustBadge = (trust: string, verified: boolean) => {
    if (verified) return { label: 'Verified', color: 'bg-blue-100 text-blue-800' };
    if (trust === 'trusted') return { label: 'Trusted', color: 'bg-green-100 text-green-800' };
    if (trust === 'flagged') return { label: 'Flagged', color: 'bg-red-100 text-red-800' };
    return { label: 'New', color: 'bg-gray-100 text-gray-800' };
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
        <h1 className="text-2xl font-bold text-gray-900">Attorney Review Queue</h1>
        <p className="text-gray-600">Review and approve debtor-client relationships</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">View Mode</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'grouped' | 'individual')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="grouped">Grouped by Debtor</option>
            <option value="individual">Individual Debts</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="fraud_score">Fraud Score (Highest First)</option>
            <option value="created_at">Date (Newest First)</option>
            <option value="amount">Amount (Highest First)</option>
          </select>
        </div>
      </div>

      {/* Debtor Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No debts pending review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const fraudLevel = getFraudLevel(group.max_fraud_score);
            const trustBadge = getTrustBadge(group.trust_level, group.relationship_verified);

            return (
              <div key={`${group.debtor_id}-${group.client_id}`} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{getDebtorName(group)}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${trustBadge.color}`}>
                        {trustBadge.label}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${fraudLevel.color}`}>
                        {fraudLevel.label} ({group.max_fraud_score})
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      vs. <strong>{group.client_company}</strong>
                    </p>
                    {group.email && (
                      <p className="text-sm text-gray-500">{group.email}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {(group.total_amount / 100).toLocaleString('cs-CZ')} Kč
                    </p>
                    <p className="text-sm text-gray-600">
                      {group.pending_debts_count} debt{group.pending_debts_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    First debt: {new Date(group.first_debt_date).toLocaleDateString('cs-CZ')}
                    {group.pending_debts_count > 1 && (
                      <> • Last: {new Date(group.last_debt_date).toLocaleDateString('cs-CZ')}</>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.location.href = `/attorney/review/${group.debtor_id}/${group.client_id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                      Review Relationship
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
