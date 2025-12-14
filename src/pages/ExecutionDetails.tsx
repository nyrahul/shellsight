import { useState, useEffect } from 'react';
import { Activity, Clock, Server, Database, Code } from 'lucide-react';
import type { Execution } from '../types';

export default function ExecutionDetails() {
  const [execution, setExecution] = useState<Execution | null>(null);

  useEffect(() => {
    const mockExecution: Execution = {
      id: '1',
      job_id: 'JOB-2024-001',
      cluster_id: '1',
      mcp_server_id: '1',
      status: 'completed',
      code: `import pandas as pd
import numpy as np

def main():
    data = pd.DataFrame({
        'A': np.random.randn(100),
        'B': np.random.randn(100)
    })
    print(data.describe())
    data.to_csv('output.csv')

if __name__ == '__main__':
    main()`,
      language: 'python',
      started_at: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date(Date.now() - 3000000).toISOString(),
      exit_code: 0,
      created_by: 'user-1',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    };
    setExecution(mockExecution);
  }, []);

  if (!execution) {
    return <div className="p-6">Loading...</div>;
  }

  const formatDuration = (started: string, completed: string) => {
    const duration = new Date(completed).getTime() - new Date(started).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Execution Details</h1>
        <p className="text-gray-600 mt-1">Detailed information about the execution</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Job ID</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{execution.job_id}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">Duration</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatDuration(execution.started_at, execution.completed_at)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Code className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900">Exit Code</h3>
          </div>
          <p className={`text-2xl font-bold ${execution.exit_code === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {execution.exit_code}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Status</span>
              <span className="font-medium text-gray-900 capitalize">{execution.status}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Language</span>
              <span className="font-medium text-gray-900 capitalize">{execution.language}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Started At</span>
              <span className="font-medium text-gray-900">
                {new Date(execution.started_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Completed At</span>
              <span className="font-medium text-gray-900">
                {new Date(execution.completed_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Infrastructure</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Server className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Cluster</p>
                <p className="font-medium text-gray-900">Production Cluster</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Database className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">MCP Server</p>
                <p className="font-medium text-gray-900">MCP Server Alpha</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Code</h3>
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-gray-100">{execution.code}</pre>
        </div>
      </div>
    </div>
  );
}
