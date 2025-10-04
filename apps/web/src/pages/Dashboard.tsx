import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@lexai/shared/utils';

export function Dashboard() {
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error loading dashboard</h3>
        <p className="text-red-600 text-sm mt-1">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  const stats = data?.stats || {
    total_debts: 0,
    active_debts: 0,
    total_value: 0,
    total_collected: 0,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('dashboard.title')}</h1>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('common.loading')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600">{t('dashboard.totalDebts')}</p>
              <p className="text-3xl font-bold mt-2">{stats.total_debts}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600">{t('dashboard.activeDebts')}</p>
              <p className="text-3xl font-bold mt-2">{stats.active_debts}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600">{t('dashboard.totalValue')}</p>
              <p className="text-3xl font-bold mt-2">
                {formatCurrency(stats.total_value)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-sm text-gray-600">{t('dashboard.collected')}</p>
              <p className="text-3xl font-bold mt-2">
                {formatCurrency(stats.total_collected)}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            {data?.recent_debts && data.recent_debts.length > 0 ? (
              <div className="space-y-3">
                {data.recent_debts.map((debt) => (
                  <div key={debt.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">
                        {debt.debtor_type === 'business'
                          ? debt.company_name
                          : `${debt.first_name} ${debt.last_name}`}
                      </p>
                      <p className="text-sm text-gray-500">{debt.reference_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(debt.original_amount)}</p>
                      <p className="text-sm text-gray-500">{debt.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No activity yet</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
