import { useState, useRef } from 'react';
import { HardDrive, Upload, Copy, Check, Save } from 'lucide-react';

interface SCPConfig {
  username: string;
  host: string;
  port: number;
  path: string;
}

export default function Settings() {
  const [scpConfig, setScpConfig] = useState<SCPConfig>({
    username: '',
    host: '',
    port: 22,
    path: '/data/shellsight',
  });
  const [publicKey, setPublicKey] = useState<string>('');
  const [publicKeyFileName, setPublicKeyFileName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConfigChange = (field: keyof SCPConfig, value: string | number) => {
    setScpConfig(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setPublicKey(content.trim());
        setPublicKeyFileName(file.name);
        setSaveSuccess(false);
      };
      reader.readAsText(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    // In production, this would save to the backend
    console.log('Saving SCP config:', scpConfig);
    console.log('Public key:', publicKey);
  };

  const copyToClipboard = (text: string, commandId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(commandId);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const getScpConnectionString = () => {
    const port = scpConfig.port !== 22 ? `:${scpConfig.port}` : '';
    return `${scpConfig.username || '<USER>'}@${scpConfig.host || '<HOST>'}${port}:${scpConfig.path || '<PATH>'}`;
  };

  const isConfigValid = scpConfig.username && scpConfig.host && scpConfig.path;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure system settings and storage options</p>
        </div>
      </div>

      {/* Onboarding Storage Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Onboarding Storage</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure SCP server for data transfer</p>
          </div>
        </div>

        {/* SCP Server Configuration */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">SCP Server Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={scpConfig.username}
                  onChange={(e) => handleConfigChange('username', e.target.value)}
                  placeholder="e.g., shellsight"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Host / IP Address
                </label>
                <input
                  type="text"
                  value={scpConfig.host}
                  onChange={(e) => handleConfigChange('host', e.target.value)}
                  placeholder="e.g., 192.168.1.100 or storage.example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={scpConfig.port}
                  onChange={(e) => handleConfigChange('port', parseInt(e.target.value) || 22)}
                  placeholder="22"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Remote Path
                </label>
                <input
                  type="text"
                  value={scpConfig.path}
                  onChange={(e) => handleConfigChange('path', e.target.value)}
                  placeholder="e.g., /data/shellsight"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Connection String Preview */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">SCP Connection String:</span>
                <button
                  onClick={() => copyToClipboard(getScpConnectionString(), 'connection')}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1"
                  title="Copy to clipboard"
                >
                  {copiedCommand === 'connection' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <code className="text-sm font-mono text-gray-800 dark:text-gray-200 mt-1 block">
                scp &lt;file&gt; {getScpConnectionString()}
              </code>
            </div>
          </div>

          {/* Public Key Upload */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Public Key</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload the generated public key file (<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">~/.ssh/shellsight_key.pub</code>) for reference and verification.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pub,text/plain"
              className="hidden"
            />

            <div className="flex items-center gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                <Upload className="w-4 h-4" />
                {publicKeyFileName ? 'Change File' : 'Upload Public Key'}
              </button>
              {publicKeyFileName && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <Check className="w-4 h-4 inline text-green-500 mr-1" />
                  {publicKeyFileName}
                </span>
              )}
            </div>

            {publicKey && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Public Key Content:</span>
                  <button
                    onClick={() => copyToClipboard(publicKey, 'pubkey')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1"
                    title="Copy public key"
                  >
                    {copiedCommand === 'pubkey' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-all bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {publicKey}
                </pre>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex items-center justify-between">
            <div>
              {saveSuccess && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Settings saved successfully
                </span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={!isConfigValid || isSaving}
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
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
