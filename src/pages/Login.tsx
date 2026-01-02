import { useEffect } from 'react';
import { Github, Chrome, Building2, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ShellSightIcon from '../components/ShellSightIcon';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const { providers, login, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && onLoginSuccess) {
      onLoginSuccess();
    }
  }, [isAuthenticated, onLoginSuccess]);

  const getProviderIcon = (iconType: string) => {
    switch (iconType) {
      case 'google':
        return <Chrome className="w-5 h-5" />;
      case 'github':
        return <Github className="w-5 h-5" />;
      case 'microsoft':
        return <Building2 className="w-5 h-5" />;
      default:
        return <Key className="w-5 h-5" />;
    }
  };

  const getProviderColor = (iconType: string) => {
    switch (iconType) {
      case 'google':
        return 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 dark:border-gray-600';
      case 'github':
        return 'bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-700 dark:hover:bg-gray-600';
      case 'microsoft':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-2">
              <ShellSightIcon className="w-12 h-12" />
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                ShellSight
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Sign in to access shell session recordings
            </p>
          </div>

          {providers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No SSO providers configured
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Please configure at least one OAuth provider in the server environment variables.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => login(provider.id)}
                  className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg font-medium transition-colors ${getProviderColor(provider.icon)}`}
                >
                  {getProviderIcon(provider.icon)}
                  <span>Continue with {provider.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Eyes on every terminal session.
        </p>

        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              <circle cx="8" cy="14" r="1"/>
              <circle cx="16" cy="14" r="1"/>
            </svg>
            Full AI-Generated Application
          </span>
        </div>
      </div>
    </div>
  );
}
