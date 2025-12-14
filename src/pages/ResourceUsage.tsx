import { useState, useEffect } from 'react';
import { Cpu, HardDrive, Network, TrendingUp } from 'lucide-react';
import type { ResourceUsage } from '../types';

export default function ResourceUsagePage() {
  const [usage, setUsage] = useState<ResourceUsage[]>([]);

  useEffect(() => {
    const mockUsage: ResourceUsage[] = [
      {
        id: '1',
        execution_id: '1',
        cluster_id: '1',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        cpu_usage: 45.2,
        memory_usage: 2048,
        storage_usage: 15360,
        network_in: 125,
        network_out: 89,
      },
      {
        id: '2',
        execution_id: '2',
        cluster_id: '1',
        timestamp: new Date(Date.now() - 240000).toISOString(),
        cpu_usage: 78.5,
        memory_usage: 4096,
        storage_usage: 20480,
        network_in: 256,
        network_out: 178,
      },
    ];
    setUsage(mockUsage);
  }, []);

  const latestUsage = usage[usage.length - 1] || {
    cpu_usage: 0,
    memory_usage: 0,
    storage_usage: 0,
    network_in: 0,
    network_out: 0,
  };

  const formatBytes = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Usage</h1>
          <p className="text-gray-600 mt-1">Monitor resource consumption per execution</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Cpu className="w-6 h-6 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">CPU Usage</h3>
          <p className="text-2xl font-bold text-gray-900">{latestUsage.cpu_usage.toFixed(1)}%</p>
          <div className="mt-3 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getUsageColor(latestUsage.cpu_usage)}`}
              style={{ width: `${Math.min(latestUsage.cpu_usage, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <HardDrive className="w-6 h-6 text-purple-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Memory</h3>
          <p className="text-2xl font-bold text-gray-900">{formatBytes(latestUsage.memory_usage)}</p>
          <div className="mt-3 text-xs text-gray-500">of 8 GB allocated</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <HardDrive className="w-6 h-6 text-green-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Storage</h3>
          <p className="text-2xl font-bold text-gray-900">{formatBytes(latestUsage.storage_usage)}</p>
          <div className="mt-3 text-xs text-gray-500">of 100 GB available</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Network className="w-6 h-6 text-orange-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Network</h3>
          <p className="text-sm font-bold text-gray-900">
            ↓ {formatBytes(latestUsage.network_in)} / ↑ {formatBytes(latestUsage.network_out)}
          </p>
          <div className="mt-3 text-xs text-gray-500">Total transfer</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Resource History</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usage.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.cpu_usage.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatBytes(item.memory_usage)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatBytes(item.storage_usage)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatBytes(item.network_in)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatBytes(item.network_out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
