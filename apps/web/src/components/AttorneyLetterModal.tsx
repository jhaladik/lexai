import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface AttorneyLetterModalProps {
  debtId: string;
  debtReference: string;
  onClose: () => void;
}

export function AttorneyLetterModal({ debtId, debtReference, onClose }: AttorneyLetterModalProps) {
  const queryClient = useQueryClient();
  const [customMessage, setCustomMessage] = useState('');
  const [letterHtml, setLetterHtml] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: (data: { debt_id: string; custom_message?: string }) =>
      api.attorneyLetters.generate(data),
    onSuccess: (result) => {
      setLetterHtml(result.letter_html);
      setDocumentId(result.document_id);
    },
  });

  const sendMutation = useMutation({
    mutationFn: (documentId: string) => api.attorneyLetters.send(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attorney-debtor-group'] });
      alert('Attorney letter sent successfully!');
      onClose();
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      debt_id: debtId,
      custom_message: customMessage || undefined,
    });
  };

  const handleSend = () => {
    if (documentId && confirm('Are you sure you want to sign and send this attorney letter?')) {
      sendMutation.mutate(documentId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Generate Attorney Letter</h2>
              <p className="text-sm text-gray-600 mt-1">Debt Reference: {debtReference}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!letterHtml ? (
            /* Step 1: Generate */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Message (Optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={6}
                  placeholder="Add any custom message or specific details to include in the letter..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to use the standard attorney letter template
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">📝 What happens next:</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>System will generate a formal demand letter with law firm branding</li>
                  <li>You'll review the letter and can edit if needed</li>
                  <li>Once satisfied, you'll sign and send it via email</li>
                  <li>Debtor will receive the letter with a 15-day payment deadline</li>
                  <li>Debt status will be updated to "attorney_letter_sent"</li>
                </ol>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
              >
                {generateMutation.isPending ? 'Generating...' : '📄 Generate Attorney Letter'}
              </button>
            </div>
          ) : (
            /* Step 2: Review and Send */
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please review the letter below. Once you click "Sign & Send", the letter will be emailed to the debtor.
                </p>
              </div>

              {/* Letter Preview */}
              <div className="border border-gray-300 rounded-lg p-6 bg-white max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: letterHtml }} />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setLetterHtml(null);
                    setDocumentId(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  ← Edit & Regenerate
                </button>
                <button
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-semibold"
                >
                  {sendMutation.isPending ? 'Sending...' : '✓ Sign & Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
