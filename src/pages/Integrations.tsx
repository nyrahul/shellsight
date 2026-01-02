import { useState, useEffect } from 'react';
import { Plug, Plus, Circle, Bell, Mail, MessageSquare, Database, CheckCircle, XCircle, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Integration } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');

interface S3Config {
  configured: boolean;
  endpoint?: string;
  bucket?: string;
  prefix?: string;
  accessKey?: string;
}

export default function Integrations() {
  const { token } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // S3 Integration state
  const [s3Config, setS3Config] = useState<S3Config>({ configured: false });
  const [s3Form, setS3Form] = useState({
    endpoint: '',
    bucket: '',
    prefix: '',
    accessKey: '',
    secretKey: '',
  });
  const [showS3Form, setShowS3Form] = useState(false);
  const [s3Testing, setS3Testing] = useState(false);
  const [s3Saving, setS3Saving] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  useEffect(() => {
    // Fetch existing S3 config
    const fetchS3Config = async () => {
      try {
        const response = await fetch(`${API_URL}/api/integrations/s3`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setS3Config(data);
          if (data.configured) {
            setS3Form({
              endpoint: data.endpoint || '',
              bucket: data.bucket || '',
              prefix: data.prefix || '',
              accessKey: data.accessKey || '',
              secretKey: '', // Never returned from server
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch S3 config:', err);
      }
    };
    fetchS3Config();

    const mockIntegrations: Integration[] = [
      {
        id: '1',
        type: 'slack',
        name: 'Slack Notifications',
        status: 'inactive',
        config: { webhook: '' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      },
      {
        id: '2',
        type: 'email',
        name: 'Email Alerts',
        status: 'inactive',
        config: { smtp: '', recipients: [] },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      },
    ];
    setIntegrations(mockIntegrations);
  }, [token]);

  const handleS3Test = async () => {
    setS3Testing(true);
    setS3TestResult(null);

    try {
      const response = await fetch(`${API_URL}/api/integrations/s3/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(s3Form),
      });

      const data = await response.json();
      setS3TestResult({
        success: data.success,
        message: data.message || data.error,
      });
    } catch (err) {
      setS3TestResult({
        success: false,
        message: 'Failed to test connection',
      });
    } finally {
      setS3Testing(false);
    }
  };

  const handleS3Save = async () => {
    setS3Saving(true);

    try {
      const response = await fetch(`${API_URL}/api/integrations/s3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(s3Form),
      });

      if (response.ok) {
        setS3Config({
          configured: true,
          endpoint: s3Form.endpoint,
          bucket: s3Form.bucket,
          prefix: s3Form.prefix,
          accessKey: s3Form.accessKey,
        });
        setShowS3Form(false);
        setS3TestResult(null);
      } else {
        const data = await response.json();
        setS3TestResult({
          success: false,
          message: data.error || 'Failed to save configuration',
        });
      }
    } catch (err) {
      setS3TestResult({
        success: false,
        message: 'Failed to save configuration',
      });
    } finally {
      setS3Saving(false);
    }
  };

  const handleS3Delete = async () => {
    if (!confirm('Are you sure you want to remove the S3 configuration?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/integrations/s3`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (response.ok) {
        setS3Config({ configured: false });
        setS3Form({
          endpoint: '',
          bucket: '',
          prefix: '',
          accessKey: '',
          secretKey: '',
        });
        setShowS3Form(false);
      }
    } catch (err) {
      console.error('Failed to delete S3 config:', err);
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'slack':
        return <MessageSquare className="w-6 h-6" />;
      case 'email':
        return <Mail className="w-6 h-6" />;
      case 'siem':
      case 'splunk':
        return <Bell className="w-6 h-6" />;
      case 'ticketing':
        return <Plug className="w-6 h-6" />;
      default:
        return <Plug className="w-6 h-6" />;
    }
  };

  const getIntegrationColor = (type: string) => {
    switch (type) {
      case 'slack':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      case 'email':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'siem':
      case 'splunk':
        return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
      case 'ticketing':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'inactive':
        return 'text-gray-400';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const availableIntegrations = [
    { type: 'siem', name: 'SIEM', description: 'Connect to your SIEM platform' },
    { type: 'splunk', name: 'Splunk', description: 'Send logs to Splunk' },
    { type: 'ticketing', name: 'Ticketing', description: 'Create tickets automatically' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Integrations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Connect external services and storage</p>
        </div>
      </div>

      {/* S3 Storage Integration */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Storage Configuration</h2>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">S3-Compatible Storage</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Configure your S3-compatible storage for shell session recordings (AWS S3, MinIO, RustFS, etc.)
                  </p>
                </div>
                {s3Config.configured && (
                  <div className="flex items-center gap-2">
                    <Circle className="w-3 h-3 fill-current text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Configured</span>
                  </div>
                )}
              </div>

              {s3Config.configured && !showS3Form && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Endpoint:</span>
                      <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{s3Config.endpoint}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Bucket:</span>
                      <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{s3Config.bucket}</span>
                    </div>
                    {s3Config.prefix && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Prefix:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{s3Config.prefix}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Access Key:</span>
                      <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{s3Config.accessKey}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setShowS3Form(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-2 px-4 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      Edit Configuration
                    </button>
                    <button
                      onClick={handleS3Delete}
                      className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium py-2 px-4 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {(!s3Config.configured || showS3Form) && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        S3 Endpoint <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={s3Form.endpoint}
                        onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
                        placeholder="https://s3.example.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bucket Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={s3Form.bucket}
                        onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
                        placeholder="shellsight-recordings"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Prefix (Optional)
                      </label>
                      <input
                        type="text"
                        value={s3Form.prefix}
                        onChange={(e) => setS3Form({ ...s3Form, prefix: e.target.value })}
                        placeholder="recordings/"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Access Key <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={s3Form.accessKey}
                        onChange={(e) => setS3Form({ ...s3Form, accessKey: e.target.value })}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Secret Key <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSecretKey ? 'text' : 'password'}
                          value={s3Form.secretKey}
                          onChange={(e) => setS3Form({ ...s3Form, secretKey: e.target.value })}
                          placeholder={s3Config.configured ? '••••••••••••••••' : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecretKey(!showSecretKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {s3Config.configured && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Leave blank to keep existing secret key
                        </p>
                      )}
                    </div>
                  </div>

                  {s3TestResult && (
                    <div className={`p-3 rounded-lg flex items-center gap-2 ${s3TestResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                      {s3TestResult.success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      <span className="text-sm">{s3TestResult.message}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleS3Test}
                      disabled={s3Testing || !s3Form.endpoint || !s3Form.bucket || !s3Form.accessKey || !s3Form.secretKey}
                      className="flex items-center gap-2 text-sm font-medium py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      {s3Testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Test Connection
                    </button>
                    <button
                      onClick={handleS3Save}
                      disabled={s3Saving || !s3Form.endpoint || !s3Form.bucket || !s3Form.accessKey || (!s3Form.secretKey && !s3Config.configured)}
                      className="flex items-center gap-2 text-sm font-medium py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {s3Saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {s3Config.configured ? 'Update Configuration' : 'Save Configuration'}
                    </button>
                    {showS3Form && s3Config.configured && (
                      <button
                        onClick={() => {
                          setShowS3Form(false);
                          setS3TestResult(null);
                        }}
                        className="text-sm font-medium py-2 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!s3Config.configured && !showS3Form && (
                <button
                  onClick={() => setShowS3Form(true)}
                  className="mt-4 flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Configure S3 Storage
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Other Integrations */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${getIntegrationColor(integration.type)}`}>
                  {getIntegrationIcon(integration.type)}
                </div>
                <Circle className={`w-3 h-3 fill-current ${getStatusColor(integration.status)}`} />
              </div>

              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{integration.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 capitalize">{integration.type} Integration</p>

              <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{integration.status}</span>
                </div>
              </div>

              <div className="mt-4">
                <button className="w-full text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-2 px-3 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                  Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Available Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableIntegrations.map((integration) => (
            <div
              key={integration.type}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className={`p-3 rounded-lg ${getIntegrationColor(integration.type)} w-fit mb-4`}>
                {getIntegrationIcon(integration.type)}
              </div>

              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{integration.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{integration.description}</p>

              <button className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium py-2 px-4 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors cursor-not-allowed opacity-50">
                <Plus className="w-4 h-4" />
                Coming Soon
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
