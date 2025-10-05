import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface PaymentPlan {
  id: string;
  debt_id: string;
  reference_number: string;
  total_amount: number;
  down_payment: number;
  installment_amount: number;
  installment_count: number;
  installment_frequency: string;
  status: string;
  created_at: number;
  agreement_date: number | null;
  debtor_type: string;
  debtor_first_name: string | null;
  debtor_last_name: string | null;
  debtor_company: string | null;
  client_company: string;
  installments?: Installment[];
}

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: number;
  paid: boolean;
  paid_amount: number;
  paid_date: number | null;
  status: string;
}

export function PaymentPlans() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPaymentPlans();
  }, []);

  const loadPaymentPlans = async () => {
    setLoading(true);
    try {
      const data = await api.paymentPlans.list();
      setPlans(data);
    } catch (error) {
      console.error('Error loading payment plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanDetails = async (planId: string) => {
    try {
      const data = await api.paymentPlans.get(planId);
      setSelectedPlan(data);
    } catch (error) {
      console.error('Error loading plan details:', error);
    }
  };

  const handleApprove = async (planId: string) => {
    if (!confirm('Schválit tento splátkový kalendář?')) return;

    setProcessing(true);
    try {
      await api.paymentPlans.approve(planId);
      await loadPaymentPlans();
      setSelectedPlan(null);
      alert('Splátkový kalendář schválen');
    } catch (error) {
      console.error('Error approving payment plan:', error);
      alert('Chyba při schvalování');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (planId: string) => {
    const reason = prompt('Důvod zamítnutí:');
    if (!reason) return;

    setProcessing(true);
    try {
      await api.paymentPlans.reject(planId, reason);
      await loadPaymentPlans();
      setSelectedPlan(null);
      alert('Splátkový kalendář zamítnut');
    } catch (error) {
      console.error('Error rejecting payment plan:', error);
      alert('Chyba při zamítání');
    } finally {
      setProcessing(false);
    }
  };

  const getDebtorName = (plan: PaymentPlan) => {
    return plan.debtor_type === 'business'
      ? plan.debtor_company
      : `${plan.debtor_first_name} ${plan.debtor_last_name}`;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      proposed: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      defaulted: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getInstallmentStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      waived: 'bg-gray-100 text-gray-500',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
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
        <h1 className="text-2xl font-bold text-gray-900">Payment Plans</h1>
        <p className="text-gray-600">Manage installment payment plans for debtors</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plans List */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">All Plans ({plans.length})</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => loadPlanDetails(plan.id)}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${
                  selectedPlan?.id === plan.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-gray-900">
                    {getDebtorName(plan)}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(
                      plan.status
                    )}`}
                  >
                    {plan.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  {plan.installment_count}x {(plan.installment_amount / 100).toLocaleString('cs-CZ')} Kč
                </p>
                <p className="text-sm text-gray-500">
                  Total: {(plan.total_amount / 100).toLocaleString('cs-CZ')} Kč
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Details */}
        <div className="lg:col-span-2">
          {selectedPlan ? (
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {getDebtorName(selectedPlan)}
                    </h2>
                    <p className="text-gray-600">
                      Debt: {selectedPlan.reference_number || selectedPlan.debt_id}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(
                      selectedPlan.status
                    )}`}
                  >
                    {selectedPlan.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-lg font-semibold">
                      {(selectedPlan.total_amount / 100).toLocaleString('cs-CZ')} Kč
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Down Payment</p>
                    <p className="text-lg font-semibold">
                      {(selectedPlan.down_payment / 100).toLocaleString('cs-CZ')} Kč
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Installment Amount</p>
                    <p className="text-lg font-semibold">
                      {(selectedPlan.installment_amount / 100).toLocaleString('cs-CZ')} Kč
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Number of Installments</p>
                    <p className="text-lg font-semibold">{selectedPlan.installment_count}</p>
                  </div>
                </div>

                {selectedPlan.status === 'proposed' && (
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => handleApprove(selectedPlan.id)}
                      disabled={processing}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                    >
                      Approve Plan
                    </button>
                    <button
                      onClick={() => handleReject(selectedPlan.id)}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                    >
                      Reject Plan
                    </button>
                  </div>
                )}
              </div>

              {/* Installments */}
              {selectedPlan.installments && selectedPlan.installments.length > 0 && (
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Installments</h3>
                  <div className="space-y-3">
                    {selectedPlan.installments.map((inst) => (
                      <div
                        key={inst.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Installment</p>
                            <p className="text-lg font-bold text-gray-900">
                              {inst.installment_number}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {(inst.amount / 100).toLocaleString('cs-CZ')} Kč
                            </p>
                            <p className="text-sm text-gray-600">
                              Due: {new Date(inst.due_date).toLocaleDateString('cs-CZ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {inst.paid && (
                            <div className="text-right text-sm">
                              <p className="text-green-700 font-medium">
                                Paid: {(inst.paid_amount / 100).toLocaleString('cs-CZ')} Kč
                              </p>
                              <p className="text-gray-500">
                                {new Date(inst.paid_date!).toLocaleDateString('cs-CZ')}
                              </p>
                            </div>
                          )}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getInstallmentStatusBadge(
                              inst.status
                            )}`}
                          >
                            {inst.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <p className="text-gray-500">Select a payment plan to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
