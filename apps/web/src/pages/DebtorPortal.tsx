import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatCurrency } from '@lexai/shared/utils';
import { PaymentModal } from '../components/PaymentModal';
import { PaymentPlanModal } from '../components/PaymentPlanModal';
import { DisputeModal } from '../components/DisputeModal';

const API_BASE_URL =
  import.meta.env.PROD || window.location.hostname !== 'localhost'
    ? 'https://lexai-api.jhaladik.workers.dev'
    : 'http://localhost:8787';

export function DebtorPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentPlanModal, setShowPaymentPlanModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortalData() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/portal/${token}`);
        const result = await response.json();

        if (!response.ok || result.error) {
          setError(result.error?.message || 'Failed to load debt information');
          return;
        }

        setData(result.data);
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchPortalData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Načítání...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Chyba</h1>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { debt, client, portal_info, payment_plan, installments } = data;

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    setPaymentSuccess(true);

    // Refresh debt data to show updated amount
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/portal/${token}`);
      const result = await response.json();
      if (response.ok && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  const handlePaymentPlanSuccess = async () => {
    setShowPaymentPlanModal(false);
    setActionSuccess('Žádost o splátkový kalendář byla odeslána');

    // Refresh debt data
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/portal/${token}`);
      const result = await response.json();
      if (response.ok && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  const handleDisputeSuccess = async () => {
    setShowDisputeModal(false);
    setActionSuccess('Námitka byla úspěšně podána. Vymáhání je pozastaveno.');

    // Refresh debt data
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/portal/${token}`);
      const result = await response.json();
      if (response.ok && result.data) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Upomínka nezaplacené pohledávky
            </h1>
            <p className="text-gray-600">
              Věřitel: <strong>{client.company_name}</strong>
            </p>
          </div>
        </div>

        {/* Debt Details */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Detail pohledávky</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Číslo pohledávky</p>
              <p className="font-semibold text-gray-900">{debt.reference_number || debt.id}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Typ pohledávky</p>
              <p className="font-semibold text-gray-900">{debt.debt_type}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Datum splatnosti</p>
              <p className="font-semibold text-gray-900">
                {new Date(debt.due_date).toLocaleDateString('cs-CZ')}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Datum vystavení</p>
              <p className="font-semibold text-gray-900">
                {new Date(debt.invoice_date).toLocaleDateString('cs-CZ')}
              </p>
            </div>

            <div className="col-span-2 mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-gray-600 mb-1">Dlužná částka</p>
              <p className="text-4xl font-bold text-red-600">
                {formatCurrency(debt.current_amount, debt.currency)}
              </p>
            </div>
          </div>

          {debt.notes && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Poznámka</p>
              <p className="text-gray-900">{debt.notes}</p>
            </div>
          )}
        </div>

        {/* Success Messages */}
        {paymentSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="text-center">
              <div className="text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-green-900 mb-2">Platba úspěšná!</h2>
              <p className="text-green-800">Vaše platba byla přijata. Děkujeme!</p>
            </div>
          </div>
        )}

        {actionSuccess && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="text-center">
              <div className="text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-blue-900 mb-2">Akce úspěšná!</h2>
              <p className="text-blue-800">{actionSuccess}</p>
            </div>
          </div>
        )}

        {/* Payment Plan Status */}
        {payment_plan && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Splátkový kalendář</h2>

            <div className={`mb-4 p-4 rounded-lg border-2 ${payment_plan.status === 'proposed' ? 'bg-yellow-50 border-yellow-300' : payment_plan.status === 'active' ? 'bg-green-50 border-green-300' : payment_plan.status === 'cancelled' ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold">Status:</span>
                <span className={`px-4 py-1 rounded-full text-sm font-semibold ${
                  payment_plan.status === 'proposed' ? 'bg-yellow-200 text-yellow-900' :
                  payment_plan.status === 'active' ? 'bg-green-200 text-green-900' :
                  payment_plan.status === 'cancelled' ? 'bg-red-200 text-red-900' :
                  payment_plan.status === 'completed' ? 'bg-blue-200 text-blue-900' :
                  'bg-gray-200 text-gray-900'
                }`}>
                  {payment_plan.status === 'proposed' ? '⏳ Čeká na schválení' :
                   payment_plan.status === 'active' ? '✓ Schváleno' :
                   payment_plan.status === 'cancelled' ? '✗ Zamítnuto' :
                   payment_plan.status === 'completed' ? '✓ Dokončeno' :
                   payment_plan.status}
                </span>
              </div>

              {payment_plan.status === 'proposed' && (
                <p className="text-sm text-yellow-800 mt-2">
                  Váš návrh na splátkový kalendář byl odeslán a čeká na posouzení věřitelem.
                </p>
              )}

              {payment_plan.status === 'active' && (
                <p className="text-sm text-green-800 mt-2">
                  Váš splátkový kalendář byl schválen. Platby splácejte včas dle harmonogramu níže.
                </p>
              )}

              {payment_plan.status === 'cancelled' && (
                <p className="text-sm text-red-800 mt-2">
                  Váš návrh splatkového kalendáře byl zamítnut. Můžete navrhnout jiný plán nebo kontaktovat věřitele.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Celková částka</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(payment_plan.total_amount, 'CZK')}
                </p>
              </div>
              {payment_plan.down_payment > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Akontace</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(payment_plan.down_payment, 'CZK')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Měsíční splátka</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(payment_plan.installment_amount, 'CZK')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Počet splátek</p>
                <p className="text-lg font-bold text-gray-900">
                  {payment_plan.installment_count}x
                </p>
              </div>
            </div>

            {/* Installments Schedule */}
            {installments && installments.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Harmonogram splátek</h3>
                <div className="space-y-2">
                  {installments.map((inst: any) => (
                    <div key={inst.id} className={`flex items-center justify-between p-3 rounded-lg ${
                      inst.paid ? 'bg-green-50' : inst.status === 'overdue' ? 'bg-red-50' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-700">#{inst.installment_number}</span>
                        <span className="text-sm text-gray-600">
                          Splatnost: {new Date(inst.due_date).toLocaleDateString('cs-CZ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">
                          {formatCurrency(inst.amount, 'CZK')}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          inst.paid ? 'bg-green-200 text-green-900' :
                          inst.status === 'overdue' ? 'bg-red-200 text-red-900' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {inst.paid ? '✓ Zaplaceno' : inst.status === 'overdue' ? 'Po splatnosti' : 'Čeká'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {debt.status !== 'resolved_paid' && !payment_plan && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Možnosti řešení</h2>

            <div className="space-y-4">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition flex items-center justify-between"
              >
                <span className="font-semibold text-lg">✓ Zaplatit celou částku</span>
                <span className="text-2xl">→</span>
              </button>

              <button
                onClick={() => setShowPaymentPlanModal(true)}
                className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition flex items-center justify-between"
              >
                <span className="font-semibold text-lg">📅 Navrhnout splátkový kalendář</span>
                <span className="text-2xl">→</span>
              </button>

              <button
                onClick={() => setShowDisputeModal(true)}
                className="w-full bg-orange-600 text-white px-6 py-4 rounded-lg hover:bg-orange-700 transition flex items-center justify-between"
              >
                <span className="font-semibold text-lg">⚖️ Podat námitku s důkazy</span>
                <span className="text-2xl">→</span>
              </button>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Upozornění:</strong> Nezaplacení pohledávky může vést k dalším právním krokům včetně
                zvýšení dlužné částky o úroky z prodlení a soudní vymáhání.
              </p>
            </div>
          </div>
        )}

        {/* Show only payment option if payment plan is cancelled */}
        {payment_plan && payment_plan.status === 'cancelled' && debt.status !== 'resolved_paid' && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Možnosti řešení</h2>

            <div className="space-y-4">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition flex items-center justify-between"
              >
                <span className="font-semibold text-lg">✓ Zaplatit celou částku</span>
                <span className="text-2xl">→</span>
              </button>

              <button
                onClick={() => setShowPaymentPlanModal(true)}
                className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 transition flex items-center justify-between"
              >
                <span className="font-semibold text-lg">📅 Navrhnout nový splátkový kalendář</span>
                <span className="text-2xl">→</span>
              </button>
            </div>
          </div>
        )}

        {/* Client Contact */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Kontakt na věřitele</h2>

          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-600">Společnost</p>
              <p className="font-semibold text-gray-900">{client.company_name}</p>
            </div>

            {client.email && (
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <a href={`mailto:${client.email}`} className="font-semibold text-blue-600 hover:text-blue-700">
                  {client.email}
                </a>
              </div>
            )}

            {client.address && (
              <div>
                <p className="text-sm text-gray-600">Adresa</p>
                <p className="font-semibold text-gray-900">
                  {client.address}, {client.postal_code} {client.city}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Tento odkaz vyprší {new Date(portal_info.expires_at).toLocaleDateString('cs-CZ')}</p>
          <p className="mt-2">Powered by LexAI - Automated Debt Collection Platform</p>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        token={token!}
        amount={debt.current_amount}
        currency={debt.currency}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* Payment Plan Modal */}
      <PaymentPlanModal
        isOpen={showPaymentPlanModal}
        token={token!}
        debtAmount={debt.current_amount}
        currency={debt.currency}
        onClose={() => setShowPaymentPlanModal(false)}
        onSuccess={handlePaymentPlanSuccess}
      />

      {/* Dispute Modal */}
      <DisputeModal
        isOpen={showDisputeModal}
        token={token!}
        onClose={() => setShowDisputeModal(false)}
        onSuccess={handleDisputeSuccess}
      />
    </div>
  );
}
