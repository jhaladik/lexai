export function Login() {
  const handleLogin = () => {
    // Redirect to main app - Cloudflare Access will handle authentication
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-2xl shadow-xl">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">LexAI</h1>
          <p className="text-lg text-gray-600">Receivables Collection Platform</p>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Secure Authentication</h3>
              <p className="text-sm text-blue-800">
                This application uses <strong>Cloudflare Access</strong> for enterprise-grade security.
                Click the button below to authenticate with your authorized email.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-700">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">AI-powered debt collection management</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Automated dispute resolution</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Attorney letter generation</span>
          </div>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Continue to Login
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Only authorized users can access this platform.<br />
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}
