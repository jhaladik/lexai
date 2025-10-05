import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function Layout() {

  // Fetch current user info
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.auth.me(),
    retry: false,
  });

  const handleLogout = () => {
    // Clear any local auth state
    localStorage.removeItem('auth_token');

    // Redirect to Cloudflare Access logout endpoint with return URL
    // This properly terminates the Cloudflare Access session
    // After logout, user will be redirected back to login page
    const teamName = 'lexai'; // Your Cloudflare Access team name
    const returnUrl = encodeURIComponent('https://lexai.pages.dev/login');
    const logoutUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/logout?returnTo=${returnUrl}`;

    window.location.href = logoutUrl;
  };

  // Role-based navigation items
  const getNavItems = () => {
    if (!user) return [];

    const role = user.role;

    // Common items for all roles
    const commonItems = [
      { href: '/', label: 'Dashboard', roles: ['admin', 'attorney', 'client'] },
    ];

    // Attorney-specific items
    const attorneyItems = [
      { href: '/clients', label: 'Clients', roles: ['admin', 'attorney'] },
      { href: '/debts', label: 'Debts', roles: ['admin', 'attorney'] },
      { href: '/debtors', label: 'Debtors', roles: ['admin', 'attorney'] },
      { href: '/attorney/review', label: 'Attorney Review', roles: ['admin', 'attorney'] },
      { href: '/communications', label: 'Communications', roles: ['admin', 'attorney'] },
      { href: '/disputes', label: 'Disputes', roles: ['admin', 'attorney'] },
      { href: '/payment-plans', label: 'Payment Plans', roles: ['admin', 'attorney'] },
    ];

    // Client-specific items
    const clientItems = [
      { href: '/debts', label: 'My Debts', roles: ['client'] },
      { href: '/payment-plans', label: 'Payment Plans', roles: ['client'] },
    ];

    const allItems = [...commonItems, ...attorneyItems, ...clientItems];

    // Filter items based on user role
    return allItems.filter(item => item.roles.includes(role));
  };

  const navItems = getNavItems();

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      attorney: 'bg-blue-100 text-blue-800',
      attorney_employee: 'bg-cyan-100 text-cyan-800',
      client: 'bg-green-100 text-green-800',
      client_employee: 'bg-emerald-100 text-emerald-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      attorney: 'Attorney',
      attorney_employee: 'Paralegal',
      client: 'Client',
      client_employee: 'Client Staff',
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <a href="/" className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-primary">LexAI</h1>
              </a>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-gray-700 hover:text-primary font-medium transition"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* User info and logout */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  {/* User info */}
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>

                  {/* Logout button */}
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-red-600 font-medium transition flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Odhlásit se</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4.414l-4.293 4.293a1 1 0 01-1.414 0L4 7.414 5.414 6l3.293 3.293L13.586 6 15 7.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}

              {!user && (
                <a
                  href="/login"
                  className="text-gray-700 hover:text-primary font-medium"
                >
                  Přihlásit se
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        {user && navItems.length > 0 && (
          <div className="md:hidden border-t border-gray-200 bg-gray-50">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md font-medium"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
