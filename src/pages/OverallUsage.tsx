import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';

export default function OverallUsage() {
  const [stats, setStats] = useState({
    totalExecutions: 0,
    totalCPUHours: 0,
    totalMemoryGB: 0,
    totalStorageGB: 0,
    totalNetworkGB: 0,
  });

  useEffect(() => {
    setStats({
      totalExecutions: 247,
      totalCPUHours: 1523.5,
      totalMemoryGB: 4096.2,
      totalStorageGB: 15360.8,
      totalNetworkGB: 2048.6,
    });
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Overall Resource Usage</h1>
        <p className="text-gray-600 mt-1">Aggregate resource consumption across all executions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-medium opacity-90 mb-1">Total Executions</h3>
          <p className="text-3xl font-bold">{stats.totalExecutions.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">All time</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-medium opacity-90 mb-1">CPU Hours</h3>
          <p className="text-3xl font-bold">{stats.totalCPUHours.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">Total compute time</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-medium opacity-90 mb-1">Memory</h3>
          <p className="text-3xl font-bold">{stats.totalMemoryGB.toLocaleString()} GB</p>
          <p className="text-xs opacity-75 mt-2">Total allocated</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Consumption</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Total Storage Used</span>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.totalStorageGB.toLocaleString()} GB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full"
                  style={{ width: `${(stats.totalStorageGB / 20000) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">of 20,000 GB capacity</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Traffic</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total Data Transfer</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalNetworkGB.toLocaleString()} GB
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Breakdown by Time Period</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU Hours</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory GB</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network GB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">Last 24 Hours</td>
                <td className="px-4 py-3 text-sm text-gray-900">42</td>
                <td className="px-4 py-3 text-sm text-gray-900">85.3</td>
                <td className="px-4 py-3 text-sm text-gray-900">256.4</td>
                <td className="px-4 py-3 text-sm text-gray-900">48.2</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">Last 7 Days</td>
                <td className="px-4 py-3 text-sm text-gray-900">189</td>
                <td className="px-4 py-3 text-sm text-gray-900">423.7</td>
                <td className="px-4 py-3 text-sm text-gray-900">1024.8</td>
                <td className="px-4 py-3 text-sm text-gray-900">178.5</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">Last 30 Days</td>
                <td className="px-4 py-3 text-sm text-gray-900">247</td>
                <td className="px-4 py-3 text-sm text-gray-900">1523.5</td>
                <td className="px-4 py-3 text-sm text-gray-900">4096.2</td>
                <td className="px-4 py-3 text-sm text-gray-900">2048.6</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
