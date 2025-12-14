import { useState, useEffect } from 'react';
import { Terminal, Filter, AlertCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import type { AppLog } from '../types';

export default function AppLogs() {
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');

  useEffect(() => {
    const mockLogs: AppLog[] = [
      {
        id: '1',
        execution_id: '1',
        timestamp: new Date(Date.now() - 5000).toISOString(),
        level: 'info',
        message: 'Execution started successfully',
        metadata: { source: 'runtime' },
      },
      {
        id: '2',
        execution_id: '1',
        timestamp: new Date(Date.now() - 4000).toISOString(),
        level: 'debug',
        message: 'Loading dependencies...',
        metadata: { source: 'loader' },
      },
      {
        id: '3',
        execution_id: '1',
        timestamp: new Date(Date.now() - 3000).toISOString(),
        level: 'warn',
        message: 'Deprecated API usage detected',
        metadata: { source: 'validator' },
      },
      {
        id: '4',
        execution_id: '2',
        timestamp: new Date(Date.now() - 2000).toISOString(),
        level: 'error',
        message: 'Connection timeout to external service',
        metadata: { source: 'network', service: 'api.example.com' },
      },
      {
        id: '5',
        execution_id: '2',
        timestamp: new Date(Date.now() - 1000).toISOString(),
        level: 'info',
        message: 'Retrying connection...',
        metadata: { source: 'network', attempt: 1 },
      },
    ];
    setLogs(mockLogs);
  }, []);

  const filteredLogs = logs.filter((log) => filterLevel === 'all' || log.level === filterLevel);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'debug':
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'debug':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">App Logs</h1>
          <p className="text-gray-600 mt-1">View application logs from executions</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
          <Terminal className="w-5 h-5 text-green-400" />
          <span className="text-green-400 font-semibold">Live Log Stream</span>
        </div>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded border ${getLevelColor(log.level)} flex items-start gap-3`}
            >
              {getLevelIcon(log.level)}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs text-gray-500 font-medium">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs font-semibold uppercase text-gray-600">{log.level}</span>
                </div>
                <p className="text-sm text-gray-800">{log.message}</p>
                {Object.keys(log.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    {JSON.stringify(log.metadata, null, 2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
