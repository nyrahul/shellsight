import { useState, useEffect } from 'react';
import { Monitor, Copy, Check, Terminal, Trash2, CheckCircle, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');

interface S3ConfigState {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  isUserConfigured: boolean;
}

export default function OnboardVM() {
  const { user, token } = useAuth();
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [s3Config, setS3Config] = useState<S3ConfigState>({ endpoint: '', bucket: '', accessKey: '', secretKey: '', isUserConfigured: false });

  useEffect(() => {
    const fetchS3Config = async () => {
      try {
        const response = await fetch(`${API_URL}/api/config/s3`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setS3Config({
            endpoint: data.endpoint || '',
            bucket: data.bucket || '',
            accessKey: data.accessKey || '',
            secretKey: data.secretKey || '',
            isUserConfigured: data.isUserConfigured || false,
          });
        }
      } catch (err) {
        console.error('Failed to fetch S3 config:', err);
      }
    };
    fetchS3Config();
  }, [token]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const userEmail = user?.email || '[USER-EMAIL]';
  const s3Endpoint = s3Config.endpoint || '[S3_ENDPOINT]';
  const s3Bucket = s3Config.bucket || '[S3_BUCKET]';
  const s3AccessKey = s3Config.accessKey || '[S3_ACCESS_KEY]';
  // Display masked secret, but use real value for clipboard
  const s3SecretKeyDisplay = s3Config.isUserConfigured ? '*****' : '[S3_SECRET_KEY]';
  const s3SecretKeyReal = s3Config.secretKey || '[S3_SECRET_KEY]';

  // Command displayed on screen (with masked secret)
  const onboardCommandDisplay = `curl -sSL https://raw.githubusercontent.com/nyrahul/src/refs/heads/master/ssh-ssnrec/install-recorded-shell.sh | \\
   sudo USER_EMAIL=${userEmail} \\
   S3_ENDPOINT=${s3Endpoint} \\
   S3_BUCKET=${s3Bucket} \\
   S3_ACCESS_KEY=${s3AccessKey} \\
   S3_SECRET_KEY=${s3SecretKeyDisplay} \\
   bash`;

  // Command copied to clipboard (with real secret)
  const onboardCommandClipboard = `curl -sSL https://raw.githubusercontent.com/nyrahul/src/refs/heads/master/ssh-ssnrec/install-recorded-shell.sh | \\
   sudo USER_EMAIL=${userEmail} \\
   S3_ENDPOINT=${s3Endpoint} \\
   S3_BUCKET=${s3Bucket} \\
   S3_ACCESS_KEY=${s3AccessKey} \\
   S3_SECRET_KEY=${s3SecretKeyReal} \\
   bash`;

  const deboardCommand = `curl -fsSL https://raw.githubusercontent.com/nyrahul/src/refs/heads/master/ssh-ssnrec/uninstall-rec-shell.sh | sudo bash -s -- --purge-logs`;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <Monitor className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Onboard VM / Bare-metal</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure shell recording on SSH servers</p>
        </div>
      </div>

      {/* S3 Config Status */}
      {s3Config.isUserConfigured ? (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">Using your configured S3 storage</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
              Endpoint: {s3Config.endpoint} | Bucket: {s3Config.bucket}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3">
          <Settings className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">S3 storage not configured</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Configure your S3 storage in <strong>Settings → Integrations</strong> to auto-populate the values below.
            </p>
          </div>
        </div>
      )}

      {/* Onboard Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Onboard a VM/Bare-metal SSH Server</h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          To onboard a VM/Bare-metal SSH server, use the following command:
        </p>

        <div className="relative">
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            {onboardCommandDisplay}
          </pre>
          <button
            onClick={() => copyToClipboard(onboardCommandClipboard, 'onboard')}
            className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Copy to clipboard"
          >
            {copiedCommand === 'onboard' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Environment Variables</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">USER_EMAIL</code> - Email address used for login</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_ENDPOINT</code> - S3-compatible storage endpoint</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_BUCKET</code> - Bucket name for recordings</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_ACCESS_KEY</code> - S3 access key</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_SECRET_KEY</code> - S3 secret key</li>
          </ul>
        </div>
      </div>

      {/* Deboard Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Deboard a VM/Bare-metal SSH Server</h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          To deboard a VM/bare-metal SSH server, use the following command:
        </p>

        <div className="relative">
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            {deboardCommand}
          </pre>
          <button
            onClick={() => copyToClipboard(deboardCommand, 'deboard')}
            className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Copy to clipboard"
          >
            {copiedCommand === 'deboard' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Note:</strong> The <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">--purge-logs</code> flag removes all local recording logs. Omit this flag to keep local logs.
          </p>
        </div>
      </div>
    </div>
  );
}
