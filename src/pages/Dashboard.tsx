import { useState, useEffect } from 'react';
import { LayoutDashboard, Monitor, Box, Database, TrendingUp, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');

interface DailyRecording {
  date: string;
  count: number;
}

interface DashboardStats {
  dailyRecordings: DailyRecording[];
  totalRecordings: number;
  vmCount: number;
  k8sCount: number;
  vmHosts: string[];
  k8sPods: string[];
}

interface StorageStats {
  bucket: string;
  endpoint: string;
  storageAvailable: boolean;
}

const TIMEFRAME_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
];

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [timeframe, setTimeframe] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [statsRes, storageRes] = await Promise.all([
          fetch(`${API_URL}/api/dashboard/stats?days=${timeframe}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          }),
          fetch(`${API_URL}/api/dashboard/storage`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          }),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (storageRes.ok) {
          const storageData = await storageRes.json();
          setStorage(storageData);
        }

        setError('');
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token, timeframe]);

  const maxCount = stats?.dailyRecordings ? Math.max(...stats.dailyRecordings.map(d => d.count), 1) : 1;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of shell recording activity</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Total Recordings */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Recordings</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.totalRecordings || 0}</p>
        </div>

        {/* VM/Hosts */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <Monitor className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">VM/Hosts</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.vmCount || 0}</p>
          {stats?.vmHosts && stats.vmHosts.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate" title={stats.vmHosts.join(', ')}>
              {stats.vmHosts.slice(0, 3).join(', ')}{stats.vmHosts.length > 3 ? ` +${stats.vmHosts.length - 3} more` : ''}
            </p>
          )}
        </div>

        {/* K8s Pods */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Box className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">K8s Pods</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.k8sCount || 0}</p>
          {stats?.k8sPods && stats.k8sPods.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate" title={stats.k8sPods.join(', ')}>
              {stats.k8sPods.slice(0, 3).join(', ')}{stats.k8sPods.length > 3 ? ` +${stats.k8sPods.length - 3} more` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Recordings Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recordings Over Time</h2>
          </div>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            {TIMEFRAME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Simple Bar Chart */}
        <div className="flex items-end gap-1 h-48">
          {stats?.dailyRecordings?.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col items-center justify-end h-40">
                <span className="text-xs text-gray-600 dark:text-gray-400 mb-1">{day.count}</span>
                <div
                  className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all duration-300"
                  style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? '8px' : '2px' }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-top-left whitespace-nowrap">
                {formatDate(day.date)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Storage</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">S3 Bucket</span>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{storage?.bucket || 'N/A'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Endpoint</span>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{storage?.endpoint || 'N/A'}</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${storage?.storageAvailable ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {storage?.storageAvailable ? 'Storage connected' : 'Storage unavailable'}
          </p>
        </div>
      </div>
    </div>
  );
}
