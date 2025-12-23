import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthCallbackProps {
  onComplete: () => void;
}

export default function AuthCallback({ onComplete }: AuthCallbackProps) {
  const { handleCallback } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('Auth error:', error);
      window.location.href = `/login?error=${error}`;
      return;
    }

    if (token) {
      handleCallback(token);
      // Small delay to ensure state is updated
      setTimeout(() => {
        onComplete();
      }, 100);
    } else {
      window.location.href = '/login?error=no_token';
    }
  }, [handleCallback, onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}
