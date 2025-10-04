import { useState } from 'react';

const API_BASE_URL =
  import.meta.env.PROD || window.location.hostname !== 'localhost'
    ? 'https://lexai-api.jhaladik.workers.dev'
    : 'http://localhost:8787';

interface DisputeModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DISPUTE_TYPES = [
  { value: 'amount_incorrect', label: 'Částka je nesprávná' },
  { value: 'never_received', label: 'Nikdy jsem nedostal(a) zboží/služby' },
  { value: 'quality_issue', label: 'Problémy s kvalitou' },
  { value: 'already_paid', label: 'Již zaplaceno' },
  { value: 'contract_dispute', label: 'Spor ohledně smlouvy' },
  { value: 'fraud_claim', label: 'Podezření na podvod' },
  { value: 'other', label: 'Jiný důvod' },
];

export function DisputeModal({ isOpen, token, onClose, onSuccess }: DisputeModalProps) {
  const [disputeType, setDisputeType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (description.length < 50) {
      setError('Popis musí mít alespoň 50 znaků');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/disputes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          dispute_type: disputeType,
          description,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error?.message || 'Nepodařilo se odeslat námitku');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Podat námitku</h2>
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
              <h3 className="text-xl font-bold text-green-900 mb-2">Námitka podána!</h3>
              <p className="text-gray-600">
                Vaše námitka byla úspěšně odeslána. Všechny vymáhací aktivity jsou pozastaveny
                do vyřešení sporu. Budeme vás kontaktovat.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  <strong>Důležité:</strong> Podáním námitky budou pozastaveny všechny vymáhací
                  aktivity do vyřešení sporu. Uveďte prosím co nejvíce detailů.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typ námitky *
                </label>
                <select
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Vyberte typ námitky...</option>
                  {DISPUTE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Podrobný popis * (min. 50 znaků)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  minLength={50}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Popište podrobně důvod vaší námitky. Uveďte všechny relevantní informace, data a okolnosti..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {description.length} / 50 znaků (min.)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Po podání námitky můžete být požádáni o zaslání
                  podpůrných dokumentů (smlouvy, potvrzení o platbě, fotografie, atd.).
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

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
                  disabled={submitting || !disputeType || description.length < 50}
                  className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 font-semibold"
                >
                  {submitting ? 'Odesílá se...' : 'Podat námitku'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
