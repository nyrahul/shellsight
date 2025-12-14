import { useState, useEffect } from 'react';
import { Plug, Plus, Circle, Bell, Mail, MessageSquare } from 'lucide-react';
import type { Integration } from '../types';

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    const mockIntegrations: Integration[] = [
      {
        id: '1',
        type: 'slack',
        name: 'Slack Notifications',
        status: 'active',
        config: { webhook: 'https://hooks.slack.com/...' },
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      },
      {
        id: '2',
        type: 'email',
        name: 'Email Alerts',
        status: 'active',
        config: { smtp: 'smtp.gmail.com', recipients: ['admin@example.com'] },
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      },
      {
        id: '3',
        type: 'splunk',
        name: 'Splunk Logging',
        status: 'inactive',
        config: { endpoint: 'https://splunk.example.com', token: '***' },
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      },
    ];
    setIntegrations(mockIntegrations);
  }, []);

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
        return 'bg-purple-100 text-purple-600';
      case 'email':
        return 'bg-blue-100 text-blue-600';
      case 'siem':
      case 'splunk':
        return 'bg-orange-100 text-orange-600';
      case 'ticketing':
        return 'bg-green-100 text-green-600';
      default:
        return 'bg-gray-100 text-gray-600';
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
    { type: 'email', name: 'Email', description: 'Email notifications' },
    { type: 'slack', name: 'Slack', description: 'Slack channel notifications' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-1">Connect external services and tools</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${getIntegrationColor(integration.type)}`}>
                  {getIntegrationIcon(integration.type)}
                </div>
                <Circle className={`w-3 h-3 fill-current ${getStatusColor(integration.status)}`} />
              </div>

              <h3 className="text-sm font-semibold text-gray-900 mb-1">{integration.name}</h3>
              <p className="text-xs text-gray-500 mb-3 capitalize">{integration.type} Integration</p>

              <div className="space-y-2 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-medium text-gray-900 capitalize">{integration.status}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Created:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(integration.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-2 px-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                  Configure
                </button>
                <button className="flex-1 text-xs text-gray-600 hover:text-gray-800 font-medium py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Test
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableIntegrations.map((integration) => (
            <div
              key={integration.type}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className={`p-3 rounded-lg ${getIntegrationColor(integration.type)} w-fit mb-4`}>
                {getIntegrationIcon(integration.type)}
              </div>

              <h3 className="text-sm font-semibold text-gray-900 mb-1">{integration.name}</h3>
              <p className="text-xs text-gray-500 mb-4">{integration.description}</p>

              <button className="w-full flex items-center justify-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium py-2 px-4 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
                Add Integration
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
