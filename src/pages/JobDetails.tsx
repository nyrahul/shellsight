import { useState, useEffect } from 'react';
import { FileText, Search, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Execution } from '../types';

export default function JobDetails() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const mockExecutions: Execution[] = [
      {
        id: '1',
        job_id: 'JOB-2024-001',
        cluster_id: '1',
        mcp_server_id: '1',
        status: 'completed',
        code: 'print("Hello World")',
        language: 'python',
        started_at: new Date(Date.now() - 3600000).toISOString(),
        completed_at: new Date(Date.now() - 3000000).toISOString(),
        exit_code: 0,
        created_by: 'user-1',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '2',
        job_id: 'JOB-2024-002',
        cluster_id: '1',
        mcp_server_id: '2',
        status: 'running',
        code: 'while True: pass',
        language: 'python',
        started_at: new Date(Date.now() - 1800000).toISOString(),
        completed_at: '',
        exit_code: 0,
        created_by: 'user-1',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: '3',
        job_id: 'JOB-2024-003',
        cluster_id: '2',
        mcp_server_id: '3',
        status: 'failed',
        code: 'raise Exception("Test error")',
        language: 'python',
        started_at: new Date(Date.now() - 7200000).toISOString(),
        completed_at: new Date(Date.now() - 7000000).toISOString(),
        exit_code: 1,
        created_by: 'user-1',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
    setExecutions(mockExecutions);
  }, []);

  const filteredExecutions = executions.filter((execution) =>
    execution.job_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (started: string, completed: string) => {
    if (!completed) return 'Running...';
    const duration = new Date(completed).getTime() - new Date(started).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
          <p className="text-gray-600 mt-1">Monitor execution jobs and their status</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Exit Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExecutions.map((execution) => (
                <tr key={execution.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-gray-400 mr-3" />
                      <div className="text-sm font-medium text-gray-900">{execution.job_id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(execution.status)}
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          execution.status
                        )}`}
                      >
                        {execution.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {execution.language}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(execution.started_at, execution.completed_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`text-sm font-medium ${
                        execution.exit_code === 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {execution.exit_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(execution.started_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
