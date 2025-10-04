import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { formatCurrency } from '@lexai/shared/utils';

const API_BASE_URL =
  import.meta.env.PROD || window.location.hostname !== 'localhost'
    ? 'https://lexai-api.jhaladik.workers.dev'
    : 'http://localhost:8787';

// Initialize Stripe (use your publishable key)
// Get your publishable key from: https://dashboard.stripe.com/apikeys
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error('VITE_STRIPE_PUBLISHABLE_KEY is not set');
}

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface PaymentFormProps {
  amount: number;
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentForm({ amount, currency, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Platba selhala');
        setIsProcessing(false);
      } else {
        // Payment succeeded
        onSuccess();
      }
    } catch (err) {
      setErrorMessage('Neočekávaná chyba při zpracování platby');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 mb-1">Částka k zaplacení</p>
        <p className="text-3xl font-bold text-blue-900">
          {formatCurrency(amount, currency as 'CZK' | 'EUR')}
        </p>
      </div>
      <PaymentElement />

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
        >
          Zrušit
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-semibold"
        >
          {isProcessing ? 'Zpracovává se...' : 'Zaplatit'}
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Platba je zabezpečena pomocí Stripe. Vaše platební údaje jsou v bezpečí.
      </p>
    </form>
  );
}

interface PaymentModalProps {
  isOpen: boolean;
  token: string;
  amount: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ isOpen, token, amount, currency, onClose, onSuccess }: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !clientSecret) {
      createPaymentIntent();
    }
  }, [isOpen]);

  const createPaymentIntent = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/payments/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, amount }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error?.message || 'Nepodařilo se vytvořit platbu');
        return;
      }

      setClientSecret(result.data.client_secret);
    } catch (err) {
      setError('Nepodařilo se spojit se serverem');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setClientSecret(null);
    onSuccess();
  };

  const handleClose = () => {
    setClientSecret(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Zaplatit pohledávku</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Připravuje se platba...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={handleClose}
                className="mt-3 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Zavřít
              </button>
            </div>
          )}

          {clientSecret && !loading && !error && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm
                amount={amount}
                currency={currency}
                onSuccess={handleSuccess}
                onCancel={handleClose}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
