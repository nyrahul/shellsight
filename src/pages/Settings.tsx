import { useState, useEffect } from 'react';
import { HardDrive, Check, Save, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface StorageConfig {
  s3Endpoint: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  hasCredentials: boolean;
}

const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');

export default function Settings() {
  const { token } = useAuth();
  const [config, setConfig] = useState<StorageConfig>({
    s3Endpoint: '',
    s3Bucket: '',
    s3AccessKey: '',
    s3SecretKey: '',
    hasCredentials: false,
  });
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Fetch current storage configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/api/storage-config`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
          if (data.s3AccessKey) {
            setAccessKey(data.s3AccessKey);
          }
        }
      } catch (err) {
        console.error('Failed to fetch storage config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, [token]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const response = await fetch(`${API_URL}/api/storage-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          s3AccessKey: accessKey,
          s3SecretKey: secretKey,
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
        setSecretKey(''); // Clear secret key after save
        setConfig(prev => ({ ...prev, hasCredentials: true, s3AccessKey: accessKey }));
      } else {
        const data = await response.json();
        setSaveError(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      setSaveError('Failed to connect to server');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await fetch(`${API_URL}/api/storage-test`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setTestStatus('success');
        setTestMessage(data.message || 'Connection successful');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Connection failed');
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage('Failed to connect to server');
    }
  };

  const isFormValid = accessKey.trim() !== '' && (secretKey.trim() !== '' || config.hasCredentials);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Storage Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure S3 storage for shell recordings</p>
        </div>
      </div>

      {/* S3 Storage Configuration */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">S3 Storage</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">S3-compatible storage for shell recordings</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Read-only S3 Endpoint and Bucket */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                S3 Endpoint
              </label>
              <div className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                {config.s3Endpoint || <span className="text-gray-400 italic">Not configured (using AWS default)</span>}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Configured via S3_ENDPOINT environment variable
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                S3 Bucket
              </label>
              <div className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                {config.s3Bucket || <span className="text-gray-400 italic">Not configured</span>}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Configured via S3_BUCKET environment variable
              </p>
            </div>
          </div>

          {/* Editable Access Key and Secret Key */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">S3 Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Access Key
                </label>
                <input
                  type="text"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value);
                    setSaveSuccess(false);
                    setSaveError('');
                  }}
                  placeholder="Enter S3 Access Key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    value={secretKey}
                    onChange={(e) => {
                      setSecretKey(e.target.value);
                      setSaveSuccess(false);
                      setSaveError('');
                    }}
                    placeholder={config.hasCredentials ? '••••••••••••••••' : 'Enter S3 Secret Key'}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {config.hasCredentials && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Leave blank to keep existing secret key
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                Test Connection
              </button>
              {testStatus === 'success' && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  {testMessage}
                </span>
              )}
              {testStatus === 'error' && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {testMessage}
                </span>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex items-center justify-between">
            <div>
              {saveSuccess && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Credentials saved successfully
                </span>
              )}
              {saveError && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {saveError}
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Credentials
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
