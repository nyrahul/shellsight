import { useState, useEffect } from 'react';
import { Database, Plus, Search, Circle } from 'lucide-react';
import type { MCPServer } from '../types';

export default function MCPServers() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const mockServers: MCPServer[] = [
      {
        id: '1',
        name: 'MCP Server Alpha',
        cluster_id: '1',
        status: 'running',
        version: '2.4.1',
        config: { maxConnections: 100, timeout: 30 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'MCP Server Beta',
        cluster_id: '1',
        status: 'running',
        version: '2.4.1',
        config: { maxConnections: 50, timeout: 30 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '3',
        name: 'MCP Server Gamma',
        cluster_id: '2',
        status: 'stopped',
        version: '2.3.0',
        config: { maxConnections: 25, timeout: 20 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    setServers(mockServers);
  }, []);

  const filteredServers = servers.filter((server) =>
    server.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-500';
      case 'stopped':
        return 'text-gray-400';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCP Servers</h1>
          <p className="text-gray-600 mt-1">Manage your Model Context Protocol servers</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-5 h-5" />
          Add MCP Server
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search MCP servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredServers.map((server) => (
            <div
              key={server.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Database className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{server.name}</h3>
                    <p className="text-xs text-gray-500">v{server.version}</p>
                  </div>
                </div>
                <Circle className={`w-3 h-3 fill-current ${getStatusColor(server.status)}`} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-medium text-gray-900 capitalize">{server.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Max Connections:</span>
                  <span className="font-medium text-gray-900">
                    {(server.config.maxConnections as number) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Timeout:</span>
                  <span className="font-medium text-gray-900">
                    {(server.config.timeout as number) || 'N/A'}s
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
