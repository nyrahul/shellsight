import { useEffect } from 'react';
import { Github, Chrome, Building2, Key, Shield, ShieldCheck, FileCheck, Lock, Building, BadgeCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ShellSightIcon from '../components/ShellSightIcon';

const complianceStandards = [
  { name: 'PCI DSS', icon: Lock, color: 'text-blue-600 dark:text-blue-400' },
  { name: 'HIPAA', icon: ShieldCheck, color: 'text-green-600 dark:text-green-400' },
  { name: 'SOX', icon: FileCheck, color: 'text-purple-600 dark:text-purple-400' },
  { name: 'ISO 27001', icon: BadgeCheck, color: 'text-indigo-600 dark:text-indigo-400' },
  { name: 'NIST 800-53', icon: Shield, color: 'text-red-600 dark:text-red-400' },
  { name: 'FedRAMP', icon: Building, color: 'text-orange-600 dark:text-orange-400' },
  { name: 'FISMA', icon: ShieldCheck, color: 'text-teal-600 dark:text-teal-400' },
];

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

        {/* Compliance Standards */}
        <div className="mt-6">
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mb-3">
            Helps meet compliance requirements
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {complianceStandards.map((standard) => {
              const Icon = standard.icon;
              return (
                <div
                  key={standard.name}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  title={standard.name}
                >
                  <Icon className={`w-3 h-3 ${standard.color}`} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {standard.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 text-center">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Powered by{' '}
            <a
              href="https://www.accuknox.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              AccuKnox
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
