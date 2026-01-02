import { useState, useEffect } from 'react';
import { Info, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');

export default function About() {
  const { token } = useAuth();
  const [version, setVersion] = useState<string>('Loading...');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch(`${API_URL}/api/version`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setVersion(data.version || 'Unknown');
        } else {
          setVersion('Unknown');
        }
      } catch (err) {
        console.error('Failed to fetch version:', err);
        setVersion('Unknown');
      }
    };
    fetchVersion();
  }, [token]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <Info className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">About ShellSight</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Application information and version</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Application</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">ShellSight</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Version</span>
            <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded text-gray-900 dark:text-gray-100">
              {version}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Description</span>
            <span className="text-gray-900 dark:text-gray-100">Shell session monitoring dashboard</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-gray-600 dark:text-gray-400">Source Code</span>
            <a
              href="https://github.com/nyrahul/shellsight"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
            >
              GitHub
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
