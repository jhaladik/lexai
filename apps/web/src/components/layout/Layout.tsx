import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Layout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">LexAI</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="/" className="text-gray-700 hover:text-primary">
                {t('nav.dashboard')}
              </a>
              <a href="/debts" className="text-gray-700 hover:text-primary">
                {t('nav.debts')}
              </a>
              <a href="/clients" className="text-gray-700 hover:text-primary">
                {t('nav.clients')}
              </a>
              <a href="/reports" className="text-gray-700 hover:text-primary">
                {t('nav.reports')}
              </a>
            </nav>
            <div>
              <button className="text-gray-700 hover:text-primary">
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
