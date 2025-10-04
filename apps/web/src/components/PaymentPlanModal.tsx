import { useState } from 'react';
import { formatCurrency } from '@lexai/shared/utils';

const API_BASE_URL =
  import.meta.env.PROD || window.location.hostname !== 'localhost'
    ? 'https://lexai-api.jhaladik.workers.dev'
    : 'http://localhost:8787';

interface PaymentPlanModalProps {
  isOpen: boolean;
  token: string;
  debtAmount: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentPlanModal({ isOpen, token, debtAmount, currency, onClose, onSuccess }: PaymentPlanModalProps) {
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [numberOfMonths, setNumberOfMonths] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/payment-plans/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          monthly_amount: parseInt(monthlyAmount) * 100, // Convert to smallest unit
          number_of_months: parseInt(numberOfMonths),
          down_payment: downPayment ? parseInt(downPayment) * 100 : 0,
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error?.message || 'Nepodařilo se odeslat žádost');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError('Nepodařilo se spojit se serverem');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotal = () => {
    const monthly = parseInt(monthlyAmount) || 0;
    const months = parseInt(numberOfMonths) || 0;
    const down = parseInt(downPayment) || 0;
    return (monthly * months + down) * 100;
  };

  const minMonthlyPayment = Math.ceil(debtAmount / 12 / 100); // Minimum monthly payment (max 12 months)

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Splátkový kalendář</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✓</div>
              <h3 className="text-xl font-bold text-green-900 mb-2">Žádost odeslána!</h3>
              <p className="text-gray-600">
                Váš návrh splátkového kalendáře byl odeslán k posouzení. Budeme vás kontaktovat.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-1">Celková dlužná částka</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(debtAmount, currency as 'CZK' | 'EUR')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Měsíční splátka (min. {minMonthlyPayment} {currency})
                </label>
                <input
                  type="number"
                  min={minMonthlyPayment}
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Např. ${minMonthlyPayment}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Počet měsíců (max. 12)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={numberOfMonths}
                  onChange={(e) => setNumberOfMonths(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Např. 6"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Akontace (nepovinné)
                </label>
                <input
                  type="number"
                  min="0"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Např. 0"
                />
              </div>

              {monthlyAmount && numberOfMonths && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Celkem zaplatíte</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(calculateTotal(), currency as 'CZK' | 'EUR')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {downPayment && `Akontace: ${formatCurrency(parseInt(downPayment) * 100, currency as 'CZK' | 'EUR')}, pak `}
                    {numberOfMonths}× {formatCurrency(parseInt(monthlyAmount) * 100, currency as 'CZK' | 'EUR')}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Důvod žádosti (nepovinné)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Například: Dočasné finanční potíže..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs text-yellow-800">
                  <strong>Upozornění:</strong> Tento návrh bude odeslán k posouzení věřiteli.
                  V případě neschválení nebo zmeškání splátky může být celá částka splatná okamžitě.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={submitting || !monthlyAmount || !numberOfMonths}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
                >
                  {submitting ? 'Odesílá se...' : 'Odeslat návrh'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
