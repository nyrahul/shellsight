import { useState, useEffect } from 'react';
import { Box, Copy, Check, Terminal, Shield, CheckCircle, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');

interface S3ConfigState {
  endpoint: string;
  bucket: string;
  prefix: string;
  accessKey: string;
  secretKey: string;
  isUserConfigured: boolean;
}

export default function OnboardK8s() {
  const { user, token } = useAuth();
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [s3Config, setS3Config] = useState<S3ConfigState>({ endpoint: '', bucket: '', prefix: '', accessKey: '', secretKey: '', isUserConfigured: false });

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
            prefix: data.prefix || '',
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
  const s3Prefix = s3Config.prefix || '[S3_PREFIX]';
  const s3AccessKey = s3Config.accessKey || '[S3_ACCESS_KEY]';
  // Display masked secret, but use real value for clipboard
  const s3SecretKeyDisplay = s3Config.isUserConfigured ? '*****' : '[S3_SECRET_KEY]';
  const s3SecretKeyReal = s3Config.secretKey || '[S3_SECRET_KEY]';

  const denyExecCommand = `kubectl apply -f https://raw.githubusercontent.com/nyrahul/src/refs/heads/master/ak-debug-image/deny-pod-exec.yaml`;

  const whitelistCommand = `kubectl apply -f https://raw.githubusercontent.com/nyrahul/src/refs/heads/master/ak-debug-image/whitelist-ephemeral-imgs.yaml`;

  // Command displayed on screen (with masked secret)
  const debugCommandDisplay = `kubectl debug -it -n <NAMESPACE> <POD_NAME> \\
  --image=nyrahul/ak-debug-image:1.6 --profile=general \\
  --image-pull-policy=Always \\
  --env USER_EMAIL=${userEmail} \\
  --env S3_ENDPOINT=${s3Endpoint} \\
  --env S3_BUCKET=${s3Bucket} \\
  --env S3_PREFIX=${s3Prefix} \\
  --env S3_ACCESS_KEY=${s3AccessKey} \\
  --env S3_SECRET_KEY=${s3SecretKeyDisplay}`;

  // Command copied to clipboard (with real secret)
  const debugCommandClipboard = `kubectl debug -it -n <NAMESPACE> <POD_NAME> \\
  --image=nyrahul/ak-debug-image:1.6 --profile=general \\
  --image-pull-policy=Always \\
  --env USER_EMAIL=${userEmail} \\
  --env S3_ENDPOINT=${s3Endpoint} \\
  --env S3_BUCKET=${s3Bucket} \\
  --env S3_PREFIX=${s3Prefix} \\
  --env S3_ACCESS_KEY=${s3AccessKey} \\
  --env S3_SECRET_KEY=${s3SecretKeyReal}`;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
          <Box className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Onboard Kubernetes</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure shell recording for Kubernetes pods</p>
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

      {/* Optional Kyverno Policies Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Optional: Kyverno Policies</h2>
        </div>

        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Note:</strong> The following steps are optional but ensure that users can't bypass the use of the specific <code className="bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">kubectl debug</code> command to access pods. Both steps assume <a href="https://kyverno.io/" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Kyverno</a> is installed.
          </p>
        </div>

        {/* Step 1: Deny kubectl exec */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
            1. Disable kubectl exec
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
            This policy prevents users from using <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">kubectl exec</code> to access pods directly.
          </p>
          <div className="relative">
            <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
              {denyExecCommand}
            </pre>
            <button
              onClick={() => copyToClipboard(denyExecCommand, 'deny-exec')}
              className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              title="Copy to clipboard"
            >
              {copiedCommand === 'deny-exec' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Step 2: Whitelist ephemeral images */}
        <div>
          <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
            2. Allow specific container image for ephemeral containers
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
            This policy whitelists only the approved debug image for ephemeral containers.
          </p>
          <div className="relative">
            <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
              {whitelistCommand}
            </pre>
            <button
              onClick={() => copyToClipboard(whitelistCommand, 'whitelist')}
              className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              title="Copy to clipboard"
            >
              {copiedCommand === 'whitelist' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* kubectl debug Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Access Pod with Shell Recording</h2>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Use the following command to access a pod with shell recording enabled:
        </p>

        <div className="relative">
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            {debugCommandDisplay}
          </pre>
          <button
            onClick={() => copyToClipboard(debugCommandClipboard, 'debug')}
            className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            title="Copy to clipboard"
          >
            {copiedCommand === 'debug' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Command Parameters</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">&lt;NAMESPACE&gt;</code> - Target pod's namespace (e.g., <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">default</code>)</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">&lt;POD_NAME&gt;</code> - Name of the pod to debug</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">USER_EMAIL</code> - Email address used for login</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_ENDPOINT</code> - S3-compatible storage endpoint</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_BUCKET</code> - Bucket name for recordings</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_PREFIX</code> - Optional prefix/folder in bucket</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_ACCESS_KEY</code> - S3 access key</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">S3_SECRET_KEY</code> - S3 secret key</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
